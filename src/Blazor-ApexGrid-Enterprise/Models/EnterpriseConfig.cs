using System.Collections.Generic;

namespace Blazor_ApexGrid_Enterprise.Models;

// Configuration sent to apex-grid-enterprise. Serialized by Blazor_ApexGrid.Internal.GridSerializer:
// camelCase keys, enums as camelCase strings, nulls left out. Dictionary keys are sent as given, so
// key them by the row field's serialized (camelCase) name, as GridColumn.Key is. Only data crosses
// the interop: options that apex-grid-enterprise takes as JavaScript functions are not modelled,
// and each class says which.

/// <summary>An aggregation function (apex-grid-enterprise <c>AggregationFn</c>).</summary>
public enum AggregationFunction
{
    /// <summary>The sum of the numeric values.</summary>
    Sum,

    /// <summary>The mean of the numeric values.</summary>
    Avg,

    /// <summary>The smallest numeric value.</summary>
    Min,

    /// <summary>The largest numeric value.</summary>
    Max,

    /// <summary>The number of numeric values.</summary>
    Count,
}

/// <summary>
/// Aggregations per column (apex-grid-enterprise <c>AggregationConfig</c>), keyed by the column's
/// camelCase key. Non-numeric values are ignored.
/// </summary>
/// <example>
/// <code>
/// new GridAggregations
/// {
///     { "salary", AggregationFunction.Sum, AggregationFunction.Avg },
///     { "age", AggregationFunction.Max },
/// }
/// </code>
/// </example>
public class GridAggregations : Dictionary<string, AggregationFunction[]>
{
    /// <summary>
    /// Requests <paramref name="functions"/> for the column <paramref name="key"/>. The same as the
    /// dictionary's own Add (a key added twice throws), with the functions as a list.
    /// </summary>
    public new void Add(string key, params AggregationFunction[] functions) => base.Add(key, functions);
}

/// <summary>Row grouping options (apex-grid-enterprise <c>groupingOptions</c>).</summary>
public class GridGroupingOptions
{
    /// <summary>
    /// Initial expansion of the group rows: <c>true</c> (all), <c>false</c> (none), or a depth
    /// number (groups shallower than it start expanded). Default: <c>true</c>.
    /// </summary>
    public object? DefaultExpanded { get; set; }
}

/// <summary>Where the grand-total row sits.</summary>
public enum TotalRowPosition
{
    /// <summary>Above the rows.</summary>
    Top,

    /// <summary>Below the rows. The default.</summary>
    Bottom,
}

/// <summary>
/// The grand-total row (apex-grid-enterprise <c>TotalRowConfig</c>): one synthesized row with
/// aggregations over the whole view. It follows filtering, counts rows on other pages and inside
/// collapsed groups, and leaves group header rows out. It is not added while a pivot is active.
/// </summary>
public class GridTotalRowConfiguration
{
    /// <summary>The aggregations to show, per column. Empty renders nothing.</summary>
    public GridAggregations Aggregations { get; set; } = new();

    /// <summary>Where the row sits. Default: <see cref="TotalRowPosition.Bottom"/>.</summary>
    public TotalRowPosition? Position { get; set; }

    /// <summary>The leading label. Default: the localized "Grand Total".</summary>
    public string? Label { get; set; }
}

/// <summary>Where the pivot's grand-total row sits.</summary>
public enum PivotGrandTotalPosition
{
    /// <summary>Above the rows.</summary>
    Top,

    /// <summary>Below the rows.</summary>
    Bottom,
}

/// <summary>
/// A pivot (apex-grid-enterprise <c>pivotRows</c>, <c>pivotOn</c>, <c>pivotValues</c> and
/// <c>pivotOptions</c>): <see cref="Rows"/> down the left, the distinct values of
/// <see cref="On"/> as columns, and <see cref="Values"/> aggregated into each cell. The value
/// columns are generated from the data and recompute on filter. A pivot wins over
/// <c>GroupBy</c>; set the parameter to <c>null</c> to restore the original columns.
/// </summary>
public class GridPivotConfiguration
{
    /// <summary>The row dimension field(s), outermost first.</summary>
    public List<string> Rows { get; set; } = new();

    /// <summary>
    /// The column dimension field(s). With more than one, the first heads a spanning header and the
    /// inner fields fold into the leaf headers.
    /// </summary>
    public List<string> On { get; set; } = new();

    /// <summary>The measure(s) aggregated into each cell.</summary>
    public GridAggregations Values { get; set; } = new();

    /// <summary>Totals, the expandable tree and the column cap.</summary>
    public GridPivotOptions? Options { get; set; }
}

/// <summary>Pivot output options (apex-grid-enterprise <c>PivotOptions</c>).</summary>
public class GridPivotOptions
{
    /// <summary>Emit a grand-total row, and where. Default: none.</summary>
    public PivotGrandTotalPosition? GrandTotal { get; set; }

