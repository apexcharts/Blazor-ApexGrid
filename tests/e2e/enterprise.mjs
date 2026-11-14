// Headless browser smoke test for Blazor-ApexGrid-Enterprise, run after smoke.mjs by npm test.
//
// Two things are checked:
//
// 1. One apex-grid core per page. The enterprise bundle carries no core: it extends the one
//    Blazor-ApexGrid's bundle loads, through the registry that bundle publishes. Were a second
//    core loaded, nothing would throw (the core skips a tag that is already defined), and the
//    grids would even render, but <apex-grid-enterprise> would extend a second ApexGrid class
//    with its own module state, beside the one registered as <apex-grid>. So the test asserts
//    the class chain, the registry, one core bundle URL, one definition of each core tag and one
//    apex-grid-row class across community and enterprise grids, for the three load orders:
//    enterprise first, community first, and both at once. (An enterprise bundle built with its
//    own core fails the class chain and instanceof checks in every order.)
//
// 2. Each modelled module, through the sample's /enterprise page: grouping with aggregation and a
//    live GroupBy change, the context menu with a .NET item, the grand-total row, range selection
//    with OnRangeChanged, the XLSX export (download, bytes and the toolbar menu), the pivot and its
//    removal, and the trial watermark (no key is set in the sample).
//
// 3. The options the /enterprise page leaves at their defaults, through /enterprise-options:
//    ReplaceDefaultItems, cell and header Target, a Submenu, ContextMenu Enabled = false, and
//    RangeSelection = false then true, all set from .NET.
//
// 4. A module subset: the sample reads ApexGrid:Modules from appsettings.json (routed here), and
//    with "Grouping, Aggregation" only those two work.
//
// 5. The license key, through the real AddApexGridEnterprise path (appsettings.json routed). A
//    valid key is minted with a throwaway ECDSA P-256 key whose public half replaces the signing
//    key in the served enterprise bundle; it removes the watermark. An invalid and an expired key
//    keep it, log a console error, and never echo the key.
//
// Usage:
//   BASE_URL=http://localhost:5186 node enterprise.mjs
let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  ({ chromium } = await import("playwright-core"));
}

const BASE = process.env.BASE_URL || "http://localhost:5186";
const channel = process.env.PW_CHANNEL;

// The sample's index.html loads ApexCharts from a CDN; serve it locally, as smoke.mjs does.
const APEXCHARTS_URL = "https://cdn.jsdelivr.net/npm/apexcharts@8.8.1/dist/apexcharts.min.js";
let apexChartsJs = null;
try {
  const { createRequire } = await import("node:module");
  const { readFileSync } = await import("node:fs");
  const require = createRequire(import.meta.url);
  apexChartsJs = readFileSync(require.resolve("apexcharts/dist/apexcharts.min.js"), "utf8");
} catch {
  // not installed: the page fetches the CDN copy
}

// The .NET dev server injects browser tooling (hot reload) that asks for files under
// _framework/dotnet-browser-tools/; newer SDKs log a 404 for them on a Debug run. That request is
// the tooling's, not the app's, so it is not an error here. Any other failed load is, and its URL is
// kept in the message (the console text alone does not say which resource failed).
function consoleError(m) {
  const url = m.location()?.url ?? "";
  if (url.includes("/_framework/dotnet-browser-tools/")) return null;
  const text = m.text();
  return (text.startsWith("Failed to load resource") && url ? `${text} (${url})` : text).slice(0, 300);
}

const failures = [];
const browser = await chromium.launch(channel ? { channel, headless: true } : { headless: true });

// Counts every customElements.define call per tag, and records any that throws, before any page
// script runs.
function instrumentDefine() {
  const counts = (window.__defines = {});
  const errors = (window.__defineErrors = []);
  const define = customElements.define.bind(customElements);
  customElements.define = (name, ctor, options) => {
    counts[name] = (counts[name] ?? 0) + 1;
    try {
      return define(name, ctor, options);
    } catch (e) {
      errors.push(`${name}: ${e.message}`);
      throw e;
    }
  };
}

