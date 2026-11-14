/*! Blazor-ApexGrid interop bridge (ES module) */
//
// Importing the bundle runs apex-grid's setup(): it registers the <apex-grid> custom element (and
// its sub-components) and adopts a default host stylesheet so the row virtualizer has a bounded
// height. The bundle is fully self-contained (lit and its helpers are bundled in), and it shares
// its core and Lit with Blazor-ApexGrid-Enterprise, whose interop module imports this one first
// (see build/shared.mjs), so a page holds one core whichever package loads first.
//
// ?ver= is this package's version: the vendored files can change in a release that keeps the
// same apex-grid version, and the cache key has to change with them.
import "./apex-grid.bundle.js?ver=1.4.0";

// pending or settled load of the Ignite UI add-on (loaded at most once)
let igniteUILoad = null;

// Load the apex-grid Ignite UI add-on. It registers on a shared globalThis slot, so every grid on
// the page follows the Ignite UI theme, including grids connected before it loaded. Resolves to
// false (and logs) when the file cannot be loaded, so a missing add-on never blocks a grid.
export function loadIgniteUI() {
  if (!igniteUILoad) {
    // keep ?ver= in step with the core bundle import above
    igniteUILoad = import("./apex-grid.ignite-ui.bundle.js?ver=1.4.0").then(
      () => true,
      (error) => {
        console.error("failed to load the apex-grid Ignite UI add-on:", error);
        return false;
      }
    );
  }
  return igniteUILoad;
}

// grid instances and their event-listener cleanups, keyed by element id
const grids = {};
const cleanups = {};

// DOM CustomEvent name -> Blazor [JSInvokable] handler
const EVENT_HANDLERS = {
  // data pipeline + selection (PR2)
  sorting: "HandleSorting",
  sorted: "HandleSorted",
  filtering: "HandleFiltering",
  filtered: "HandleFiltered",
  pageChanging: "HandlePageChanging",
  pageChanged: "HandlePageChanged",
  quickFilterChanging: "HandleQuickFilterChanging",
  quickFilterChanged: "HandleQuickFilterChanged",
  rowSelecting: "HandleRowSelecting",
  rowSelected: "HandleRowSelected",
  stateChanged: "HandleStateChanged",
  // column operations
  columnPinning: "HandleColumnPinning",
  columnPinned: "HandleColumnPinned",
  columnMoving: "HandleColumnMoving",
  columnMoved: "HandleColumnMoved",
  // cell editing
  cellValueChanging: "HandleCellValueChanging",
  cellValueChanged: "HandleCellValueChanged",
  cellValidationFailed: "HandleCellValidationFailed",
  historyChanged: "HandleHistoryChanged",
  rowEditStarted: "HandleRowEditStarted",
  rowEditEnded: "HandleRowEditEnded",
  // row pinning / reordering
  rowPinning: "HandleRowPinning",
  rowPinned: "HandleRowPinned",
  rowMoving: "HandleRowMoving",
  rowMoved: "HandleRowMoved",
  // row detail expansion / tree
  rowExpanding: "HandleRowExpanding",
  rowExpanded: "HandleRowExpanded",
  treeRowExpanding: "HandleTreeRowExpanding",
  treeRowExpanded: "HandleTreeRowExpanded",
};

