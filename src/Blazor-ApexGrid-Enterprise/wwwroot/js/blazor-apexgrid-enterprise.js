/*! Blazor-ApexGrid-Enterprise interop bridge (ES module) */
//
// One apex-grid core per page. The enterprise bundle carries no core and no Lit of its own: it
// reads both from the registry that Blazor-ApexGrid's core bundle publishes when it loads (see
// build/shared.mjs in the repository). So Blazor-ApexGrid's interop module, which imports that
// bundle, is imported FIRST here: modules run in the order they are imported, so the core is
// registered before the enterprise bundle defines its class on top of it. A community ApexGrid on
// the same page imports the same core bundle URL (from inside Blazor-ApexGrid's module), and the
// browser runs a module URL once, so it does not matter which package's component renders first.
//
// ?ver= on each import is the version of the package that ships the file (both csproj builds
// check it).
import * as base from "../../Blazor-ApexGrid/js/blazor-apexgrid.js?ver=1.3.0";
import {
  ApexGridEnterprise,
  aggregationModule,
  contextMenuModule,
  groupingModule,
  pivotModule,
  rangeSelectionModule,
  totalRowModule,
} from "./apex-grid-enterprise.bundle.js?ver=0.1.0";

// Every other function (sorting, paging, editing, state, ...) is Blazor-ApexGrid's, unchanged: the
// enterprise element extends <apex-grid>. init and destroy below take precedence over these.
export * from "../../Blazor-ApexGrid/js/blazor-apexgrid.js?ver=1.3.0";

// ApexGridEnterpriseModules (.NET) ids -> apex-grid-enterprise feature modules
const MODULES = {
  aggregation: aggregationModule,
  grouping: groupingModule,
  pivot: pivotModule,
  totalRow: totalRowModule,
  rangeSelection: rangeSelectionModule,
  contextMenu: contextMenuModule,
};

let appliedLicense = null;

// Opts into the selected feature modules, registers <apex-grid-enterprise>, and applies the license
// key. Called by each enterprise grid before its first init. use() has to run before the element
// is registered, because each grid reads the module list when it is constructed, so the modules
// the first grid brings are the ones every grid gets; a later call can only add modules, for grids
// created after it. A null module list means all of them.
export function configure(moduleIds, licenseKey) {
  const ids = Array.isArray(moduleIds) ? moduleIds : Object.keys(MODULES);
  const modules = ids.map((id) => MODULES[id]).filter(Boolean);
  if (modules.length) ApexGridEnterprise.use(...modules);
  ApexGridEnterprise.register(); // registers <apex-grid> first if needed; a second call is a no-op
  if (licenseKey && licenseKey !== appliedLicense) {
    appliedLicense = licenseKey;
    ApexGridEnterprise.setLicense(licenseKey);
  }
}

// per grid: the element, the .NET reference, the config last applied (by key, as JSON) and the
// listener cleanup
const grids = {};

function gridOf(elementId) {
  const entry = grids[elementId];
  if (!entry) throw new Error(`apex-grid-enterprise instance not found: ${elementId}`);
  return entry.el;
}

// A group row without its leaves (which can be large and are the component's own rows anyway).
function groupInfo(meta, expanded) {
  if (!meta) return null;
  const info = {
    key: meta.key,
    field: meta.field,
    value: meta.value ?? null,
    label: meta.label,
    depth: meta.depth,
    count: meta.count,
    aggregates: meta.aggregates ?? {},
  };
  if (typeof expanded === "boolean") info.expanded = expanded;
  return info;
}

// .NET items (GridContextMenuItem) -> apex-grid-enterprise ContextMenuItem. A leaf's run raises
// OnContextMenuItemClick in .NET; an item with a submenu opens it instead.
function menuItems(items, target, entry) {
  return (items ?? [])
    .filter((item) => !item.target || item.target === target.kind)
    .map((item) => {
      const out = { id: item.id, label: item.label };
      if (item.disabled) out.disabled = true;
      if (item.separatorBefore) out.separatorBefore = true;
      if (Array.isArray(item.submenu) && item.submenu.length) {
        out.submenu = menuItems(item.submenu, target, entry);
      } else {
        out.run = (t) => {
          const index = t.row ? (entry.el.data ?? []).indexOf(t.row) : -1;
          entry.dotNetRef?.invokeMethodAsync("HandleContextMenuItemClick", {
            id: item.id,
            kind: t.kind,
            columnKey: String(t.column?.key ?? ""),
            rowIndex: typeof t.rowIndex === "number" ? t.rowIndex : null,
            dataIndex: index >= 0 ? index : null,
            row: index >= 0 ? t.row : null,
          });
        };
      }
      return out;
    });
}

// The enterprise properties a .NET config key sets, and the element's default for each, which a
// key set back to null restores.
const APPLIERS = {
  aggregations: (el, v) => (el.aggregations = v ?? {}),
  groupBy: (el, v) => (el.groupBy = v ?? []),
  groupingOptions: (el, v) => (el.groupingOptions = v ?? {}),
  totalRow: (el, v) => (el.totalRow = v ?? null),
  pivot: (el, v) => {
    // pivotOn last: an empty pivotOn turns the pivot off and restores the original columns
    el.pivotRows = v?.rows ?? [];
    el.pivotValues = v?.values ?? {};
    el.pivotOptions = v?.options ?? {};
    el.pivotOn = v?.on?.length ? v.on : "";
  },
  rangeSelection: (el, v) => (el.rangeSelection = v ?? true),
  contextMenu: (el, v) => (el.contextMenu = v?.enabled !== false),
};

