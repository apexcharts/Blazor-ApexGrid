using System.Collections.Generic;
using System.Text.Json;

namespace Blazor_ApexGrid_Enterprise.Models;

// Read models filled by Blazor's JSInterop, whose default options apply no string-enum converter,
// so enum-like values are strings here, as in Blazor_ApexGrid.Models.

/// <summary>
/// Computed aggregations (apex-grid-enterprise <c>AggregationResults</c>): column key, then the
/// function name (<c>"sum"</c>, <c>"avg"</c>, <c>"min"</c>, <c>"max"</c>, <c>"count"</c>), then the value.
/// </summary>
public class GridAggregationResults : Dictionary<string, Dictionary<string, double>>
{
    /// <summary>The value of <paramref name="function"/> for <paramref name="key"/>, or <c>null</c> when it was not requested.</summary>
    public double? Get(string key, AggregationFunction function)
        => TryGetValue(key, out var values) && values.TryGetValue(function.ToString().ToLowerInvariant(), out var value)
            ? value
            : null;
}

/// <summary>A rectangular cell range: view row indexes and display column indexes, inclusive.</summary>
public class GridRangeBounds
{
    public int Top { get; set; }
    public int Bottom { get; set; }
    public int Left { get; set; }
    public int Right { get; set; }
}

/// <summary>Live statistics over the selected cells (apex-grid-enterprise <c>RangeStats</c>).</summary>
public class GridRangeStats
{
    /// <summary>Non-blank cells.</summary>
    public int Count { get; set; }

    /// <summary>Cells holding a number; the other statistics cover these. All are 0 when there are none.</summary>
    public int NumericCount { get; set; }

    public double Sum { get; set; }
    public double Average { get; set; }
    public double Min { get; set; }
    public double Max { get; set; }
}

/// <summary>Fired when the cell range selection changes (<c>apex-range-changed</c>).</summary>
public class GridRangeChangedEventArgs
{
    /// <summary>The active range, or <c>null</c> when nothing is selected.</summary>
    public GridRangeBounds? Bounds { get; set; }

    /// <summary>Every selected range (Ctrl or Cmd adds ranges).</summary>
    public List<GridRangeBounds> Ranges { get; set; } = new();

    /// <summary>Statistics over all the selected ranges.</summary>
    public GridRangeStats Stats { get; set; } = new();
}

/// <summary>A group row, as <c>GetGroupsAsync</c> and <c>OnGroupExpanded</c> report it. The group's leaf rows are left out.</summary>
public class GridGroupInfo
{
    /// <summary>The stable path key, such as <c>"/EMEA/Engineering"</c>, that the group methods take.</summary>
    public string Key { get; set; } = string.Empty;

    /// <summary>The field this level groups by.</summary>
    public string Field { get; set; } = string.Empty;

    /// <summary>The group's value of that field.</summary>
    public JsonElement Value { get; set; }

    /// <summary>The displayed label.</summary>
    public string Label { get; set; } = string.Empty;

    /// <summary>The nesting depth, 0 for the outermost level.</summary>
    public int Depth { get; set; }

    /// <summary>The number of leaf rows in the group, after filtering.</summary>
    public int Count { get; set; }

    /// <summary>The group's subtotals for the grid's <c>Aggregations</c>.</summary>
    public GridAggregationResults Aggregates { get; set; } = new();

    /// <summary>Whether the group is expanded (reported by <c>OnGroupExpanded</c>; <c>null</c> from <c>GetGroupsAsync</c>).</summary>
    public bool? Expanded { get; set; }
}

/// <summary>Fired after a group row is expanded or collapsed (<c>groupExpanded</c>).</summary>
public class GridGroupExpandedEventArgs
{
    /// <summary>The group's path key.</summary>
    public string Key { get; set; } = string.Empty;

    /// <summary>Whether the group is now expanded.</summary>
    public bool Expanded { get; set; }

    /// <summary>The group row.</summary>
    public GridGroupInfo? Group { get; set; }
}

/// <summary>Fired when a context menu item added from .NET is chosen.</summary>
public class GridContextMenuItemClickEventArgs<TItem>
{
    /// <summary>The <see cref="GridContextMenuItem.Id"/> of the chosen item.</summary>
    public string Id { get; set; } = string.Empty;

    /// <summary>"cell" or "header".</summary>
    public string Kind { get; set; } = string.Empty;

    /// <summary>The column the menu was opened on.</summary>
    public string ColumnKey { get; set; } = string.Empty;

    /// <summary>The row's index in the current view, for a cell.</summary>
    public int? RowIndex { get; set; }

    /// <summary>
    /// The row's index in the component's <c>Data</c>, for a cell on a data row (the index the row
    /// methods take), or <c>null</c> for a header, a group row or a pivot row.
    /// </summary>
    public int? DataIndex { get; set; }

    /// <summary>The row, for a cell on a data row.</summary>
    public TItem? Row { get; set; }
}