// settings: served as the sample's appsettings.json (read by Program.cs into
// AddApexGridEnterprise). signingKeySpki: replaces the license signing key in the enterprise bundle.
async function openPage(path, { settings, signingKeySpki } = {}) {
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 }, acceptDownloads: true });
  await page.addInitScript(instrumentDefine);
  if (apexChartsJs)
    await page.route(APEXCHARTS_URL, (route) =>
      route.fulfill({ status: 200, contentType: "text/javascript", body: apexChartsJs })
    );
  if (settings)
    await page.route("**/appsettings.json", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(settings) })
    );
  if (signingKeySpki)
    await page.route("**/apex-grid-enterprise.bundle.js*", async (route) => {
      const response = await route.fetch();
      const source = await response.text();
      const keys = source.match(/publicKeysSpki=\[[^\]]*\]/g) ?? [];
      if (keys.length !== 1) failures.push(`expected one license signing key in the bundle, found ${keys.length}`);
      const body = source.replace(/publicKeysSpki=\[[^\]]*\]/, `publicKeysSpki=[${JSON.stringify(signingKeySpki)}]`);
      await route.fulfill({ response, body });
    });
  const errors = [];
  const consoleLog = [];
  page.on("console", (m) => {
    consoleLog.push({ type: m.type(), text: m.text() });
    const error = m.type() === "error" ? consoleError(m) : null;
    if (error) errors.push(error);
  });
  page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message.slice(0, 200)));
  // A deep link: the dev server serves the app for any route, so this loads the page's own
  // components first, which is what decides the load order.
  await page.goto(BASE + path, { waitUntil: "domcontentloaded" });
  return { page, errors, consoleLog };
}

async function settle(page, selector) {
  await page.waitForSelector(selector, { timeout: 90000 }).catch(() => {});
  await page.waitForTimeout(2500);
}

// The one-core invariants, on whatever grids the page shows now.
function oneCore(page) {
  return page.evaluate(() => {
    const core = customElements.get("apex-grid");
    const enterprise = customElements.get("apex-grid-enterprise");
    const registry = globalThis[Symbol.for("blazor-apexgrid.shared")];
    const rowClasses = new Set();
    const rowsIn = (grid) => {
      let n = 0;
      (function walk(root) {
        root.querySelectorAll("*").forEach((node) => {
          if (node.localName === "apex-grid-row") {
            n++;
            rowClasses.add(node.constructor);
          }
          if (node.shadowRoot) walk(node.shadowRoot);
        });
      })(grid.shadowRoot ?? grid);
      return n;
    };
    const community = [...document.querySelectorAll("apex-grid")];
    const enterprises = [...document.querySelectorAll("apex-grid-enterprise")];
    const coreBundles = [
      ...new Set(
        performance
          .getEntriesByType("resource")
          .map((r) => r.name)
          .filter((name) => /\/apex-grid\.bundle\.js/.test(name))
      ),
    ];
    // Blazor-ApexGrid's interop module, imported by both packages' components: two URLs (a ?ver=
    // out of step) would evaluate it twice
    const interopModules = [
      ...new Set(
        performance
          .getEntriesByType("resource")
          .map((r) => r.name)
          .filter((name) => /\/blazor-apexgrid\.js/.test(name))
      ),
    ];
    return {
      extendsCore: !!enterprise && Object.getPrototypeOf(enterprise) === core,
      registryHoldsCore:
        registry?.modules?.["apex-grid"]?.ApexGrid === core &&
        registry?.modules?.["apex-grid/internal"]?.ApexGrid === core,
      registryVersion: registry?.version ?? null,
      enterpriseIsGrid: enterprises.every((el) => el instanceof core),
      coreBundles,
      interopModules,
      multiplyDefined: Object.entries(window.__defines).filter(([, n]) => n > 1).map(([tag]) => tag),
      rowDefines: window.__defines["apex-grid-row"] ?? 0,
      defineErrors: window.__defineErrors,
      communityRows: community.map(rowsIn),
      enterpriseRows: enterprises.map(rowsIn),
      rowClasses: rowClasses.size,
      rowClassRegistered: [...rowClasses].every((c) => c === customElements.get("apex-grid-row")),
    };
  });
}

