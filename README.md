# Blazor-ApexGrid

A Blazor wrapper for [apex-grid](https://www.npmjs.com/package/apex-grid), a Lit-based
web-component data grid. The core library (and its dependencies) are bundled into a single
self-contained ES module and shipped inside this package, so no `<script>` tag, CDN reference,
or npm build step is required in your app.

- **Typed** `ApexGrid<TItem>` component with strongly-typed columns and events.
- **Data pipeline**: sorting, filtering, quick filter, and (local or remote) pagination.
- **Toolbar and header**: a built-in search box and CSV export menu with your file name, and
  a header you can hide for compact tiles.
- **Selection**: single or multiple, with an optional checkbox column.
- **Inline editing**: cell or row mode, with undo/redo history.
- **Column operations**: pin, reorder, resize, show/hide.
- **Rows**: pinning to sticky bands and drag/keyboard reordering.
- **Tree data** and **row detail** expansion.
- **Chart columns**: an ApexCharts chart in every cell, drawn with an ApexCharts the app loads.
- **State persistence**: capture and restore a JSON snapshot of the whole view.
- Multi-targets **net8.0**, **net9.0**, and **net10.0**.

## Installation

```bash
dotnet add package Blazor-ApexGrid
```

No other setup is needed: the grid's JavaScript and styles are served automatically from
`_content/Blazor-ApexGrid/`.

## Quick start

```razor
@using Blazor_ApexGrid.Components
@using Blazor_ApexGrid.Models

<ApexGrid TItem="Person"
          Data="people"
          Columns="columns"
          Height="360px"
          Pagination="pagination"
          Selection="selection"
          OnRowSelected="OnRowSelected" />

@code {
    private readonly PaginationConfiguration pagination = new() { Enabled = true, PageSize = 10 };
    private readonly GridSelectionConfiguration selection = new()
    {
        Enabled = true, Mode = SelectionMode.Multiple, ShowCheckboxColumn = true,
    };

    private readonly List<GridColumn<Person>> columns = new()
    {
        new() { Key = "name", HeaderText = "Name", Sort = true, Filter = true },
        new() { Key = "age", HeaderText = "Age", Type = GridDataType.Number, Sort = true },
        new() { Key = "role", HeaderText = "Role", Filter = true },
    };

    private List<Person> people = new()
    {
        new() { Name = "Ada Lovelace", Age = 36, Role = "Mathematician" },
        new() { Name = "Alan Turing", Age = 41, Role = "Computer Scientist" },
    };

    private void OnRowSelected(GridRowSelectedEventArgs<Person> e) { /* e.Selected, e.Added, e.Removed */ }

    public class Person
    {
        public string Name { get; set; } = "";
        public int Age { get; set; }
        public string Role { get; set; } = "";
    }
}
```

> Column `Key` values bind to your row properties by their serialized (camelCase) name, so a
> `Name` property is referenced as `"name"`.

### Good to know

- **Editing a row in place needs `RefreshAsync()`.** The grid redraws when `Data` is reassigned
  or its row count changes. Changing a property on a row already in the list does neither, so
  call `await grid.RefreshAsync()` to show the edit.
- **Set `RowIdKey` when rows have an id.** Every change to `Data` reaches the grid as new
  objects, so the grid cannot tell a reloaded row from a new one. `RowIdKey="id"` (the
  camelCase field name) keeps row pins and a manual row order across data changes, and makes
  `GetStateAsync` capture selected and expanded rows by id instead of by position.
- **Body rows are recycled.** From 1.2.0 (apex-grid 4.0) a scroll, sort or filter re-binds the
  rendered row elements, and their cells, to the records now in view instead of building new ones,
  so a row element can show another record later. Set `RowRecycling="false"` (rendered as
  `row-recycling="false"`) to keep each row element with its record, for example when a cell
  template keeps state in the elements it creates, or when JavaScript interop holds row elements
  across a scroll or a sort.
- **A data change clears undo history.** For the same reason, the grid treats every push of
  `Data` (including `RefreshAsync()`) as new records and drops its undo and redo stacks, since
  those edits were made to rows it no longer holds.
- **Give the grid a bounded height.** `Height` defaults to `400px`. A percentage only works if
  the parent has a height of its own; otherwise it resolves to zero and the grid renders as
  nothing.
- **Rows cannot be made unselectable.** The core's `selection.isRowSelectable` is a JavaScript
  predicate, which cannot cross the interop, so it is not modelled: every row is selectable.
- **Most grid-wide settings are read once.** `SortConfiguration`, `Selection`, `Editing`,
  `RowPinning`, `RowReordering`, `ColumnReordering`, `RowIdKey`, `Tree` and `Expansion` apply
  when the grid first renders; to change one later, re-create the component (for example by
  changing its `@key`). `Pagination`, `Data`, the attribute switches (`ShowHeader`,
  `ShowQuickFilter`, `ShowExport`, `ExportFilename`, `RowRecycling`, `DesignSystem`, `Tokens`)
  and `RefreshAsync()` for `Columns` apply on change.
- **Cell and header templates are JavaScript function strings**, passed through
  `AdditionalConfig`, not Razor `RenderFragment`s, so a template cannot contain Blazor
  components.

## Columns

`GridColumn<TItem>` mirrors the core column configuration:

| Property | Purpose |
| --- | --- |
| `Key` | Row field to bind (camelCase property name). |
| `HeaderText` | Header label (falls back to `Key`). |
| `Type` | `GridDataType` controlling the cell renderer/editor (Number, String, Boolean, Select, Rating, Date, Image, Currency, Avatar, Badge, Progress, Sparkline, Status, Chart). |
| `Width`, `Hidden`, `Exportable` | Layout and export. |
| `Pinned`, `Reorderable`, `Resizable` | Column operations. |
| `Sort`, `Filter` | Enable sorting/filtering on the column. |
| `Editable` | Allow inline editing (requires grid `Editing`). |
| `Chart` | Chart type, size and ApexCharts options for a `Chart` column (see [Chart columns](#chart-columns)). |
| `AdditionalConfig` | Escape hatch (`[JsonExtensionData]`) for options not modeled above, including JS-function-string renderers. |

## Features

### Sorting, filtering, pagination

```razor
<ApexGrid TItem="Person" @ref="grid"
          Data="people" Columns="columns"
          SortConfiguration="new() { Multiple = true, TriState = true }"
          Pagination="new() { Enabled = true, PageSize = 25 }" />
```

Drive them programmatically: `SortAsync`, `ClearSortAsync`, `FilterAsync`, `ClearFilterAsync`,
`SetQuickFilterAsync`, `GotoPageAsync`, `NextPageAsync`/`PreviousPageAsync`,
`FirstPageAsync`/`LastPageAsync`, `SetPageSizeAsync`.

`Paginator = PaginatorLayout.Compact` on `PaginationConfiguration` always draws the narrow
paginator (summary, previous, "page / count", next). The default, `Full`, adds the page size
select and first and last, and drops them on its own when the grid is too narrow.

A change to `Pagination` after the first render (a new object, or a property set on the same
one before the component re-renders) reaches the grid. The page and page size the user picked
are kept unless the change sets `Page` or `PageSize` to a new value, and `Pagination = null`
turns pagination off.

### Toolbar and header

```razor
<ApexGrid TItem="Person" Data="people" Columns="columns"
          ShowQuickFilter="true" ShowExport="true" ExportFilename="people"
          ShowHeader="showHeader" />
```

- `ShowQuickFilter="true"` renders the built-in search box in the toolbar.
- `ShowExport="true"` renders the export menu, and `ExportFilename` names its download
  (`people.csv`; the default is `data.csv`).
- `ShowHeader="false"` leaves out the column header rows, for a compact table such as a
  dashboard tile. Sort, filter, column widths and the page are kept, and screen readers still
  announce the column names; resizing, the column menu, drag reorder and the filter panel come
  back with the header.

All four are rendered as attributes on the element, so changing them after the first render
takes effect.

The grid's own search box and pager text come from its built-in English strings. This package
does not model the grid's `localeText`.

### Inline editing with undo/redo

```razor
<ApexGrid TItem="Person" @ref="grid" Data="people" Columns="columns"
          Editing="editing" OnCellValueChanged="OnEdited" OnHistoryChanged="OnHistory" />

@code {
    private readonly GridEditingConfiguration editing = new()
    {
        Enabled = true, Mode = EditMode.Cell, Trigger = EditTrigger.DoubleClick,
        History = new() { Enabled = true },
    };
}
```

API: `EditCellAsync`, `EditRowAsync`, `CommitEditAsync`, `CancelEditAsync`, `UndoAsync`,
`RedoAsync`, `ClearHistoryAsync`, `CanUndoAsync`, `CanRedoAsync`. Mark editable columns with
`Editable = true`.

`ApplyEditsAsync` writes a batch of cells by data index. Each write runs the column's
validators and raises `OnCellValueChanging` / `OnCellValueChanged`, and the whole batch is one
undo step and one re-render. It returns a `GridApplyEditsResult` that counts `Applied`,
`Unchanged`, `Invalid`, `Cancelled` and `Skipped` separately.

```csharp
var edits = people.Select((p, i) => new GridCellEdit { DataIndex = i, Column = "age", Value = p.Age + 1 });
var result = await grid.ApplyEditsAsync(edits);   // reaches rows on other pages too
```

### Column and row operations

`PinColumnAsync` / `UnpinColumnAsync` / `MoveColumnAsync` / `UpdateColumnsAsync`; set
`ColumnReordering="true"` for drag reordering. Rows: `PinRowAsync` / `UnpinRowAsync` /
`GetPinnedRowsAsync` (with `RowPinning`), and `MoveRowAsync` (with `RowReordering`).

### Tree data

The hierarchy is derived from a path array on each row; point `PathKey` at that field. No
callbacks required.

```razor
<ApexGrid TItem="Employee" Data="employees" Columns="columns"
          Tree="new() { Enabled = true, PathKey = &quot;path&quot;, DefaultExpanded = true }" />
```

### Row detail

Expanding a row opens a detail panel beneath it, rendered from an HTML template whose
`{field}` tokens are replaced with the row's (HTML-escaped) values. The panel holds HTML, not a
nested grid.

```razor
<ApexGrid TItem="Product" Data="products" Columns="columns" Expansion="expansion" />

@code {
    private readonly GridExpansionConfiguration expansion = new()
    {
        Enabled = true,
        DetailTemplateHtml = "<div style='padding:12px'><strong>{name}</strong> &mdash; {category}</div>",
    };
}
```

To style elements inside the template from your own CSS, give them a `part` attribute and
list those names in `ExportParts`; then `apex-grid::part(name)` reaches them. The panel itself
is always `apex-grid::part(detail-panel)`.

Expansion/tree API: `ExpandRowAsync`, `CollapseRowAsync`, `ToggleRowExpansionAsync`,
`ExpandAllRowsAsync`, `CollapseAllRowsAsync`, and the `...TreeRow...` equivalents.

### Chart columns

`Type = GridDataType.Chart` draws an ApexCharts chart in every cell of the column. **ApexCharts
is not bundled in this package**, so the column works only when the app loads ApexCharts 8.4.1
or later itself, as a global `window.ApexCharts` from a script tag in `index.html` (WebAssembly)
or `App.razor` (Web App):

```html
<script src="https://cdn.jsdelivr.net/npm/apexcharts@8.8.1/dist/apexcharts.min.js"></script>
```

```csharp
new GridColumn<Stock>
{
    Key = "history", HeaderText = "Last 30 days", Type = GridDataType.Chart,
    Chart = new() { Type = "area", Height = 32, Options = new { stroke = new { width = 1.5 } } },
}
```

A `double[]` value (with `null` entries as gaps, from a `double?[]`) is one series; a pie,
donut, radialBar or polarArea chart takes one value per slice or ring. `Options` merges over
the column defaults and is the same for every row: the core's per-row options function and its
accessible `label` function are JavaScript callbacks and cannot cross the interop.

Without a global ApexCharts the cells stay empty, and the grid logs a console error naming the
chart columns and this fix. Another package's copy of ApexCharts counts only if it sets the
global and is 8.4.1 or later.

### State persistence

```csharp
var snapshot = await grid.GetStateAsync();   // JSON-safe; persist it anywhere
await grid.SetStateAsync(snapshot);          // restore later (only present slices are applied)
```

`GetSchemaAsync` returns a machine-readable description of the grid (columns, available
operations, current state), useful for driving a view editor or an AI layer.

## Ignite UI theming

From Blazor-ApexGrid 1.2.0, which bundles apex-grid 4.0, grids can follow the Ignite UI theme
the page loads: the brand, text and muted text, gridlines, the header, the state colours, the
font, light or dark. It is an add-on and needs no extra license key. Turn it on
once in `Program.cs`:

```csharp
using Blazor_ApexGrid;

ApexGridIgniteUI.Enable();
```

The component then loads `_content/Blazor-ApexGrid/js/apex-grid.ignite-ui.bundle.js` before the
first grid initializes. To load it yourself instead, import it as a module in `index.html` (or
`App.razor`):

```html
<script type="module" src="_content/Blazor-ApexGrid/js/apex-grid.ignite-ui.bundle.js"></script>
```

The Ignite UI tokens (`--ig-*`) rank below everything you set:

| Rank | Source |
| ---- | ------ |
| 1 | An `--ag-*` token you set |
| 2 | An `--apx-*` family token |
| 3 | The Ignite UI theme (`--ig-*`), with the add-on loaded |
| 4 | The built-in values |

A grid follows the Ignite UI light or dark variant, and a theme swap, live: no refresh call is
needed. Per grid:

```razor
<ApexGrid TItem="Product" Data="products" Columns="columns" DesignSystem="false" />
<ApexGrid TItem="Product" Data="products" Columns="columns" Tokens="false" />
```

`DesignSystem="false"` (rendered as `design-system="off"`) turns the Ignite UI colours and font off;
the variant still picks the mode. `Tokens="false"` (rendered as `tokens="off"`) turns off the family
`--apx-*` tokens and Ignite UI, the variant included, for the grid and the content it renders.

The font comes from `--ig-font-family`, which is usually a web font, and the Ignite UI theme sheets
do not load it. Load the font on the page; the grid lays out in CSS, so it picks the font up when it
arrives.

> **Upgrading from apex-grid 3.x.** Before 4.0 the grid read some `--ig-*` tokens on its own. From
> 4.0 it reads none without the add-on, so an app that relied on an Ignite UI stylesheet theming
> the grid calls `ApexGridIgniteUI.Enable()`.

## Events

All events surface as strongly-typed `EventCallback`s. Payloads use string fields for
enum-like values (Blazor's default JSInterop deserialization applies no string-enum converter)
and expose selected/affected rows as your `TItem`.

| Area | Events |
| --- | --- |
| Sorting | `OnSorting`, `OnSorted` |
| Filtering | `OnFiltering`, `OnFiltered`, `OnQuickFilterChanging`, `OnQuickFilterChanged` |
| Pagination | `OnPageChanging`, `OnPageChanged` |
| Selection | `OnRowSelecting`, `OnRowSelected` |
| Columns | `OnColumnPinning`, `OnColumnPinned`, `OnColumnMoving`, `OnColumnMoved` |
| Editing | `OnCellValueChanging`, `OnCellValueChanged`, `OnCellValidationFailed`, `OnHistoryChanged`, `OnRowEditStarted`, `OnRowEditEnded` |
| Rows | `OnRowPinning`, `OnRowPinned`, `OnRowMoving`, `OnRowMoved` |
| Expansion / tree | `OnRowExpanding`, `OnRowExpanded`, `OnTreeRowExpanding`, `OnTreeRowExpanded` |
| State | `OnStateChanged` |

## Live demo

A running sample (data grid, plus tree and row detail) is deployed at
<https://apexcharts.github.io/Blazor-ApexGrid/>. Source is under
[`src/Blazor-ApexGrid.Sample`](src/Blazor-ApexGrid.Sample).

## License

This wrapper bundles [apex-grid](https://www.npmjs.com/package/apex-grid), which is offered
under the ApexCharts dual-license model: a Community License at no cost for individuals,
non-profits, educators and organizations under $2M USD in annual revenue, operating budget or
funding, and a paid Commercial or OEM license at or above that. Embedding the grid in a product
or platform used by other people needs the OEM License whatever your size. See
[LICENSE.md](LICENSE.md) for the full terms.

Built on top of [apex-grid](https://www.npmjs.com/package/apex-grid) v5.0.0.
