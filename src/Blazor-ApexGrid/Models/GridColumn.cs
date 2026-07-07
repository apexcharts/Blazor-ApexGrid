using System.Collections.Generic;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Blazor_ApexGrid.Models;

/// <summary>
/// A column definition for <see cref="Components.ApexGrid{TItem}"/>. Mirrors the core
/// <c>ColumnConfiguration</c> (apex-grid 3.3). <typeparamref name="TItem"/> is the row type; use
/// <see cref="Key"/> to bind the column to a property (by its serialized/camelCase name).
/// </summary>
/// <typeparam name="TItem">The row data type.</typeparam>
public class GridColumn<TItem>
{
    /// <summary>The row field this column binds to (the property's serialized/camelCase name).</summary>
    public string Key { get; set; } = string.Empty;

    /// <summary>Header label. Falls back to <see cref="Key"/> when omitted.</summary>
    public string? HeaderText { get; set; }

    /// <summary>Data type, controlling the built-in cell renderer/editor.</summary>
    public GridDataType? Type { get; set; }

    /// <summary>Column width (CSS value, e.g. "160px" or "1fr").</summary>
    public string? Width { get; set; }

    /// <summary>Hide the column.</summary>
    public bool? Hidden { get; set; }

    /// <summary>Include the column when exporting.</summary>
    public bool? Exportable { get; set; }

    /// <summary>Pin the column to the start or end.</summary>
    public PinPosition? Pinned { get; set; }

    /// <summary>Allow reordering this column by dragging its header.</summary>
    public bool? Reorderable { get; set; }

    /// <summary>Allow resizing this column.</summary>
    public bool? Resizable { get; set; }

    /// <summary>Enable sorting on this column (true for defaults, or a sort config object).</summary>
    public bool? Sort { get; set; }

    /// <summary>Enable filtering on this column (true for defaults, or a filter config object).</summary>
    public bool? Filter { get; set; }

    /// <summary>Allow inline editing of this column's cells (requires grid editing to be enabled).</summary>
    public bool? Editable { get; set; }

    /// <summary>
    /// Escape hatch for column options not modeled above (including function-typed renderers/templates
    /// supplied as JS function strings). Keys must be the exact names the core expects.
    /// </summary>
    [JsonExtensionData]
    public Dictionary<string, JsonElement>? AdditionalConfig { get; set; }
}