function checkOneCore(label, r, { community, enterprise }) {
  const problems = [];
  if (!r.extendsCore) problems.push("<apex-grid-enterprise> does not extend the registered <apex-grid> class");
  if (!r.registryHoldsCore) problems.push("the shared registry does not hold the registered core");
  if (!r.enterpriseIsGrid) problems.push("an enterprise grid is not an instance of the registered ApexGrid");
  if (r.coreBundles.length !== 1) problems.push(`expected 1 core bundle URL, got ${JSON.stringify(r.coreBundles)}`);
  if (r.interopModules.length !== 1)
    problems.push(`expected 1 blazor-apexgrid.js URL, got ${JSON.stringify(r.interopModules)}`);
  if (r.multiplyDefined.length) problems.push(`defined more than once: ${r.multiplyDefined.join(", ")}`);
  if (r.rowDefines !== 1) problems.push(`apex-grid-row defined ${r.rowDefines} times`);
  if (r.defineErrors.length) problems.push(`define errors: ${JSON.stringify(r.defineErrors)}`);
  if (r.communityRows.length !== community || r.communityRows.some((n) => n === 0))
    problems.push(`expected ${community} community grid(s) with rows, got ${JSON.stringify(r.communityRows)}`);
  if (r.enterpriseRows.length !== enterprise || (enterprise && r.enterpriseRows[0] === 0))
    problems.push(`expected ${enterprise} enterprise grid(s) with rows, got ${JSON.stringify(r.enterpriseRows)}`);
  if (r.rowClasses !== 1 || !r.rowClassRegistered)
    problems.push(`rows come from ${r.rowClasses} apex-grid-row class(es), registered: ${r.rowClassRegistered}`);
  if (problems.length) failures.push(...problems.map((p) => `[one-core ${label}] ${p}`));
  else
    console.log(
      `[one-core ${label}] one core (apex-grid ${r.registryVersion}, 1 bundle URL, 1 interop URL, ` +
        `apex-grid-row defined once, 1 row class); rows community=${JSON.stringify(r.communityRows)} enterprise=${JSON.stringify(r.enterpriseRows)}`
    );
}

function checkErrors(label, errors) {
  if (errors.length) failures.push(`[${label}] console/page errors: ${JSON.stringify(errors)}`);
}

