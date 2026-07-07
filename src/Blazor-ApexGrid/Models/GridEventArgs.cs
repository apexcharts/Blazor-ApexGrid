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

// --- Column operations -------------------------------------------------------

/// <summary>Fired before a column's pin position changes (cancellable upstream).</summary>
public class GridColumnPinningEventArgs
{
    public string Key { get; set; } = string.Empty;
    /// <summary>The pin position before the change: "start", "end" or null (unpinned).</summary>
    public string? Previous { get; set; }
    /// <summary>The proposed pin position: "start", "end" or null (unpin).</summary>
    public string? Next { get; set; }
}

/// <summary>Fired after a column's pin position changes.</summary>
public class GridColumnPinnedEventArgs
{
    public string Key { get; set; } = string.Empty;
    /// <summary>The resolved pin position: "start", "end" or null.</summary>
    public string? Pinned { get; set; }
}

/// <summary>Fired before a column is moved (cancellable upstream).</summary>
public class GridColumnMovingEventArgs
{
    public string Key { get; set; } = string.Empty;
    public int FromIndex { get; set; }
    /// <summary>The reference column key the moving column is placed before/after.</summary>
    public string ToKey { get; set; } = string.Empty;
    /// <summary>"before" or "after".</summary>
    public string Position { get; set; } = string.Empty;
}

/// <summary>Fired after a column is moved.</summary>
public class GridColumnMovedEventArgs
{
    public string Key { get; set; } = string.Empty;
    public int FromIndex { get; set; }
    public int ToIndex { get; set; }
}

// --- Cell editing ------------------------------------------------------------

/// <summary>Fired before a cell value is committed (cancellable upstream).</summary>
/// <typeparam name="TItem">The row data type.</typeparam>
public class GridCellValueChangingEventArgs<TItem>
{
    public string Key { get; set; } = string.Empty;
    /// <summary>The view-relative row index.</summary>
    public int RowIndex { get; set; }
    public TItem? Data { get; set; }
    public JsonElement OldValue { get; set; }
    public JsonElement NewValue { get; set; }
}

/// <summary>Fired after a cell value is committed.</summary>
/// <typeparam name="TItem">The row data type.</typeparam>
public class GridCellValueChangedEventArgs<TItem>
{
    public string Key { get; set; } = string.Empty;
    public int RowIndex { get; set; }
    public TItem? Data { get; set; }
    public JsonElement Value { get; set; }
}

/// <summary>Fired when a candidate cell value is rejected by the column's validators.</summary>
/// <typeparam name="TItem">The row data type.</typeparam>
public class GridCellValidationFailedEventArgs<TItem>
{
    public string Key { get; set; } = string.Empty;
    public int RowIndex { get; set; }
    public TItem? Data { get; set; }
    public JsonElement Value { get; set; }
    /// <summary>The collected validator error messages.</summary>
    public List<string> Errors { get; set; } = new();
}

/// <summary>Fired after the undo/redo stacks change. Carries the current button states.</summary>
public class GridHistoryChangedEventArgs
{
    public bool CanUndo { get; set; }
    public bool CanRedo { get; set; }
}

/// <summary>Fired when a row enters edit mode (row edit mode only).</summary>
public class GridRowEditStartedEventArgs
{
    public int RowIndex { get; set; }
}

/// <summary>Fired when a row leaves edit mode (row edit mode only).</summary>
public class GridRowEditEndedEventArgs
{
    public int RowIndex { get; set; }
    /// <summary>True when pending edits were applied, false when discarded.</summary>
    public bool Committed { get; set; }
}

// --- Row pinning / reordering ------------------------------------------------

/// <summary>Fired before (rowPinning) and after (rowPinned) a row's pin state changes.</summary>
/// <typeparam name="TItem">The row data type.</typeparam>
public class GridRowPinningEventArgs<TItem>
{
    public TItem? Row { get; set; }
    /// <summary>The target band: "top"/"bottom" when pinning, or null when unpinning.</summary>
    public string? Position { get; set; }
}

/// <summary>Fired before (rowMoving) and after (rowMoved) a row is moved.</summary>
/// <typeparam name="TItem">The row data type.</typeparam>
public class GridRowMovingEventArgs<TItem>
{
    /// <summary>The moving row's view index before the move.</summary>
    public int From { get; set; }
    /// <summary>The target row's view index.</summary>
    public int To { get; set; }
    public TItem? Data { get; set; }
}

/// <summary>The currently pinned rows, per sticky band.</summary>
/// <typeparam name="TItem">The row data type.</typeparam>
public class GridPinnedRows<TItem>
{
    public List<TItem> Top { get; set; } = new();
    public List<TItem> Bottom { get; set; } = new();
}

// --- Row expansion / tree ----------------------------------------------------

/// <summary>Fired before (rowExpanding) and after (rowExpanded) the master-detail expansion set changes.</summary>
/// <typeparam name="TItem">The row data type.</typeparam>
public class GridRowExpansionEventArgs<TItem>
{
    /// <summary>Rows that became (or will become) expanded in this change.</summary>
    public List<TItem> Added { get; set; } = new();
    /// <summary>Rows that became (or will become) collapsed in this change.</summary>
    public List<TItem> Removed { get; set; } = new();
    /// <summary>The full expansion set (before the change for -ing, after for -ed).</summary>
    public List<TItem> Current { get; set; } = new();
    /// <summary>The proposed full expansion set (populated on the cancellable -ing event).</summary>
    public List<TItem> Next { get; set; } = new();
    /// <summary>The full expansion set after the change (populated on the -ed event).</summary>
    public List<TItem> Expanded { get; set; } = new();
}

/// <summary>Fired before (treeRowExpanding) and after (treeRowExpanded) the tree-expansion set changes.</summary>
/// <typeparam name="TItem">The row data type.</typeparam>
public class GridTreeRowExpansionEventArgs<TItem>
{
    public List<TItem> Added { get; set; } = new();
    public List<TItem> Removed { get; set; } = new();
    public List<TItem> Current { get; set; } = new();
    public List<TItem> Next { get; set; } = new();
    public List<TItem> Expanded { get; set; } = new();
}
