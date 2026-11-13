using System.Text.Json.Serialization;

namespace Blazor_ApexGrid.Models;

// The grid serializer registers a camelCase string-enum converter, so these members serialize to
// the lowercase values the core expects (Number -> "number", Start -> "start").

/// <summary>
/// Column data type, controlling the built-in cell renderer and editor. <see cref="Chart"/>
/// needs ApexCharts 8.4.1 or later loaded on the page by the app (see
/// <see cref="GridColumn{TItem}.Chart"/>); the package does not bundle it.
/// </summary>
public enum GridDataType
{
    Number,
    String,
    Boolean,
    Select,
    Rating,
    Date,
    Image,
    Currency,
    Avatar,
    Badge,
    Progress,
    Sparkline,
    Status,

    /// <summary>
    /// An ApexCharts chart in every cell, configured with <see cref="GridColumn{TItem}.Chart"/>.
    /// Requires apex-grid 4.1 or later and ApexCharts 8.4.1 or later, which the app loads itself
    /// as a global <c>window.ApexCharts</c> (a script tag). Without it the cells stay empty and the
    /// interop logs a console error naming the column.
    /// </summary>
    Chart
}

/// <summary>The paginator layout.</summary>
public enum PaginatorLayout
{
    /// <summary>
    /// The page size select, the "start-end of total" summary, first, previous, "page / count",
    /// next and last. On a narrow grid it drops the page size select first, then first and last.
    /// </summary>
    Full,

    /// <summary>Always the narrow layout: the summary, previous, "page / count" and next.</summary>
    Compact
}

/// <summary>Which edge a column is pinned to.</summary>
public enum PinPosition
{
    Start,
    End
}

/// <summary>Inline-editing granularity: commit each cell independently, or the whole row as a batch.</summary>
public enum EditMode
{
    Cell,
    Row
}

/// <summary>The interaction that opens a cell editor.</summary>
public enum EditTrigger
{
    Click,
    DoubleClick
}

/// <summary>Which sticky band a row is pinned to.</summary>
public enum RowPinPosition
{
    Top,
    Bottom
}
