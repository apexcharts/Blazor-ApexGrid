// Headless browser smoke test for the Blazor-ApexGrid sample.
//
// Why this exists: apex-grid is a Lit web component shipped as unbundled ESM. We bundle it (with its
// dependency tree) into a single self-contained module and register <apex-grid> via setup(). A great
// deal can only be verified at runtime: that esbuild kept the custom-element registration side effect
// (it is tree-shaken away by default), that the element renders rows from the .data/.columns JS
// properties we set, and that a C# -> element method call round-trips. This test drives the actual
// WASM app in a real browser and fails CI on any of those regressions.
//
// The grid renders rows as nested custom elements (<apex-grid-row>) with their own shadow roots, so
// assertions pierce shadow DOM.
//
// Usage:
//   BASE_URL=http://localhost:5186 node smoke.mjs
//   PW_CHANNEL=chrome node smoke.mjs   # drive an installed Chrome instead of bundled chromium
let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  ({ chromium } = await import("playwright-core"));
}

const BASE = process.env.BASE_URL || "http://localhost:5186";
const channel = process.env.PW_CHANNEL;

const failures = [];
const launchOpts = channel ? { channel, headless: true } : { headless: true };
const browser = await chromium.launch(launchOpts);
const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });

const pageErrors = [];
page.on("console", (m) => { if (m.type() === "error") pageErrors.push(m.text().slice(0, 200)); });
page.on("pageerror", (e) => pageErrors.push("PAGEERROR: " + e.message.slice(0, 200)));

// count elements of a given tag across all (nested) shadow roots
function countTagDeep(tag) {
  return page.evaluate((t) => {
    const seen = new Set();
    let n = 0;
    (function walk(root) {
      root.querySelectorAll("*").forEach((el) => {
        if (seen.has(el)) return;
        seen.add(el);
        if (el.tagName.toLowerCase() === t) n++;
        if (el.shadowRoot) walk(el.shadowRoot);
      });
    })(document);
    return n;
  }, tag);
}

await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
await page.waitForSelector("apex-grid", { timeout: 90000 }).catch(() => {});
await page.waitForTimeout(3000);

const defined = await page.evaluate(() => !!customElements.get("apex-grid"));
const errUi = await page.evaluate(() => {
  const eu = document.querySelector("#blazor-error-ui");
  return eu ? getComputedStyle(eu).display !== "none" : false;
});
const rows = await countTagDeep("apex-grid-row");

if (!defined) failures.push("<apex-grid> custom element is not registered");
if (errUi) failures.push("Blazor error UI is visible");
if (rows === 0) failures.push("grid rendered no rows");
if (pageErrors.length) failures.push(`console/page errors: ${JSON.stringify(pageErrors)}`);
console.log(`[render] defined=${defined} rows=${rows} errUi=${errUi} errors=${pageErrors.length}`);

// RowIdKey="name" reaches the element as a rowId resolver reading that field.
const rowId = await page.evaluate(() => {
  const el = document.querySelector("apex-grid");
  return typeof el?.rowId === "function" ? el.rowId(el.data[0]) : null;
});
if (rowId !== "Ada Lovelace") failures.push(`RowIdKey did not set a rowId resolver (got ${rowId})`);
console.log(`[row-id] rowId(data[0]) = ${rowId}`);

const logText = () => page.locator("#event-log").innerText();
const errCountBefore = pageErrors.length;

// Exercise the C# -> element method bridge for sorting and paging (these should not throw).
await page.getByRole("button", { name: "Sort name ▲", exact: true }).click();
await page.waitForTimeout(500);
await page.getByRole("button", { name: "Next page", exact: true }).click();
await page.waitForTimeout(500);

// Selection: "Select all" -> element.selectAllRows(). This proves BOTH directions of the bridge:
// the C# method drives the element, and the resulting rowSelected event round-trips back to C#
// (updating the selected count and appending to the log).
await page.getByRole("button", { name: "Select all", exact: true }).click();
await page.waitForTimeout(800);
const selCount = parseInt(await page.locator("#sel-count").innerText(), 10) || 0;
if (!(selCount > 0)) failures.push(`select-all did not update the selected count (got ${selCount})`);
if (!/rowSelected/i.test(await logText())) failures.push("rowSelected event did not round-trip to C#");
console.log(`[selection] selected=${selCount}`);