// Applies the keys whose value changed since the last call. Only changes are applied, so a .NET
// re-render does not undo what the user did in the grid since (a group added from the context
// menu, a toggled group), and a key back at null restores the element's default.
function apply(entry, config) {
  entry.events = config.events ?? {};
  entry.menu = config.contextMenu ?? null;
  for (const [key, applier] of Object.entries(APPLIERS)) {
    const json = JSON.stringify(config[key] ?? null);
    if (json === (entry.applied[key] ?? "null")) continue;
    entry.applied[key] = json;
    applier(entry.el, config[key]);
  }
}

// Called by Blazor-ApexGrid's init with the parsed config, after the community keys and before the
// data, so the enterprise properties land in the same update.
function attach(el, cfg, dotNetRef) {
  const entry = { el, dotNetRef, applied: {}, events: {}, menu: null };
  const onOpening = (e) => {
    const menu = entry.menu;
    if (!menu || menu.enabled === false) return;
    const added = menuItems(menu.items, e.detail.target, entry);
    if (menu.replaceDefaultItems) e.detail.items.splice(0, e.detail.items.length);
    e.detail.items.push(...added);
  };
  const onRange = (e) => {
    if (entry.events.rangeChanged) dotNetRef?.invokeMethodAsync("HandleRangeChanged", e.detail ?? {});
  };
  const onGroup = (e) => {
    if (!entry.events.groupExpanded) return;
    const d = e.detail ?? {};
    dotNetRef?.invokeMethodAsync("HandleGroupExpanded", {
      key: d.key,
      expanded: !!d.expanded,
      group: groupInfo(d.meta, !!d.expanded),
    });
  };
  el.addEventListener("apex-context-menu-opening", onOpening);
  el.addEventListener("apex-range-changed", onRange);
  el.addEventListener("groupExpanded", onGroup);
  entry.cleanup = () => {
    el.removeEventListener("apex-context-menu-opening", onOpening);
    el.removeEventListener("apex-range-changed", onRange);
    el.removeEventListener("groupExpanded", onGroup);
  };
  grids[el.id] = entry;
  apply(entry, cfg.enterprise ?? {});
}

export function init(elementId, dataJson, columnsJson, configJson, dotNetRef, tagName) {
  // a grid that renders without configure() having run still gets an element to upgrade into
  if (!customElements.get("apex-grid-enterprise")) configure(null, null);
  return base.init(elementId, dataJson, columnsJson, configJson, dotNetRef, tagName || "apex-grid-enterprise", attach);
}

// A config change in .NET after the first render.
export function setEnterpriseConfig(elementId, configJson) {
  const entry = grids[elementId];
  if (entry) apply(entry, JSON.parse(configJson) ?? {});
}

export function destroy(elementId) {
  grids[elementId]?.cleanup?.();
  delete grids[elementId];
  base.destroy(elementId);
}

// --- Aggregation and the total row -------------------------------------------
export function getAggregations(elementId) {
  return gridOf(elementId).getAggregations();
}
export function getTotals(elementId) {
  return gridOf(elementId).getTotals();
}

// --- Grouping ----------------------------------------------------------------
export function getGroups(elementId) {
  return gridOf(elementId).getGroups().map((meta) => groupInfo(meta));
}
export function expandGroup(elementId, key) {
  gridOf(elementId).expandGroup(key);
}
export function collapseGroup(elementId, key) {
  gridOf(elementId).collapseGroup(key);
}
export function toggleGroup(elementId, key) {
  gridOf(elementId).toggleGroup(key);
}
export function expandAllGroups(elementId) {
  gridOf(elementId).expandAllGroups();
}
export function collapseAllGroups(elementId) {
  gridOf(elementId).collapseAllGroups();
}

// --- Pivot -------------------------------------------------------------------
export function isPivoting(elementId) {
  return gridOf(elementId).isPivoting;
}

// --- Range selection ---------------------------------------------------------
export function selectRange(elementId, from, to) {
  gridOf(elementId).selectRange(from, to ?? undefined);
}
export function clearRangeSelection(elementId) {
  gridOf(elementId).clearRangeSelection();
}
export function getSelectionStats(elementId) {
  return gridOf(elementId).getSelectionStats();
}
export function getSelectionBounds(elementId) {
  return gridOf(elementId).getSelectionBounds();
}

// --- XLSX export -------------------------------------------------------------
// Downloads <filename>.xlsx (data.xlsx without one).
export function exportToXlsx(elementId, optionsJson) {
  const options = (optionsJson && JSON.parse(optionsJson)) ?? {};
  gridOf(elementId).exportToXLSX(options);
}
// Returns the workbook's bytes without a download: an empty filename tells the grid not to save.
export function getXlsxBytes(elementId, optionsJson) {
  const options = (optionsJson && JSON.parse(optionsJson)) ?? {};
  return gridOf(elementId).exportToXLSX({ ...options, filename: "" });
}
