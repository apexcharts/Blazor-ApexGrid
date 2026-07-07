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

// No new console/page errors should have appeared during the interactions.
const newErrors = pageErrors.slice(errCountBefore);
if (newErrors.length) failures.push(`errors during interactions: ${JSON.stringify(newErrors)}`);

// --- Tree data + master-detail page -----------------------------------------
// Both features rely on interop that supplies a callback to the web component: tree builds
// getDataPath from a row field, and master-detail builds a detailTemplate that returns a DOM
// node from an HTML string. Verify both grids render and the detail expansion round-trips.
const treeErrBefore = pageErrors.length;
await page.goto(BASE + "/tree", { waitUntil: "domcontentloaded" });
await page.waitForSelector("apex-grid", { timeout: 90000 }).catch(() => {});
await page.waitForTimeout(2500);

const grids = await page.evaluate(() => document.querySelectorAll("apex-grid").length);
const treeRows = await countTagDeep("apex-grid-row");
if (grids !== 2) failures.push(`expected 2 grids on /tree (got ${grids})`);
if (treeRows === 0) failures.push("tree/detail page rendered no rows");
console.log(`[tree-page] grids=${grids} rows=${treeRows}`);

// Master-detail: "Expand all" -> element.expandAllRows(); rowExpanded round-trips to C#.
await page.getByRole("button", { name: "Expand all", exact: true }).nth(1).click();
await page.waitForTimeout(700);
if (!/rowExpanded/i.test(await page.locator("#event-log").innerText()))
  failures.push("rowExpanded event did not round-trip to C# (master-detail)");
else console.log(`[master-detail] rowExpanded round-tripped`);

const treeErrors = pageErrors.slice(treeErrBefore);
if (treeErrors.length) failures.push(`errors on /tree: ${JSON.stringify(treeErrors)}`);

await browser.close();

if (failures.length) {
  console.error("\nE2E SMOKE FAILED:\n" + failures.map((f) => "  - " + f).join("\n"));
  process.exit(1);
}
console.log(
  "\nE2E smoke passed: grid registered and rendered; selection, quick filter, column pinning, " +
    "and getState all round-tripped across the C# <-> element bridge."
);
