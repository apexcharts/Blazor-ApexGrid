using System.Text.Json.Serialization;

namespace Blazor_ApexGrid.Models;

// The grid serializer registers a camelCase string-enum converter, so these members serialize to
// the lowercase values the core expects (Number -> "number", Start -> "start").

/// <summary>Column data type, controlling the built-in cell renderer and editor.</summary>
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
    Status
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