// --- Load order A: enterprise first, then community, then both ----------------
{
  const { page, errors } = await openPage("/enterprise");
  await settle(page, "apex-grid-enterprise");

  const grid = (i) => `document.querySelectorAll("apex-grid-enterprise")[${i}]`;
  const read = async (id) => (await page.locator(`#${id}`).innerText()).trim();
  const log = () => page.locator("#ent-log").innerText();

  // Grouping + aggregation: GroupBy=["department"] with salary sum and avg on the group headers.
  const grouping = await page.evaluate(`(() => {
    const el = ${grid(0)};
    return {
      groupBy: el.groupBy,
      groups: el.getGroups().map((g) => [g.label, g.count, g.aggregates?.salary?.sum]),
      headerText: (() => { const o = []; (function walk(r) { r.querySelectorAll("[part~=group-aggregate]").forEach((n) => o.push(n.textContent.trim())); r.querySelectorAll("*").forEach((n) => n.shadowRoot && walk(n.shadowRoot)); })(el.shadowRoot); return o; })(),
    };
  })()`);
  const expectedGroups = JSON.stringify([
    ["Engineering", 3, 405000],
    ["Research", 3, 375000],
    ["Operations", 2, 245000],
  ]);
  if (JSON.stringify(grouping.groupBy) !== '["department"]' || JSON.stringify(grouping.groups) !== expectedGroups)
    failures.push(`grouping did not apply GroupBy and the salary subtotals (got ${JSON.stringify(grouping)})`);
  else if (!grouping.headerText.some((t) => /Salary Sum: 405,000/.test(t)))
    failures.push(`group headers do not show the salary sum (got ${JSON.stringify(grouping.headerText)})`);
  else console.log(`[grouping] 3 department groups with salary subtotals on their headers`);

  await page.click("#read-aggregations");
  await page.waitForTimeout(500);
  const aggSum = await read("agg-salary-sum");
  const groupCount = await read("group-count");
  if (aggSum !== "1025000" || groupCount !== "3")
    failures.push(`GetAggregationsAsync/GetGroupsAsync returned sum=${aggSum} groups=${groupCount}`);
  else console.log(`[aggregation] GetAggregationsAsync salary sum=1025000, GetGroupsAsync=3`);

  // A GroupBy change after the first render reaches the grid, and back.
  await page.click("#group-region");
  await page.waitForTimeout(700);
  const regrouped = await page.evaluate(`(() => { const el = ${grid(0)}; return [el.groupBy, el.getGroups().length]; })()`);
  await page.click("#group-department");
  await page.waitForTimeout(700);
  const back = await page.evaluate(`(() => { const el = ${grid(0)}; return [el.groupBy, el.getGroups().length]; })()`);
  if (JSON.stringify(regrouped) !== '[["region","department"],8]' || JSON.stringify(back) !== '[["department"],3]')
    failures.push(`GroupBy did not apply on change (got ${JSON.stringify(regrouped)} then ${JSON.stringify(back)})`);
  else console.log(`[grouping] live: department -> region, department (8 groups) -> department`);

  // A group toggle round-trips to OnGroupExpanded.
  await page.locator("apex-grid-enterprise").first().locator("[part~=group-toggle]").first().click();
  await page.waitForTimeout(600);
  if (!/groupExpanded: \/Engineering expanded=False count=3/.test(await log()))
    failures.push(`OnGroupExpanded did not report the collapsed Engineering group (log: ${JSON.stringify(await log())})`);
  else console.log(`[grouping] OnGroupExpanded: /Engineering collapsed, count 3`);
  await page.locator("apex-grid-enterprise").first().locator("[part~=group-toggle]").first().click();
  await page.waitForTimeout(400);

  // Context menu: the built-in items plus the .NET item, whose click reaches OnContextMenuItemClick
  // with the row and its Data index.
  await page
    .locator("apex-grid-enterprise")
    .first()
    .locator("apex-grid-cell", { hasText: "Alan Turing" })
    .first()
    .click({ button: "right" });
  await page.waitForTimeout(500);
  const items = await page.locator(".apex-grid-context-menu [role=menuitem]").allInnerTexts();
  if (!items.includes("Sort ascending") || items.at(-1) !== "Log this row")
    failures.push(`context menu items were not the built-ins plus "Log this row" (got ${JSON.stringify(items)})`);
  else {
    await page.locator(".apex-grid-context-menu [role=menuitem]", { hasText: "Log this row" }).click();
    await page.waitForTimeout(600);
    if (!/contextMenu: log-row Alan Turing dataIndex=1 column=name/.test(await log()))
      failures.push(`OnContextMenuItemClick did not report Alan Turing (log: ${JSON.stringify(await log())})`);
    else console.log(`[context-menu] ${items.length} items; "Log this row" -> OnContextMenuItemClick(Alan Turing, dataIndex 1)`);
  }

  // Grand-total row: the synthesized row renders with its label and values, and GetTotalsAsync
  // returns them.
  const total = await page.evaluate(`(() => {
    const el = ${grid(1)};
    const o = [];
    (function walk(r) { r.querySelectorAll("[part~=total-row-label],[part~=total-row-value]").forEach((n) => o.push(n.textContent.trim())); r.querySelectorAll("*").forEach((n) => n.shadowRoot && walk(n.shadowRoot)); })(el.shadowRoot);
    return { totals: el.getTotals(), text: o };
  })()`);
  await page.click("#read-totals");
  await page.waitForTimeout(400);
  const totalSalary = await read("total-salary");
  if (
    total.totals?.salary?.sum !== 1025000 ||
    total.totals?.age?.max !== 52 ||
    total.text[0] !== "Total" ||
    !total.text.includes("Salary Sum: 1,025,000") ||
    totalSalary !== "1025000"
  )
    failures.push(`total row did not render or report the totals (got ${JSON.stringify(total)}, .NET ${totalSalary})`);
  else console.log(`[total-row] "Total" row: salary sum 1,025,000, age max 52; GetTotalsAsync agrees`);

  // Range selection: SelectRangeAsync over four salaries; OnRangeChanged carries the stats back.
  await page.click("#select-salaries");
  await page.waitForTimeout(700);
  const rangeCount = await read("range-count");
  const rangeSum = await read("range-sum");
  const bounds = await page.evaluate(`${grid(1)}.getSelectionBounds()`);
  if (rangeCount !== "4" || rangeSum !== "515000" || bounds?.top !== 0 || bounds?.bottom !== 3)
    failures.push(`range selection did not round-trip (count=${rangeCount} sum=${rangeSum} bounds=${JSON.stringify(bounds)})`);
  else console.log(`[range-selection] rows 0-3 of salary: OnRangeChanged count=4 sum=515000`);

  // XLSX: the .NET download names employees.xlsx, the bytes come back as a zip ("PK"), and the
  // toolbar export menu offers the XLSX entry next to CSV.
  try {
    const [download] = await Promise.all([page.waitForEvent("download", { timeout: 5000 }), page.click("#export-xlsx")]);
    const name = download.suggestedFilename();
    if (name !== "employees.xlsx") failures.push(`ExportToXlsxAsync downloaded ${name}, expected employees.xlsx`);
    else console.log(`[xlsx] ExportToXlsxAsync downloaded ${name}`);
  } catch (e) {
    failures.push(`ExportToXlsxAsync did not download: ${e.message.split("\n")[0]}`);
  }
  await page.click("#xlsx-bytes-button");
  await page.waitForTimeout(600);
  const xlsxBytes = parseInt(await read("xlsx-bytes"), 10) || 0;
  const xlsxSig = await read("xlsx-sig");
  if (!(xlsxBytes > 1000) || xlsxSig !== "PK")
    failures.push(`GetXlsxBytesAsync returned ${xlsxBytes} bytes starting ${JSON.stringify(xlsxSig)}`);
  else console.log(`[xlsx] GetXlsxBytesAsync returned ${xlsxBytes} bytes (a zip: PK)`);
  try {
    const flat = page.locator("apex-grid-enterprise").nth(1);
    await flat.getByRole("button", { name: "Export", exact: true }).click();
    const entries = await flat.getByRole("menuitem").allInnerTexts();
    const xlsxEntry = flat.getByRole("menuitem").filter({ hasText: /xlsx/i }).first();
    const [download] = await Promise.all([page.waitForEvent("download", { timeout: 5000 }), xlsxEntry.click()]);
    if (download.suggestedFilename() !== "employees.xlsx")
      failures.push(`toolbar XLSX entry downloaded ${download.suggestedFilename()} (menu ${JSON.stringify(entries)})`);
    else console.log(`[xlsx] toolbar menu ${JSON.stringify(entries)} downloaded employees.xlsx`);
  } catch (e) {
    failures.push(`toolbar XLSX export failed: ${e.message.split("\n")[0]}`);
  }

  // Pivot: region down the left, the quarters as generated value columns, a grand total at the
  // bottom; Pivot = null restores the original columns, and back.
  const pivot = () =>
    page.evaluate(`(() => {
      const el = ${grid(2)};
      const rows = el.pageItems ?? [];
      return {
        pivoting: el.isPivoting,
        columns: el.columns.map((c) => c.key),
        rows: rows.length,
        q4Total: rows.at(-1)?.["pivot::Q4::revenue::sum"],
      };
    })()`);
  const on = await pivot();
  await page.click("#toggle-pivot");
  await page.waitForTimeout(700);
  const off = await pivot();
  await page.click("#read-pivoting");
  await page.waitForTimeout(400);
  const pivotingOff = await read("pivoting");
  await page.click("#toggle-pivot");
  await page.waitForTimeout(700);
  const again = await pivot();
  if (
    !on.pivoting ||
    JSON.stringify(on.columns) !==
      '["region","pivot::Q1::revenue::sum","pivot::Q2::revenue::sum","pivot::Q3::revenue::sum","pivot::Q4::revenue::sum"]' ||
    on.rows !== 4 ||
    on.q4Total !== 150
  )
    failures.push(`pivot did not generate the quarter columns and grand total (got ${JSON.stringify(on)})`);
  else if (off.pivoting || JSON.stringify(off.columns) !== '["region","quarter","product","revenue"]' || off.rows !== 13 || pivotingOff !== "false")
    failures.push(`Pivot = null did not restore the source view (got ${JSON.stringify(off)}, IsPivotingAsync ${pivotingOff})`);
  else if (!again.pivoting || again.rows !== 4)
    failures.push(`the pivot did not come back on (got ${JSON.stringify(again)})`);
  else console.log(`[pivot] region x Q1-Q4, grand total Q4=150; off restores 13 source rows; on again`);

  // No key in the sample: every enterprise grid paints the trial watermark.
  const watermarks = await page.evaluate(() =>
    [...document.querySelectorAll("apex-grid-enterprise")].map((el) => {
      let found = false;
      (function walk(r) {
        if (r.querySelector("[part~=license-watermark]")) found = true;
        r.querySelectorAll("*").forEach((n) => n.shadowRoot && walk(n.shadowRoot));
      })(el.shadowRoot ?? el);
      return found || !!el.querySelector("[part~=license-watermark]");
    })
  );
  if (watermarks.length !== 3 || watermarks.some((w) => !w))
    failures.push(`expected the trial watermark on all 3 enterprise grids (got ${JSON.stringify(watermarks)})`);
  else console.log(`[license] no key: trial watermark on all 3 enterprise grids`);

  // rows render only near the viewport, so bring the first grid back into view
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);
  checkOneCore("enterprise page", await oneCore(page), { community: 0, enterprise: 3 });

  // ...then a community page, whose module loads after the enterprise one...
  await page.getByRole("link", { name: "Data grid" }).click();
  await settle(page, "apex-grid");
  checkOneCore("enterprise first, then community", await oneCore(page), { community: 1, enterprise: 0 });

  // ...then both on one page.
  await page.getByRole("link", { name: "Community and enterprise" }).click();
  await settle(page, "apex-grid-enterprise");
  checkOneCore("enterprise first, then mixed", await oneCore(page), { community: 1, enterprise: 1 });
  const communityMark = await page.evaluate(() => {
    const el = document.querySelector("apex-grid");
    return !!el?.shadowRoot?.querySelector("[part~=license-watermark]");
  });
  if (communityMark) failures.push("the community grid shows the enterprise trial watermark");
  checkErrors("load order A", errors);
  await page.close();
}

