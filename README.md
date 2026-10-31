# Blazor-ApexGrid

A Blazor wrapper for [apex-grid](https://www.npmjs.com/package/apex-grid), a Lit-based
web-component data grid. The core library (and its dependencies) are bundled into a single
self-contained ES module and shipped inside this package, so no `<script>` tag, CDN reference,
or npm build step is required in your app.

- **Typed** `ApexGrid<TItem>` component with strongly-typed columns and events.
- **Data pipeline**: sorting, filtering, quick filter, and (local or remote) pagination.
- **Selection**: single or multiple, with an optional checkbox column.
- **Inline editing**: cell or row mode, with undo/redo history.
- **Column operations**: pin, reorder, resize, show/hide.
- **Rows**: pinning to sticky bands and drag/keyboard reordering.
- **Tree data** and **row detail** expansion.
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
- **A data change clears undo history.** For the same reason, the grid treats every push of
  `Data` (including `RefreshAsync()`) as new records and drops its undo and redo stacks, since
  those edits were made to rows it no longer holds.
- **Give the grid a bounded height.** `Height` defaults to `400px`. A percentage only works if
  the parent has a height of its own; otherwise it resolves to zero and the grid renders as
  nothing.
- **Cell and header templates are JavaScript function strings**, passed through
  `AdditionalConfig`, not Razor `RenderFragment`s, so a template cannot contain Blazor
  components.

## Columns

`GridColumn<TItem>` mirrors the core column configuration:

| Property | Purpose |
| --- | --- |
| `Key` | Row field to bind (camelCase property name). |
| `HeaderText` | Header label (falls back to `Key`). |
| `Type` | `GridDataType` controlling the cell renderer/editor (Number, String, Boolean, Select, Rating, Date, Image, Currency, Avatar, Badge, Progress, Sparkline, Status). |
| `Width`, `Hidden`, `Exportable` | Layout and export. |
| `Pinned`, `Reorderable`, `Resizable` | Column operations. |
| `Sort`, `Filter` | Enable sorting/filtering on the column. |
| `Editable` | Allow inline editing (requires grid `Editing`). |
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

### State persistence

```csharp
var snapshot = await grid.GetStateAsync();   // JSON-safe; persist it anywhere
await grid.SetStateAsync(snapshot);          // restore later (only present slices are applied)
```

`GetSchemaAsync` returns a machine-readable description of the grid (columns, available
operations, current state), useful for driving a view editor or an AI layer.

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

Built on top of [apex-grid](https://www.npmjs.com/package/apex-grid) v3.6.0.
