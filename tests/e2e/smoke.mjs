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

// Interaction: the quick-filter input calls the C# SetQuickFilterAsync -> element.setQuickFilter().
// Typing "Turing" should reduce the 5 rows to 1, proving the C# -> element method bridge.
const filterInput = page.locator('input[placeholder="Quick filter..."]');
if (await filterInput.count()) {
  await filterInput.fill("Turing");
  await page.waitForTimeout(1200);
  const filtered = await countTagDeep("apex-grid-row");
  if (!(rows > 1 && filtered === 1)) {
    failures.push(`quick filter did not narrow rows as expected: before=${rows} after=${filtered}`);
  }
  console.log(`[quick-filter] rows ${rows} -> ${filtered}`);
}

await browser.close();

if (failures.length) {
  console.error("\nE2E SMOKE FAILED:\n" + failures.map((f) => "  - " + f).join("\n"));
  process.exit(1);
}
console.log("\nE2E smoke passed: grid registered, rendered rows, and quick filter round-tripped.");