// --- Load order B: community first, then the mixed page ------------------------
{
  const { page, errors } = await openPage("/");
  await settle(page, "apex-grid");
  await page.getByRole("link", { name: "Community and enterprise" }).click();
  await settle(page, "apex-grid-enterprise");
  checkOneCore("community first, then mixed", await oneCore(page), { community: 1, enterprise: 1 });
  checkErrors("load order B", errors);
  await page.close();
}

// --- Load order C: both packages' modules requested together --------------------
{
  const { page, errors } = await openPage("/mixed");
  await settle(page, "apex-grid-enterprise");
  checkOneCore("both at once", await oneCore(page), { community: 1, enterprise: 1 });
  checkErrors("load order C", errors);
  await page.close();
}

// Whether each enterprise grid on the page paints the trial watermark.
function watermarks(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll("apex-grid-enterprise")].map((el) => {
      let found = false;
      (function walk(r) {
        if (r.querySelector("[part~=license-watermark]")) found = true;
        r.querySelectorAll("*").forEach((n) => n.shadowRoot && walk(n.shadowRoot));
      })(el.shadowRoot ?? el);
      return found || !!el.querySelector("[part~=license-watermark]");
    })
  );
}

const menuItemTexts = (page) => page.locator(".apex-grid-context-menu [role=menuitem]").allInnerTexts();

