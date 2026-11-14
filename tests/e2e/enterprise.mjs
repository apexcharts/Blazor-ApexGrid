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

async function openPage(path) {
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 }, acceptDownloads: true });
  await page.addInitScript(instrumentDefine);
  if (apexChartsJs)
    await page.route(APEXCHARTS_URL, (route) =>
      route.fulfill({ status: 200, contentType: "text/javascript", body: apexChartsJs })
    );
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 200)); });
  page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message.slice(0, 200)));
  // A deep link: the dev server serves the app for any route, so this loads the page's own
  // components first, which is what decides the load order.
  await page.goto(BASE + path, { waitUntil: "domcontentloaded" });
  return { page, errors };
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
    return {
      extendsCore: !!enterprise && Object.getPrototypeOf(enterprise) === core,
      registryHoldsCore:
        registry?.modules?.["apex-grid"]?.ApexGrid === core &&
        registry?.modules?.["apex-grid/internal"]?.ApexGrid === core,
      registryVersion: registry?.version ?? null,
      enterpriseIsGrid: enterprises.every((el) => el instanceof core),
      coreBundles,
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
      `[one-core ${label}] one core (apex-grid ${r.registryVersion}, 1 bundle URL, apex-grid-row defined once, ` +
        `1 row class); rows community=${JSON.stringify(r.communityRows)} enterprise=${JSON.stringify(r.enterpriseRows)}`
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

await browser.close();

if (failures.length) {
  console.error("\nENTERPRISE SMOKE FAILED:\n" + failures.map((f) => "  - " + f).join("\n"));
  process.exit(1);
}
console.log(
  "\nEnterprise smoke passed: one apex-grid core in every load order; grouping, aggregation, the " +
    "context menu, the total row, range selection, XLSX export and the pivot all round-tripped " +
    "across the C# <-> element bridge."
);
