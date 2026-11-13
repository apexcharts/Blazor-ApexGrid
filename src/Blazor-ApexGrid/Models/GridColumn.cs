using System.Collections.Generic;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Blazor_ApexGrid.Models;

/// <summary>
/// Configures a <see cref="GridDataType.Chart"/> column. Every property is optional. The core's
/// per-row options function and its <c>label</c> function cannot cross the interop, so they are not
/// modelled: <see cref="Options"/> is the same for every row, and each cell keeps the default
/// accessible name.
/// </summary>
public class GridColumnChartConfiguration
{
    /// <summary>
    /// The ApexCharts chart type, such as <c>"line"</c> (the default), <c>"area"</c>,
    /// <c>"bar"</c>, <c>"pie"</c>, <c>"donut"</c>, <c>"radialBar"</c> or <c>"polarArea"</c>. An
    /// axis chart takes a number array (one series) or an array of <c>{ data }</c> series; a pie,
    /// donut, radialBar or polarArea chart takes a number array, one value per slice or ring. A
    /// <c>chart.type</c> in <see cref="Options"/> takes precedence.
    /// </summary>
    public string? Type { get; set; }

    /// <summary>Chart height in pixels. Defaults to 28.</summary>
    public int? Height { get; set; }

    /// <summary>Chart width as a CSS length, such as <c>"120px"</c>. Defaults to <c>"100%"</c> of the cell.</summary>
    public string? Width { get; set; }

    /// <summary>
    /// ApexCharts options merged over the column defaults (sparkline mode, no animation, no tooltip,
    /// no toolbar, the grid's brand colour). Objects merge; arrays replace. Any value that serializes
    /// to the ApexCharts option shape works: an anonymous object, a dictionary or a
    /// <see cref="JsonElement"/>. Property names are camelCased, dictionary keys are sent as written.
    /// </summary>
    public object? Options { get; set; }
}

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
    /// Chart options for a <see cref="GridDataType.Chart"/> column: chart type, size and ApexCharts
    /// options. A <c>double[]</c> (or <c>double?[]</c>, with nulls drawn as gaps) row value is one
    /// series. ApexCharts is not bundled: load ApexCharts 8.4.1 or later on the page yourself.
    /// Requires apex-grid 4.1 or later.
    /// </summary>
    public GridColumnChartConfiguration? Chart { get; set; }

    /// <summary>
    /// Escape hatch for column options not modeled above (including function-typed renderers/templates
    /// supplied as JS function strings). Keys must be the exact names the core expects.
    /// </summary>
    [JsonExtensionData]
    public Dictionary<string, JsonElement>? AdditionalConfig { get; set; }
}