// --- Context menu and range selection options, set from .NET ---------------------
{
  const { page, errors } = await openPage("/enterprise-options");
  await settle(page, "apex-grid-enterprise");
  const grid = page.locator("apex-grid-enterprise").first();
  const log = () => page.locator("#options-log").innerText();
  const props = () =>
    page.evaluate(() => {
      const el = document.querySelector("apex-grid-enterprise");
      return { rangeSelection: el.rangeSelection, contextMenu: el.contextMenu };
    });

  // ReplaceDefaultItems: only the .NET cell items, the submenu parent among them
  await grid.locator("apex-grid-cell", { hasText: "Alan Turing" }).first().click({ button: "right" });
  await page.waitForTimeout(500);
  const cellItems = (await menuItemTexts(page)).map((t) => t.replace(/\W+$/, ""));
  const parents = await page.locator(".apex-grid-context-menu [aria-haspopup=menu]").count();
  if (JSON.stringify(cellItems) !== '["Flag row","Copy as"]' || parents !== 1)
    failures.push(`ReplaceDefaultItems cell menu was ${JSON.stringify(cellItems)} with ${parents} submenu parent(s)`);
  else {
    // the Submenu opens a second menu, and its leaf raises OnContextMenuItemClick
    await page.locator(".apex-grid-context-menu [role=menuitem]", { hasText: "Copy as" }).click();
    await page.waitForTimeout(400);
    const child = page.locator(".apex-grid-context-menu").nth(1);
    const childItems = await child.locator("[role=menuitem]").allInnerTexts();
    if (JSON.stringify(childItems) !== '["Name","Salary"]')
      failures.push(`the Copy as submenu showed ${JSON.stringify(childItems)}`);
    else {
      await child.locator("[role=menuitem]", { hasText: "Salary" }).click();
      await page.waitForTimeout(600);
      if (!/contextMenu: copy-salary kind=cell column=name row=Alan Turing/.test(await log()))
        failures.push(`the submenu leaf did not reach OnContextMenuItemClick (log: ${JSON.stringify(await log())})`);
      else
        console.log(
          `[context-menu options] ReplaceDefaultItems: ${JSON.stringify(cellItems)}; Copy as > Salary -> copy-salary`
        );
    }
  }
  await page.keyboard.press("Escape");

  // Target: a header shows only the header item
  await grid.locator("apex-grid-header", { hasText: "Salary" }).first().click({ button: "right" });
  await page.waitForTimeout(500);
  const headerItems = await menuItemTexts(page);
  if (JSON.stringify(headerItems) !== '["Describe column"]')
    failures.push(`the header menu showed ${JSON.stringify(headerItems)}, expected only "Describe column"`);
  else {
    await page.locator(".apex-grid-context-menu [role=menuitem]", { hasText: "Describe column" }).click();
    await page.waitForTimeout(600);
    if (!/contextMenu: describe-column kind=header column=salary/.test(await log()))
      failures.push(`the header item did not reach OnContextMenuItemClick (log: ${JSON.stringify(await log())})`);
    else console.log(`[context-menu options] header Target: ["Describe column"] -> describe-column, column salary`);
  }
  await page.keyboard.press("Escape");

  // RangeSelection = false: SelectRangeAsync selects nothing. Turned on after the first render, it does.
  const before = await props();
  await page.click("#select-range");
  await page.waitForTimeout(400);
  await page.click("#read-bounds");
  await page.waitForTimeout(400);
  const boundsOff = await page.locator("#range-bounds").innerText();
  await page.click("#toggle-range");
  await page.waitForTimeout(500);
  const after = await props();
  await page.click("#select-range");
  await page.waitForTimeout(500);
  await page.click("#read-bounds");
  await page.waitForTimeout(400);
  const boundsOn = await page.locator("#range-bounds").innerText();
  if (before.rangeSelection !== false || boundsOff !== "none")
    failures.push(`RangeSelection=false did not turn range selection off (element ${before.rangeSelection}, range ${boundsOff})`);
  else if (after.rangeSelection !== true || boundsOn !== "0-1" || !/rangeChanged: 2 cells, sum 255000/.test(await log()))
    failures.push(`RangeSelection=true after the first render did not apply (element ${after.rangeSelection}, range ${boundsOn})`);
  else console.log(`[range-selection options] off: no range; on after the first render: rows 0-1, sum 255000`);

  // ContextMenu Enabled = false after the first render: no menu opens
  await page.click("#toggle-menu");
  await page.waitForTimeout(500);
  await grid.locator("apex-grid-cell", { hasText: "Ada Lovelace" }).first().click({ button: "right" });
  await page.waitForTimeout(500);
  const offItems = await menuItemTexts(page);
  const offProps = await props();
  if (offItems.length || offProps.contextMenu !== false)
    failures.push(`ContextMenu Enabled=false still opened ${JSON.stringify(offItems)} (element ${offProps.contextMenu})`);
  else console.log(`[context-menu options] Enabled=false after the first render: no menu opens`);
  checkErrors("options page", errors);
  await page.close();
}

