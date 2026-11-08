// Ignite UI add-on entry. apex-grid/ignite-ui (apex-grid 4.0 and later) registers the Ignite UI
// styles on a shared globalThis slot, so this second bundle reaches the grids registered by
// apex-grid.bundle.js. The interop module imports it only when the app opts in
// (ApexGridIgniteUI.Enable()).
import 'apex-grid/ignite-ui';