    /// <summary>
    /// Emit a subtotal row after each value of the first row field. Needs two or more
    /// <see cref="GridPivotConfiguration.Rows"/>; ignored when <see cref="Expandable"/> is on.
    /// </summary>
    public bool? Subtotals { get; set; }

    /// <summary>Render the row dimension as a nested, collapsible tree in one group column.</summary>
    public bool? Expandable { get; set; }

    /// <summary>
    /// Initial expansion in <see cref="Expandable"/> mode: <c>true</c> (all), <c>false</c> (none),
    /// or a depth threshold. Default: <c>true</c>.
    /// </summary>
    public object? DefaultExpanded { get; set; }

    /// <summary>
    /// The most value columns the pivot generates (columns are not virtualized). Default: 200.
    /// Use <see cref="int.MaxValue"/> to lift the cap.
    /// </summary>
    public int? MaxValueColumns { get; set; }
}

/// <summary>What a context menu was opened on.</summary>
public enum ContextMenuTargetKind
{
    /// <summary>A body cell.</summary>
    Cell,

    /// <summary>A column header (also the header's kebab button).</summary>
    Header,
}

/// <summary>
/// A context menu item added from .NET. Choosing a leaf item raises the component's
/// <c>OnContextMenuItemClick</c> with its <see cref="Id"/> and the cell or header it was opened
/// on. apex-grid-enterprise's per-item <c>run</c> function is the JavaScript side of that and is
/// not set directly.
/// </summary>
public class GridContextMenuItem
{
    /// <summary>A stable id, reported back in the click event.</summary>
    public string Id { get; set; } = string.Empty;

    /// <summary>The visible label.</summary>
    public string Label { get; set; } = string.Empty;

    /// <summary>Show the item greyed out and not clickable.</summary>
    public bool? Disabled { get; set; }

    /// <summary>Draw a separator above the item.</summary>
    public bool? SeparatorBefore { get; set; }

    /// <summary>Nested items. An item with a submenu opens it rather than raising the click event.</summary>
    public List<GridContextMenuItem>? Submenu { get; set; }

    /// <summary>Show the item only on cells or only on headers. Default: both.</summary>
    public ContextMenuTargetKind? Target { get; set; }
}

/// <summary>
/// The context menu (apex-grid-enterprise <c>contextMenu</c>). It opens on a right-click on a cell
/// or header and from each header's kebab button, and is on by default with the
/// <c>ContextMenu</c> module: sort, pin, hide, copy, and group by on headers while grouping is
/// available. A <c>ContextMenuConfig.items</c> function and the cancellable
/// <c>apex-context-menu-opening</c> event are JavaScript and are not modelled; use
/// <see cref="Items"/> instead.
/// </summary>
public class GridContextMenuConfiguration
{
    /// <summary>Set to <c>false</c> to turn the menu off. Default: on.</summary>
    public bool Enabled { get; set; } = true;

    /// <summary>Items added after the built-in ones (or in their place, see <see cref="ReplaceDefaultItems"/>).</summary>
    public List<GridContextMenuItem>? Items { get; set; }

    /// <summary>Show only <see cref="Items"/>, without the built-in items.</summary>
    public bool ReplaceDefaultItems { get; set; }
}

/// <summary>Which rows an export writes.</summary>
public enum GridExportSource
{
    /// <summary>Every row in the current view, across pages and inside collapsed groups. The default.</summary>
    View,

    /// <summary>Every data row, ignoring filtering.</summary>
    All,

    /// <summary>The rows on the current page.</summary>
    Page,

    /// <summary>The selected rows.</summary>
    Selected,
}

/// <summary>
/// XLSX export options (apex-grid-enterprise <c>XLSXExportOptions</c>). Numbers, booleans and dates
/// keep their native Excel cell types. The per-cell <c>formatter</c> is a JavaScript function and
/// is not modelled.
/// </summary>
public class GridXlsxExportOptions
{
    /// <summary>The file name without extension. Default: <c>data</c> (the file is <c>data.xlsx</c>).</summary>
    public string? Filename { get; set; }

    /// <summary>The worksheet name. Default: <c>Sheet1</c>.</summary>
    public string? SheetName { get; set; }

    /// <summary>Which rows to write. Default: <see cref="GridExportSource.View"/>.</summary>
    public GridExportSource? Source { get; set; }

    /// <summary>
    /// Narrows the export to these column keys (hidden and non-exportable columns are still left
    /// out, and display order is kept). Default: every visible exportable column.
    /// </summary>
    public List<string>? Columns { get; set; }

    /// <summary>Write a header row. Default: <c>true</c>.</summary>
    public bool? IncludeHeader { get; set; }
}

/// <summary>A cell by view row index and column key, as range selection takes it.</summary>
public class GridCellAddress
{
    /// <summary>The row's index in the current view (the page, as displayed).</summary>
    public int Row { get; set; }

    /// <summary>The column key.</summary>
    public string Column { get; set; } = string.Empty;
}