// --- A module subset, through ApexGrid:Modules ----------------------------------
{
  const { page, errors } = await openPage("/enterprise", {
    settings: { ApexGrid: { LicenseKey: "", Modules: "Grouping, Aggregation" } },
  });
  await settle(page, "apex-grid-enterprise");
  const grids = await page.evaluate(() =>
    [...document.querySelectorAll("apex-grid-enterprise")].map((el) => ({
      groups: el.getGroups().map((g) => [g.label, g.aggregates?.salary?.sum]),
      pivoting: el.isPivoting,
      totals: Object.keys(el.getTotals() ?? {}).length,
    }))
  );
  await page
    .locator("apex-grid-enterprise")
    .first()
    .locator("apex-grid-cell", { hasText: "Alan Turing" })
    .first()
    .click({ button: "right" });
  await page.waitForTimeout(500);
  const menu = await menuItemTexts(page);
  await page.keyboard.press("Escape");
  await page.click("#select-salaries");
  await page.waitForTimeout(600);
  const rangeCount = await page.locator("#range-count").innerText();
  if (JSON.stringify(grids[0]?.groups?.[0]) !== '["Engineering",405000]')
    failures.push(`with Grouping and Aggregation selected, grouping did not work (got ${JSON.stringify(grids[0])})`);
  else if (grids[1]?.totals || grids[2]?.pivoting || menu.length || rangeCount !== "0")
    failures.push(
      `modules outside "Grouping, Aggregation" still worked (totals ${grids[1]?.totals}, ` +
        `pivoting ${grids[2]?.pivoting}, menu ${JSON.stringify(menu)}, range ${rangeCount})`
    );
  else console.log(`[modules] "Grouping, Aggregation": grouping with subtotals; no total row, pivot, menu or range`);
  checkErrors("module subset", errors);
  await page.close();
}

