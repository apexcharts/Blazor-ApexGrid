// Enterprise bundle entry (bundle-enterprise.mjs). Nothing is registered here: the interop module
// (blazor-apexgrid-enterprise.js) opts into the feature modules the app selected and registers
// <apex-grid-enterprise> when the first enterprise grid initializes, because ApexGridEnterprise.use()
// has to run before the element is registered.
//
// Only the declarative modules are exported. The server-side row model and the six companion
// elements (tool panel, set filter, status bar, filter builder, chart panel, AI panel) are left
// out: the row models need a JavaScript to .NET getRows callback, and each companion element
// needs a Blazor component of its own.
export {
  ApexGridEnterprise,
  aggregationModule,
  contextMenuModule,
  groupingModule,
  pivotModule,
  rangeSelectionModule,
  totalRowModule,
} from 'apex-grid-enterprise';
