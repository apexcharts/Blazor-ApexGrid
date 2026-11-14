# Blazor-ApexGrid-Enterprise

The enterprise companion to [Blazor-ApexGrid](https://www.nuget.org/packages/Blazor-ApexGrid): a
Blazor wrapper for [apex-grid-enterprise](https://www.npmjs.com/package/apex-grid-enterprise).
`ApexGridEnterprise<TItem>` extends `ApexGrid<TItem>`, so every community parameter, method and
event works unchanged, and adds:

- **Row grouping** by one or more columns, with collapsible group rows and live subtotals.
- **Aggregations** (sum, avg, min, max, count) per column.
- **A grand-total row** over the whole view.
- **Pivoting** into a cross-tab, with spanning headers, subtotals, a grand total and an
  expandable row tree.
- **Cell range selection** with live statistics, copy, paste and the fill handle.
- **A context menu** on cells and headers, with your own items raising a .NET event.
- **XLSX export** with native number, boolean and date cells, as a download or as bytes.

> **A commercial product.** ApexGrid Enterprise is included in the Premium plan and above, and
> there is no free tier: a Premium license is required whatever your financial resources. Without
> a valid license key the grid keeps working but renders a trial watermark, which is for
> evaluation only. See [Licensing](#licensing).

## Installation

```bash
dotnet add package Blazor-ApexGrid-Enterprise
```

This brings in `Blazor-ApexGrid` as a NuGet dependency. Nothing else is needed: the scripts are
served from `_content/Blazor-ApexGrid-Enterprise/` and `_content/Blazor-ApexGrid/`. The package
requires license acceptance: installing it means agreeing to the commercial license (see
[Licensing](#licensing)).

## Setup

In `Program.cs`:

```csharp
builder.Services.AddApexGridEnterprise(options =>
{
    options.LicenseKey = builder.Configuration["ApexGrid:LicenseKey"];
});
```

Or, without the service collection:

```csharp
using Blazor_ApexGrid_Enterprise;

ApexGridEnterprise.SetLicense(builder.Configuration["ApexGrid:LicenseKey"]);
```

Set the key before the first enterprise grid renders. The first grid on a page registers the
element and applies the key; a grid that renders later applies a key that changed since.

### Feature modules

apex-grid-enterprise wires a feature in only when its module is selected, and ignores the matching
property otherwise. **This package selects every module it models by default**:
`Aggregation`, `Grouping`, `Pivot`, `TotalRow`, `RangeSelection` and `ContextMenu`. To ship only
some, select them at startup:

```csharp
builder.Services.AddApexGridEnterprise(options =>
{
    options.Modules = ApexGridEnterpriseModules.Grouping | ApexGridEnterpriseModules.Aggregation;
});
// or ApexGridEnterprise.UseModules(...)
```

The modules are registered with the element when the first enterprise grid on a page renders, so
the selection belongs in `Program.cs`. All of them are in the vendored bundle either way; the
selection decides what a grid turns on (range selection and the context menu, for example, are on
by default when their module is selected). XLSX export is part of the grid and needs no module.

## Quick start

```razor
@using Blazor_ApexGrid.Models
@using Blazor_ApexGrid_Enterprise.Components
@using Blazor_ApexGrid_Enterprise.Models

<ApexGridEnterprise TItem="Employee" @ref="grid"
                    Data="employees" Columns="columns" Height="420px"
                    GroupBy="groupBy"
                    Aggregations="aggregations"
                    TotalRow="totalRow"
                    ShowExport="true" ExportFilename="employees"
                    OnRangeChanged="e => sum = e.Stats.Sum" />

@code {
    private ApexGridEnterprise<Employee>? grid;
    private double sum;

    private List<string> groupBy = new() { "department" };
    private readonly GridAggregations aggregations = new()
    {
        { "salary", AggregationFunction.Sum, AggregationFunction.Avg },
    };
    private readonly GridTotalRowConfiguration totalRow = new()
    {
        Aggregations = new() { { "salary", AggregationFunction.Sum } },
    };
}
```

Keys (`GroupBy`, aggregation keys, pivot fields) are the row fields' serialized (camelCase)
names, as `GridColumn.Key` is.

## Features

### Grouping and aggregations

`GroupBy` lists the columns to group by, outermost first. Group headers show a leaf count and the
`Aggregations` computed over the group's filtered leaves. `GroupingOptions.DefaultExpanded` sets
the initial expansion (`true`, `false` or a depth).

Methods: `GetGroupsAsync`, `ExpandGroupAsync(key)`, `CollapseGroupAsync(key)`,
`ToggleGroupAsync(key)`, `ExpandAllGroupsAsync`, `CollapseAllGroupsAsync`, and
`GetAggregationsAsync` for the aggregations over the whole view. `OnGroupExpanded` reports a
toggle.

### Grand-total row

```csharp
TotalRow = new() { Aggregations = new() { { "salary", AggregationFunction.Sum } }, Position = TotalRowPosition.Bottom, Label = "Total" };
```

The row totals the view: it follows filtering, counts rows on other pages and inside collapsed
groups, and leaves group header rows out. A pivot brings its own grand total, so the row is not
added while one is active. `GetTotalsAsync` returns its values.

### Pivot

```csharp
Pivot = new()
{
    Rows = new() { "region" },
    On = new() { "quarter" },
    Values = new() { { "revenue", AggregationFunction.Sum } },
    Options = new() { GrandTotal = PivotGrandTotalPosition.Bottom },
};
```

The distinct values of `On` become columns, generated from the data and recomputed on filter. With
several measures or `On` fields the value columns group under spanning headers. `Options` adds
`Subtotals`, an `Expandable` row tree, and `MaxValueColumns` (200 by default). A pivot wins over
`GroupBy`; set `Pivot` to `null` to restore the original columns. `IsPivotingAsync` says whether one
is active.

### Range selection

On by default: drag across cells, Shift to extend, Ctrl or Cmd to add ranges, Ctrl or Cmd+C to
copy. Paste and the fill handle write only to editable columns (`Editable = true` with `Editing`
on). `RangeSelection="false"` turns it off.

`OnRangeChanged` reports the bounds and live statistics (count, sum, average, min, max);
`SelectRangeAsync(from, to)`, `ClearRangeSelectionAsync`, `GetSelectionStatsAsync` and
`GetSelectionBoundsAsync` drive it from code.

### Context menu

A right-click on a cell or header, or a header's kebab button, opens the menu: sort, pin, hide,
copy, and group by on headers. Add your own items; choosing one raises `OnContextMenuItemClick`
with the item id, the column, and for a cell the row and its index in `Data`:

```razor
<ApexGridEnterprise TItem="Employee" Data="employees" Columns="columns"
                    ContextMenu="menu" OnContextMenuItemClick="OnMenu" />

@code {
    private readonly GridContextMenuConfiguration menu = new()
    {
        Items = new()
        {
            new() { Id = "details", Label = "Show details", Target = ContextMenuTargetKind.Cell, SeparatorBefore = true },
        },
    };

    private void OnMenu(GridContextMenuItemClickEventArgs<Employee> e) { /* e.Id, e.Row, e.DataIndex */ }
}
```

`ReplaceDefaultItems = true` shows only your items, and `Enabled = false` turns the menu off.

### XLSX export

```csharp
await grid.ExportToXlsxAsync(new() { Filename = "employees", SheetName = "Staff" });   // download
byte[] workbook = await grid.GetXlsxBytesAsync(new() { Source = GridExportSource.All }); // no download
```

With `ShowExport="true"` the toolbar's export menu also offers "Export XLSX", named by
`ExportFilename`.

### Applying changes

The enterprise parameters apply on change, as `Pagination` does: a change in .NET reaches the grid
after the next render, and only the parameters that changed are applied, so a group the user added
from the context menu stays until `GroupBy` changes in .NET.

## Not modelled

Options that apex-grid-enterprise takes as JavaScript functions cannot cross the interop: the
context menu's `items` function and per-item `run` (use `Items` and `OnContextMenuItemClick`), the
cancellable `apex-context-menu-opening` and `groupExpanding` events, and the export `formatter`.

Not in this release:

- the server-side and infinite row models, which need a JavaScript to .NET `getRows` callback
- the six companion elements: the columns tool panel, the set filter, the status bar, the advanced
  filter builder, the chart panel and the AI panel
- master/detail grids, formulas, integrated charts and the AI toolkit

## One apex-grid core per page

The enterprise bundle carries no apex-grid core and no Lit of its own. Blazor-ApexGrid's core
bundle publishes its core and Lit when it loads, and this package's interop module imports
Blazor-ApexGrid's module before the enterprise bundle, so `<apex-grid-enterprise>` extends the very
`ApexGrid` class registered as `<apex-grid>`. Community `ApexGrid` and `ApexGridEnterprise`
components can share a page in either render order.

This package builds on Blazor-ApexGrid's interop module, which is not a public API, so it depends
on Blazor-ApexGrid within one minor version: 0.1.0 takes `[1.3.0, 1.4.0)`. Each Blazor-ApexGrid
minor release is followed by an enterprise release that takes it; until then NuGet keeps
Blazor-ApexGrid on the minor this package was built against. The enterprise bundle also checks the
core it finds (apex-grid `^5.0.0` for this release) and refuses to load, with an error naming both
versions, rather than run on one it was not built for.

## Licensing

ApexGrid Enterprise is a commercial product, included in the **Premium** plan and above. There is
no free tier: the $2M threshold that makes some Apex products free does not apply, and a Premium
license is required whatever your financial resources. Redistribution inside a product or
platform used by other people needs the OEM License. See
[LICENSE.md](https://github.com/apexcharts/Blazor-ApexGrid/blob/main/src/Blazor-ApexGrid-Enterprise/LICENSE.md)
for the full terms, and contact [sales@apexcharts.com](mailto:sales@apexcharts.com) for a license.

Licensing is offline: the key is checked in the browser with no network calls and nothing is
blocked. Without a valid key (none set, one that fails its signature check, or one whose
subscription has ended) each enterprise grid renders a trial watermark (the `license-watermark`
part). A key that is set but cannot be used also logs a console error that says why (the key
itself is never logged). One key works across every Apex product. Community `ApexGrid`
components on the same page are not affected.

Built on [apex-grid-enterprise](https://www.npmjs.com/package/apex-grid-enterprise) v0.10.0 and
the apex-grid v5.0.0 core from Blazor-ApexGrid 1.3.0.