// --- The license key, through AddApexGridEnterprise ------------------------------
{
  const subtle = globalThis.crypto.subtle;
  const b64 = (buf) => Buffer.from(new Uint8Array(buf)).toString("base64");
  const pair = await subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const spki = b64(await subtle.exportKey("spki", pair.publicKey));
  // the apex-commons key format: APEX- and base64 JSON of the license data with an ECDSA P-256
  // signature over it
  const mint = async (expiryDate) => {
    const data = { issueDate: "2020-01-01", expiryDate, plan: "enterprise" };
    const signed = new TextEncoder().encode(`v1|${data.issueDate}|${data.expiryDate}|${data.plan}|`);
    const sig = await subtle.sign({ name: "ECDSA", hash: "SHA-256" }, pair.privateKey, signed);
    return "APEX-" + Buffer.from(JSON.stringify({ ...data, sig: b64(sig) })).toString("base64");
  };
  const valid = await mint("2999-01-01");
  const cases = [
    { label: "valid key", key: valid, path: "/enterprise", grids: 3, watermark: false },
    { label: "valid key, mixed page", key: valid, path: "/mixed", grids: 1, watermark: false },
    { label: "invalid key", key: "APEX-notavalidlicensekey", path: "/enterprise", grids: 3, watermark: true },
    { label: "expired key", key: await mint("2021-01-01"), path: "/enterprise", grids: 3, watermark: true },
  ];
  for (const c of cases) {
    const { page, errors, consoleLog } = await openPage(c.path, {
      settings: { ApexGrid: { LicenseKey: c.key } },
      signingKeySpki: spki,
    });
    await settle(page, "apex-grid-enterprise");
    const marks = await watermarks(page);
    const leaked = consoleLog.filter((m) => m.text.includes(c.key) || m.text.includes(c.key.slice(5, 25)));
    const licenseErrors = errors.filter((e) => e.startsWith("[Apex]"));
    const otherErrors = errors.filter((e) => !e.startsWith("[Apex]"));
    if (marks.length !== c.grids || marks.some((m) => m !== c.watermark))
      failures.push(`[license ${c.label}] watermarks ${JSON.stringify(marks)}, expected ${c.watermark} on ${c.grids} grid(s)`);
    else if (leaked.length) failures.push(`[license ${c.label}] the key appears in the console: ${JSON.stringify(leaked)}`);
    else if (c.watermark && licenseErrors.length !== 1)
      failures.push(`[license ${c.label}] expected one [Apex] console error, got ${JSON.stringify(licenseErrors)}`);
    else if (!c.watermark && licenseErrors.length)
      failures.push(`[license ${c.label}] unexpected console errors ${JSON.stringify(licenseErrors)}`);
    else
      console.log(
        `[license] ${c.label} on ${c.path}: watermark ${c.watermark ? "kept" : "gone"} on ${c.grids} grid(s)` +
          (licenseErrors.length ? `, console error ${JSON.stringify(licenseErrors[0].slice(0, 50))}` : "") +
          ", key not logged"
      );
    checkErrors(`license ${c.label}`, otherErrors);
    await page.close();
  }
}

await browser.close();

if (failures.length) {
  console.error("\nENTERPRISE SMOKE FAILED:\n" + failures.map((f) => "  - " + f).join("\n"));
  process.exit(1);
}
console.log(
  "\nEnterprise smoke passed: one apex-grid core in every load order; grouping, aggregation, the " +
    "context menu, the total row, range selection, XLSX export and the pivot all round-tripped " +
    "across the C# <-> element bridge, as did the menu and range options, a module subset and " +
    "the license key."
);
