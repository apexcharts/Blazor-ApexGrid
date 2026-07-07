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
