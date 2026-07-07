using System.Collections.Generic;
using System.Text.Json;

namespace Blazor_ApexGrid.Models;

// Event payloads are deserialized by Blazor's JSInterop (whose default options apply no string-enum
// converter), so these read models use string fields for enum-like values. Row arrays deserialize
// into the component's TItem.

/// <summary>A filter expression as reported by grid events.</summary>
public class GridFilterExpressionInfo
{
    public string Key { get; set; } = string.Empty;
    /// <summary>Operand name (or an object when a custom operation was supplied).</summary>
    public JsonElement Condition { get; set; }
    public JsonElement? SearchTerm { get; set; }
    /// <summary>"and" or "or".</summary>
    public string? Criteria { get; set; }
    public bool? CaseSensitive { get; set; }
}

/// <summary>Fired while (sorting) and after (sorted) a column sort is applied.</summary>
public class GridSortEventArgs
{
    public string Key { get; set; } = string.Empty;
    /// <summary>"ascending", "descending" or "none".</summary>
    public string Direction { get; set; } = string.Empty;
    public bool? CaseSensitive { get; set; }
}

/// <summary>Fired before a column's filter state changes.</summary>
public class GridFilteringEventArgs
{
    public string Key { get; set; } = string.Empty;
    /// <summary>"add", "modify" or "remove".</summary>
    public string Type { get; set; } = string.Empty;
    public List<GridFilterExpressionInfo> Expressions { get; set; } = new();
}

/// <summary>Fired after a column's filter state changes.</summary>
public class GridFilteredEventArgs
{
    public string Key { get; set; } = string.Empty;
    public List<GridFilterExpressionInfo> State { get; set; } = new();
}

/// <summary>Fired before the page or page size changes (cancellable upstream).</summary>
public class GridPageChangingEventArgs
{
    public int Page { get; set; }
    public int PageSize { get; set; }
    public int NextPage { get; set; }
    public int NextPageSize { get; set; }
}

/// <summary>Fired after the page or page size changes. Mirrors the grid's pagination state.</summary>
public class GridPageChangedEventArgs
{
    public int Page { get; set; }
    public int PageSize { get; set; }
    public int PageCount { get; set; }
    public int TotalItems { get; set; }
}

/// <summary>Fired as the quick-filter text is changing.</summary>
public class GridQuickFilterChangingEventArgs
{
    public string Value { get; set; } = string.Empty;
    public string NextValue { get; set; } = string.Empty;
}

/// <summary>Fired after the quick-filter text changes.</summary>
public class GridQuickFilterChangedEventArgs
{
    public string Value { get; set; } = string.Empty;
}

/// <summary>Fired before the selection changes.</summary>
/// <typeparam name="TItem">The row data type.</typeparam>
public class GridRowSelectingEventArgs<TItem>
{
    public List<TItem> Added { get; set; } = new();
    public List<TItem> Removed { get; set; } = new();
    public List<TItem> Current { get; set; } = new();
    public List<TItem> Next { get; set; } = new();
}

/// <summary>Fired after the selection changes.</summary>
/// <typeparam name="TItem">The row data type.</typeparam>
public class GridRowSelectedEventArgs<TItem>
{
    public List<TItem> Added { get; set; } = new();
    public List<TItem> Removed { get; set; } = new();
    public List<TItem> Selected { get; set; } = new();
}

/// <summary>Fired when the grid's persisted UI state changes (raw snapshot).</summary>
public class GridStateChangedEventArgs
{
    public JsonElement State { get; set; }
}
