using System.Collections.Generic;

namespace Blazor_ApexGrid.Models;

// Enums serialize as camelCase strings via GridSerializer (Ascending -> "ascending").

/// <summary>Row selection mode.</summary>
public enum SelectionMode { Single, Multiple }

/// <summary>Pagination data mode: local slicing or remote (server-driven).</summary>
public enum PaginationMode { Local, Remote }

/// <summary>Sort direction.</summary>
public enum SortingDirection { Ascending, Descending, None }

/// <summary>How multiple filter expressions on a column combine.</summary>
public enum FilterCriteria { And, Or }

/// <summary>Grid-wide sorting behavior.</summary>
public class GridSortConfiguration
{
    /// <summary>Allow sorting by multiple columns at once.</summary>
    public bool Multiple { get; set; }

    /// <summary>Cycle header clicks through ascending, descending, then unsorted.</summary>
    public bool TriState { get; set; }
}

/// <summary>Pagination configuration.</summary>
public class PaginationConfiguration
{
    /// <summary>Enable pagination.</summary>
    public bool? Enabled { get; set; }

    /// <summary>Local slicing or remote mode.</summary>
    public PaginationMode? Mode { get; set; }

    /// <summary>Current (zero-based) page.</summary>
    public int? Page { get; set; }

    /// <summary>Rows per page.</summary>
    public int? PageSize { get; set; }

    /// <summary>Options offered in the page-size selector.</summary>
    public List<int>? PageSizeOptions { get; set; }

    /// <summary>Total item count (required in remote mode).</summary>
    public int? TotalItems { get; set; }
}

/// <summary>Inline-editing configuration. Per-column opt-in is still required via <see cref="GridColumn{TItem}.Editable"/>.</summary>
public class GridEditingConfiguration
{
    /// <summary>Enable inline editing.</summary>
    public bool? Enabled { get; set; }

    /// <summary>Commit cells independently, or the whole row as a batch. Defaults to Cell.</summary>
    public EditMode? Mode { get; set; }

    /// <summary>Interaction that opens an editor. Defaults to DoubleClick.</summary>
    public EditTrigger? Trigger { get; set; }

    /// <summary>Undo/redo history for committed edits.</summary>
    public EditingHistoryConfiguration? History { get; set; }
}

/// <summary>Undo/redo history configuration for cell edits.</summary>
public class EditingHistoryConfiguration
{
    /// <summary>Track committed edits so they can be undone/redone.</summary>
    public bool Enabled { get; set; }

    /// <summary>Maximum number of commands retained on the undo stack. Defaults to 100.</summary>
    public int? StackSize { get; set; }
}

/// <summary>Row-pinning configuration (sticky top/bottom bands).</summary>
public class GridRowPinningConfiguration
{
    /// <summary>Allow pinning rows to a sticky band.</summary>
    public bool Enabled { get; set; }
}

/// <summary>Row-reordering configuration (drag/keyboard reorder).</summary>
public class GridRowReorderingConfiguration
{
    /// <summary>Allow reordering rows. A manual order is mutually exclusive with column sorting.</summary>
    public bool Enabled { get; set; }

    /// <summary>Also splice the source data array in place so it reflects the new order.</summary>
    public bool? ApplyToData { get; set; }

    /// <summary>Render a dedicated drag handle (true, default) rather than dragging the whole row.</summary>
    public bool? Handle { get; set; }
}

/// <summary>
/// Tree-data (nested rows) configuration. The data array stays flat; the grid derives the
/// hierarchy from each row's path array, read from the <see cref="PathKey"/> field.
/// </summary>
public class GridTreeConfiguration
{
    /// <summary>Enable tree mode.</summary>
    public bool Enabled { get; set; }

    /// <summary>
    /// The row field (serialized/camelCase name) holding the hierarchical path, a string array
    /// from root to the row (e.g. ["Adrian"], ["Adrian", "Bryan"]). Required when enabled.
    /// </summary>
    public string PathKey { get; set; } = string.Empty;

    /// <summary>Which column shows the chevron + indentation. Defaults to the first visible column.</summary>
    public string? GroupColumnKey { get; set; }

    /// <summary>Initial expansion: false (collapsed), true (all), or a depth number.</summary>
    public object? DefaultExpanded { get; set; }

    /// <summary>Pixels of indentation per depth level. Defaults to 20.</summary>
    public int? ChildIndent { get; set; }
}

/// <summary>
/// Master-detail row-expansion configuration. The detail panel is rendered from
/// <see cref="DetailTemplateHtml"/>, an HTML string whose <c>{field}</c> tokens are replaced with
/// the row's (HTML-escaped) values.
/// </summary>
public class GridExpansionConfiguration
{
    /// <summary>Enable row expansion.</summary>
    public bool Enabled { get; set; }

    /// <summary>
    /// HTML template for the detail panel. <c>{field}</c> tokens are substituted with the matching
    /// row field's value (HTML-escaped). Required when enabled.
    /// </summary>
    public string DetailTemplateHtml { get; set; } = string.Empty;

    /// <summary>Render the built-in chevron toggle column. Defaults to true.</summary>
    public bool? ShowToggleColumn { get; set; }
}

/// <summary>Row-selection configuration.</summary>
public class GridSelectionConfiguration
{
    /// <summary>Enable selection.</summary>
    public bool? Enabled { get; set; }

    /// <summary>Single or multiple selection.</summary>
    public SelectionMode? Mode { get; set; }

    /// <summary>Show the leading selection checkbox column.</summary>
    public bool? ShowCheckboxColumn { get; set; }
}

/// <summary>A sort expression passed to the sort API.</summary>
public class GridSortExpression
{
    /// <summary>Column key to sort by.</summary>
    public string Key { get; set; } = string.Empty;

    /// <summary>Sort direction.</summary>
    public SortingDirection Direction { get; set; } = SortingDirection.Ascending;

    /// <summary>Match case when comparing string values.</summary>
    public bool? CaseSensitive { get; set; }
}

/// <summary>A filter expression passed to the filter API.</summary>
public class GridFilterExpression
{
    /// <summary>Column key to filter.</summary>
    public string Key { get; set; } = string.Empty;

    /// <summary>
    /// Operand name for the column's data type, e.g. "contains"/"startsWith"/"equals" (string),
    /// "greaterThan"/"lessThan"/"equals" (number), "all"/"true"/"false" (boolean).
    /// </summary>
    public string Condition { get; set; } = string.Empty;

    /// <summary>Value to compare against (omit for unary conditions like "empty").</summary>
    public object? SearchTerm { get; set; }

    /// <summary>How this expression combines with others on the same column.</summary>
    public FilterCriteria? Criteria { get; set; }

    /// <summary>Match case for string comparisons.</summary>
    public bool? CaseSensitive { get; set; }
}