// Quick filter: the input calls C# SetQuickFilterAsync -> element.setQuickFilter().
// Typing "Turing" narrows to the single matching row, proving the C# -> element method bridge.
const filterInput = page.locator('input[placeholder="Quick filter..."]');
if (await filterInput.count()) {
  await filterInput.fill("Turing");
  await page.waitForTimeout(1200);
  const filtered = await countTagDeep("apex-grid-row");
  if (filtered !== 1) failures.push(`quick filter did not narrow to 1 row (got ${filtered})`);
  console.log(`[quick-filter] rows -> ${filtered}`);
}

// Column pinning: the button calls C# PinColumnAsync -> element.pinColumn('name', 'start').
// The resulting columnPinned event round-trips back to C# and is appended to the log,
// proving both directions of the bridge for a column operation.
await page.getByRole("button", { name: "Pin Name column", exact: true }).click();
await page.waitForTimeout(600);
if (!/columnPinned/i.test(await logText())) failures.push("columnPinned event did not round-trip to C#");
console.log(`[column-pin] columnPinned round-tripped`);

// State persistence: "Save state" calls C# GetStateAsync -> element.getState(), and the
// returned JSON snapshot is marshaled back into C# (proving a data-returning method call).
await page.getByRole("button", { name: "Save state", exact: true }).click();
await page.waitForTimeout(400);
const stateLen = parseInt(await page.locator("#state-len").innerText(), 10) || 0;
if (!(stateLen > 0)) failures.push(`getState returned no snapshot (len ${stateLen})`);
console.log(`[state] snapshot length=${stateLen}`);

// Batch edits: "Everyone +1 year" calls C# ApplyEditsAsync with all 10 data indexes while the
// grid shows one filtered row of a 5-row page, so applied=10 proves rows outside the view are
// reached and the result tally is marshaled back into C#.
await page.getByRole("button", { name: "Everyone +1 year", exact: true }).click();
await page.waitForTimeout(600);
const applied = /applyEdits: applied=(\d+)/.exec(await logText());
if (!applied || applied[1] !== "10")
  failures.push(`applyEdits did not apply to all 10 rows (${applied ? applied[0] : "no log entry"})`);
else console.log(`[apply-edits] applied=10`);

// Pagination.Paginator = PaginatorLayout.Compact serializes to the core's 'compact' layout.
const paginator = await page.evaluate(() => document.querySelector("apex-grid")?.pagination?.paginator);
if (paginator !== "compact") failures.push(`Paginator did not reach the element as 'compact' (got ${paginator})`);
else console.log(`[paginator] compact`);

// ShowExport="true" and ExportFilename="people" render as show-export and export-filename, so the
// toolbar export menu downloads people.csv instead of the core default data.csv.
const exportProps = await page.evaluate(() => {
  const el = document.querySelector("apex-grid");
  return { showExport: el?.showExport, exportFilename: el?.exportFilename };
});
if (exportProps.showExport !== true || exportProps.exportFilename !== "people")
  failures.push(`ShowExport/ExportFilename did not reach the element (got ${JSON.stringify(exportProps)})`);
const grid = page.locator("apex-grid").first();
try {
  await grid.getByRole("button", { name: "Export", exact: true }).click();
  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 5000 }),
    grid.getByRole("menuitem").first().click(),
  ]);
  const name = download.suggestedFilename();
  if (name !== "people.csv") failures.push(`toolbar export downloaded ${name}, expected people.csv`);
  else console.log(`[export] toolbar menu downloaded ${name}`);
} catch (e) {
  failures.push(`toolbar export did not download: ${e.message.split("\n")[0]}`);
}

// ShowHeader is rendered as show-header="false" only when false, so toggling it reaches the
// element on change: true by default, false after "Hide header", true again after "Show header".
const showHeader = () => page.evaluate(() => document.querySelector("apex-grid")?.showHeader);
const headerStates = [await showHeader()];
await page.locator("#toggle-header").click();
await page.waitForTimeout(400);
headerStates.push(await showHeader());
await page.locator("#toggle-header").click();
await page.waitForTimeout(400);
headerStates.push(await showHeader());
if (JSON.stringify(headerStates) !== "[true,false,true]")
  failures.push(`ShowHeader did not toggle on the element as [true,false,true] (got ${JSON.stringify(headerStates)})`);
else console.log(`[show-header] true -> false -> true`);

