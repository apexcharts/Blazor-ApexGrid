/*! Blazor-ApexGrid interop bridge (ES module) */
//
// Importing the bundle runs apex-grid's setup(): it registers the <apex-grid> custom element (and
// its sub-components) and adopts a default host stylesheet so the row virtualizer has a bounded
// height. The bundle is fully self-contained (lit, igniteui, etc. are bundled in).
import "./apex-grid.bundle.js?ver=3.3.0";

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
};

function chartOf(elementId) {
  const el = grids[elementId];
  if (!el) throw new Error(`apex-grid instance not found: ${elementId}`);
  return el;
}

// Data and columns are set as JS *properties* on the element (arrays of objects), not attributes.
export async function init(elementId, dataJson, columnsJson, configJson, dotNetRef) {
  await customElements.whenDefined("apex-grid");
  const el = document.getElementById(elementId);
  if (!el) {
    console.error("apex-grid element not found:", elementId);
    return false;
  }

  el.columns = JSON.parse(columnsJson);

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
  if (el) el.columns = JSON.parse(columnsJson);
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
  chartOf(elementId).updateColumns(JSON.parse(columnsJson));
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

export function destroy(elementId) {
  cleanups[elementId]?.();
  delete cleanups[elementId];
  delete grids[elementId];
}