// Escape a value for safe interpolation into a detail-template HTML string.
function escapeHtml(v) {
  return String(v ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

// Build the core's tree config from our serializable form: getDataPath reads a row field.
function buildTreeConfig(cfg) {
  const tree = {
    enabled: cfg.enabled,
    getDataPath: (row) => row?.[cfg.pathKey] ?? [],
  };
  if (cfg.groupColumnKey) tree.groupColumnKey = cfg.groupColumnKey;
  if (cfg.defaultExpanded !== undefined && cfg.defaultExpanded !== null)
    tree.defaultExpanded = cfg.defaultExpanded;
  if (typeof cfg.childIndent === "number") tree.childIndent = cfg.childIndent;
  return tree;
}

// Build the core's expansion config: detailTemplate returns a DOM node rendered from an
// author-supplied HTML string, with {field} tokens replaced by the row's escaped values.
function buildExpansionConfig(cfg) {
  const html = cfg.detailTemplateHtml || "";
  const expansion = {
    enabled: cfg.enabled,
    detailTemplate: ({ data }) => {
      const node = document.createElement("div");
      node.innerHTML = html.replace(/\{(\w+)\}/g, (_, key) => escapeHtml(data?.[key]));
      return node;
    },
  };
  if (typeof cfg.showToggleColumn === "boolean") expansion.showToggleColumn = cfg.showToggleColumn;
  if (Array.isArray(cfg.exportParts)) expansion.exportParts = cfg.exportParts;
  return expansion;
}

// A `type: 'chart'` column draws with the app's own ApexCharts (8.4.1 or later): this package
// does not bundle it, and the core only looks for a global `window.ApexCharts`. Without one the
// cells stay empty, so say which columns are affected and how to fix it rather than leave a blank
// column. Checked on every column push; a page still loading gets until its load event, as the
// core does, so an async or deferred script tag still counts.
let chartWarned = false;
function checkChartColumns(columns) {
  if (chartWarned || !Array.isArray(columns)) return;
  const keys = columns.filter((c) => c?.type === "chart").map((c) => c.key);
  if (!keys.length) return;
  const check = () => {
    if (chartWarned || typeof globalThis.ApexCharts === "function") return;
    chartWarned = true;
    console.error(
      `Blazor-ApexGrid: the chart column(s) ${keys.join(", ")} need ApexCharts 8.4.1 or later, ` +
        "which Blazor-ApexGrid does not bundle. Load it on the page with a script tag that " +
        "defines window.ApexCharts (in index.html or App.razor). The cells stay empty until then."
    );
  };
  if (document.readyState === "complete") check();
  else window.addEventListener("load", check, { once: true });
}

function chartOf(elementId) {
  const el = grids[elementId];
  if (!el) throw new Error(`apex-grid instance not found: ${elementId}`);
  return el;
}

// Data and columns are set as JS *properties* on the element (arrays of objects), not attributes.
// tagName lets a component that renders another grid element (one that extends <apex-grid>)
// reuse this bridge unchanged. applyConfig is for a module that wraps this one (a derived
// component's ModulePath), never passed from .NET: it is called as applyConfig(el, cfg, dotNetRef)
// after the keys below and before the data, so config keys this module does not know (those a
// derived component adds through ExtendConfig) land in the same update as the rest.
export async function init(elementId, dataJson, columnsJson, configJson, dotNetRef, tagName, applyConfig) {
  await customElements.whenDefined(tagName || "apex-grid");
  const el = document.getElementById(elementId);
  if (!el) {
    console.error("apex-grid element not found:", elementId);
    return false;
  }

  el.columns = JSON.parse(columnsJson);
  checkChartColumns(el.columns);

  // apply grid-wide config (sort/pagination/selection/editing/rows) before data
  if (configJson) {
    const cfg = JSON.parse(configJson);
    if (cfg.sortConfiguration) el.sortConfiguration = cfg.sortConfiguration;
    if (cfg.pagination) el.pagination = cfg.pagination;
    if (cfg.selection) el.selection = cfg.selection;
    if (cfg.editing) el.editing = cfg.editing;
    if (cfg.rowPinning) el.rowPinning = cfg.rowPinning;
    if (cfg.rowReordering) el.rowReordering = cfg.rowReordering;
    if (typeof cfg.columnReordering === "boolean") el.columnReordering = cfg.columnReordering;
    // Every data push from .NET is a fresh array of fresh objects, so rows can only be matched
    // across a push by a key field.
    if (cfg.rowIdKey) el.rowId = (row) => row?.[cfg.rowIdKey];
    if (cfg.tree && cfg.tree.enabled) el.tree = buildTreeConfig(cfg.tree);
    if (cfg.expansion && cfg.expansion.enabled) el.expansion = buildExpansionConfig(cfg.expansion);
    if (typeof applyConfig === "function") applyConfig(el, cfg, dotNetRef);
  }

  el.data = JSON.parse(dataJson);
  grids[elementId] = el;

  if (dotNetRef) {
    const added = [];
    for (const [eventName, handler] of Object.entries(EVENT_HANDLERS)) {
      const listener = (e) => dotNetRef.invokeMethodAsync(handler, e.detail ?? {});
      el.addEventListener(eventName, listener);
      added.push([eventName, listener]);
    }
    cleanups[elementId] = () =>
      added.forEach(([eventName, listener]) => el.removeEventListener(eventName, listener));
  }

  return true;
}

export function setData(elementId, dataJson) {
  const el = grids[elementId];
  if (el) el.data = JSON.parse(dataJson);
}

export function setColumns(elementId, columnsJson) {
  const el = grids[elementId];
  if (!el) return;
  el.columns = JSON.parse(columnsJson);
  checkChartColumns(el.columns);
}

// --- Sorting -----------------------------------------------------------------
export function sort(elementId, expressionsJson) {
  chartOf(elementId).sort(JSON.parse(expressionsJson));
}
export function clearSort(elementId, key) {
  chartOf(elementId).clearSort(key || undefined);
}

// --- Filtering ---------------------------------------------------------------
export function filter(elementId, expressionsJson) {
  chartOf(elementId).filter(JSON.parse(expressionsJson));
}
export function clearFilter(elementId, key) {
  chartOf(elementId).clearFilter(key || undefined);
}
export function setQuickFilter(elementId, value) {
  return chartOf(elementId).setQuickFilter(value ?? "");
}

// --- Pagination --------------------------------------------------------------
// A pagination config changed in .NET after init. The grid tracks the page and page size itself
// once the user pages, and assigning `pagination` re-applies `page` and `pageSize` when present,
// so send them only when .NET changed them; every other field (paginator, enabled, mode,
// totalItems, pageSizeOptions) is replaced as given, and a field set to null goes back to its
// default. A null config turns pagination off.
export function setPagination(elementId, nextJson, previousJson) {
  const el = grids[elementId];
  if (!el) return;
  const next = JSON.parse(nextJson) ?? {};
  const previous = (previousJson && JSON.parse(previousJson)) ?? {};
  for (const key of ["page", "pageSize"]) {
    if (next[key] === previous[key]) delete next[key];
  }
  el.pagination = next;
}
export function gotoPage(elementId, page) {
  return chartOf(elementId).gotoPage(page);
}
export function nextPage(elementId) {
  return chartOf(elementId).nextPage();
}
export function previousPage(elementId) {
  return chartOf(elementId).previousPage();
}
export function firstPage(elementId) {
  return chartOf(elementId).firstPage();
}
export function lastPage(elementId) {
  return chartOf(elementId).lastPage();
}
export function setPageSize(elementId, size) {
  return chartOf(elementId).setPageSize(size);
}

// --- Selection ---------------------------------------------------------------
export function getSelectedRows(elementId) {
  return grids[elementId]?.selectedRows ?? [];
}
export function selectAllRows(elementId) {
  return chartOf(elementId).selectAllRows();
}
export function clearSelection(elementId) {
  return chartOf(elementId).clearSelection();
}

// --- Column operations -------------------------------------------------------
export function pinColumn(elementId, key, position) {
  return chartOf(elementId).pinColumn(key, position ?? null);
}
export function unpinColumn(elementId, key) {
  return chartOf(elementId).unpinColumn(key);
}
export function moveColumn(elementId, fromKey, toKey, position) {
  return chartOf(elementId).moveColumn(fromKey, toKey, position || "before");
}
export function updateColumns(elementId, columnsJson) {
  const columns = JSON.parse(columnsJson);
  chartOf(elementId).updateColumns(columns);
  checkChartColumns(columns);
}

// --- Editing -----------------------------------------------------------------
export function editCell(elementId, rowIndex, columnKey) {
  return chartOf(elementId).editCell(rowIndex, columnKey);
}
export function editRow(elementId, rowIndex) {
  return chartOf(elementId).editRow(rowIndex);
}
export function commitEdit(elementId) {
  return chartOf(elementId).commitEdit();
}
export function cancelEdit(elementId) {
  chartOf(elementId).cancelEdit();
}
export function undo(elementId) {
  chartOf(elementId).undo();
}
export function redo(elementId) {
  chartOf(elementId).redo();
}
export function clearHistory(elementId) {
  chartOf(elementId).clearHistory();
}
// Edits name their row by data[] index, resolved to the record so rows on other pages, pinned rows
// and rows under a collapsed tree parent are reachable.
export function applyEdits(elementId, editsJson) {
  const el = chartOf(elementId);
  const data = el.data ?? [];
  const edits = JSON.parse(editsJson);
  const resolved = [];
  let missing = 0;
  for (const e of edits) {
    const row = data[e.dataIndex];
    if (row === undefined) missing++;
    else resolved.push({ row, column: e.column, value: e.value });
  }
  const result = el.applyEdits(resolved);
  return { ...result, skipped: result.skipped + missing };
}
export function canUndo(elementId) {
  return grids[elementId]?.canUndo ?? false;
}
export function canRedo(elementId) {
  return grids[elementId]?.canRedo ?? false;
}

// --- State -------------------------------------------------------------------
export function getState(elementId) {
  return chartOf(elementId).getState();
}
export function setState(elementId, stateJson) {
  return chartOf(elementId).setState(JSON.parse(stateJson));
}
export function getSchema(elementId) {
  return chartOf(elementId).getSchema();
}

// --- Row pinning / reordering ------------------------------------------------
// Row APIs identify rows by object reference; we resolve the current data[] index.
export function pinRow(elementId, index, position) {
  const el = chartOf(elementId);
  const row = el.data?.[index];
  return row ? el.pinRow(row, position || "top") : false;
}
export function unpinRow(elementId, index) {
  const el = chartOf(elementId);
  const row = el.data?.[index];
  return row ? el.unpinRow(row) : false;
}
export function getPinnedRows(elementId) {
  return grids[elementId]?.pinnedRows ?? { top: [], bottom: [] };
}
export function moveRow(elementId, from, to, position) {
  return chartOf(elementId).moveRow(from, to, position || "before");
}

// --- Row detail expansion ----------------------------------------------------
function rowAt(elementId, index) {
  const el = chartOf(elementId);
  return { el, row: el.data?.[index] };
}
export function expandRow(elementId, index) {
  const { el, row } = rowAt(elementId, index);
  return row ? el.expandRow(row) : false;
}
export function collapseRow(elementId, index) {
  const { el, row } = rowAt(elementId, index);
  return row ? el.collapseRow(row) : false;
}
export function toggleRowExpansion(elementId, index) {
  const { el, row } = rowAt(elementId, index);
  return row ? el.toggleRowExpansion(row) : false;
}
export function expandAllRows(elementId) {
  return chartOf(elementId).expandAllRows();
}
export function collapseAllRows(elementId) {
  return chartOf(elementId).collapseAllRows();
}
export function isRowExpanded(elementId, index) {
  const { el, row } = rowAt(elementId, index);
  return row ? el.isRowExpanded(row) : false;
}

// --- Tree data ---------------------------------------------------------------
export function toggleTreeRow(elementId, index) {
  const { el, row } = rowAt(elementId, index);
  return row ? el.toggleTreeRow(row) : false;
}
export function expandTreeRow(elementId, index) {
  const { el, row } = rowAt(elementId, index);
  return row ? el.expandTreeRow(row) : false;
}
export function collapseTreeRow(elementId, index) {
  const { el, row } = rowAt(elementId, index);
  return row ? el.collapseTreeRow(row) : false;
}
export function expandAllTreeRows(elementId) {
  return chartOf(elementId).expandAllTreeRows();
}
export function collapseAllTreeRows(elementId) {
  return chartOf(elementId).collapseAllTreeRows();
}
export function isTreeRowExpanded(elementId, index) {
  const { el, row } = rowAt(elementId, index);
  return row ? el.isTreeRowExpanded(row) : false;
}

export function destroy(elementId) {
  cleanups[elementId]?.();
  delete cleanups[elementId];
  delete grids[elementId];
}