// No new console/page errors should have appeared during the interactions.
const newErrors = pageErrors.slice(errCountBefore);
if (newErrors.length) failures.push(`errors during interactions: ${JSON.stringify(newErrors)}`);

// --- Tree data + row detail page -----------------------------------------
// Both features rely on interop that supplies a callback to the web component: tree builds
// getDataPath from a row field, and row detail builds a detailTemplate that returns a DOM
// node from an HTML string. Verify both grids render and the detail expansion round-trips.
// Navigate via the in-app nav link (client-side routing) rather than a fresh page load.
// This mirrors real usage and avoids the benign HTTP 404 that GitHub Pages returns for a
// deep link to a SPA route (it serves the 404.html host page; the app still boots and routes).
const treeErrBefore = pageErrors.length;
await page.getByRole("link", { name: "Tree & row detail" }).click();
await page.waitForSelector("apex-grid", { timeout: 90000 }).catch(() => {});
await page.waitForTimeout(2500);

const grids = await page.evaluate(() => document.querySelectorAll("apex-grid").length);
const treeRows = await countTagDeep("apex-grid-row");
if (grids !== 2) failures.push(`expected 2 grids on /tree (got ${grids})`);
if (treeRows === 0) failures.push("tree/detail page rendered no rows");
console.log(`[tree-page] grids=${grids} rows=${treeRows}`);

// RowRecycling="false" on the tree grid reaches the element as rowRecycling === false, and the
// detail grid, which leaves it unset, keeps the core default (true).
const recycling = await page.evaluate(() =>
  [...document.querySelectorAll("apex-grid")].map((el) => el.rowRecycling)
);
if (recycling[0] !== false || recycling[1] !== true)
  failures.push(`RowRecycling did not reach the elements as [false, true] (got ${JSON.stringify(recycling)})`);
else console.log(`[row-recycling] tree=false detail=true`);

// Row detail: "Expand all" -> element.expandAllRows(); rowExpanded round-trips to C#.
await page.getByRole("button", { name: "Expand all", exact: true }).nth(1).click();
await page.waitForTimeout(700);
if (!/rowExpanded/i.test(await page.locator("#event-log").innerText()))
  failures.push("rowExpanded event did not round-trip to C# (row detail)");
else console.log(`[row-detail] rowExpanded round-tripped`);

const treeErrors = pageErrors.slice(treeErrBefore);
if (treeErrors.length) failures.push(`errors on /tree: ${JSON.stringify(treeErrors)}`);

// GridDataType.Chart: ApexCharts is not bundled, so a chart column on a page without a global
// window.ApexCharts must say so in the console rather than render an empty column. Drive the
// interop module directly (the URL Blazor imported, so it is the same module instance) with a
// throwaway grid; this runs last because it logs an error on purpose.
const chartErrors = [];
page.on("console", (m) => { if (m.type() === "error") chartErrors.push(m.text()); });
const chartGuard = await page.evaluate(async () => {
  const m = await import("./_content/Blazor-ApexGrid/js/blazor-apexgrid.js?ver=5.0.0");
  const el = document.createElement("apex-grid");
  el.id = "chart-guard";
  el.style.height = "120px";
  document.body.append(el);
  const ok = await m.init(
    "chart-guard",
    JSON.stringify([{ trend: [1, 3, 2] }]),
    JSON.stringify([{ key: "trend", type: "chart", chart: { type: "line", height: 24 } }]),
    null,
    null,
    "apex-grid"
  );
  m.destroy("chart-guard");
  el.remove();
  return { ok, apexCharts: typeof globalThis.ApexCharts };
});
await page.waitForTimeout(300);
if (!chartGuard.ok) failures.push("chart-guard grid did not initialize");
if (chartGuard.apexCharts !== "function" && !chartErrors.some((t) => /Blazor-ApexGrid: the chart column\(s\) trend need ApexCharts/.test(t)))
  failures.push(`a chart column without ApexCharts logged no Blazor-ApexGrid error (got ${JSON.stringify(chartErrors)})`);
else console.log(`[chart-guard] missing ApexCharts reported for column 'trend'`);

await browser.close();

if (failures.length) {
  console.error("\nE2E SMOKE FAILED:\n" + failures.map((f) => "  - " + f).join("\n"));
  process.exit(1);
}
console.log(
  "\nE2E smoke passed: grid registered and rendered; selection, quick filter, column pinning, " +
    "getState, the export filename and the header toggle all round-tripped across the C# <-> " +
    "element bridge."
);
