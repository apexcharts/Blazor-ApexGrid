/*! Blazor-ApexGrid interop bridge (ES module) */
//
// Importing the bundle runs apex-grid's setup(): it registers the <apex-grid> custom element (and
// its sub-components) and adopts a default host stylesheet so the row virtualizer has a bounded
// height. The bundle is fully self-contained (lit, igniteui, etc. are bundled in).
import "./apex-grid.bundle.js?ver=3.3.0";

// grid instances keyed by element id
const grids = {};

// Data and columns are set as JS *properties* on the element (arrays of objects), not attributes.
export async function init(elementId, dataJson, columnsJson) {
  await customElements.whenDefined("apex-grid");
  const el = document.getElementById(elementId);
  if (!el) {
    console.error("apex-grid element not found:", elementId);
    return false;
  }
  el.columns = JSON.parse(columnsJson);
  el.data = JSON.parse(dataJson);
  grids[elementId] = el;
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

export function setQuickFilter(elementId, value) {
  return grids[elementId]?.setQuickFilter(value ?? "");
}

export function getSelectedRows(elementId) {
  return grids[elementId]?.selectedRows ?? [];
}

export function destroy(elementId) {
  delete grids[elementId];
}
