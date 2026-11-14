using System.Collections.Generic;
using Blazor_ApexGrid.Components;
using Blazor_ApexGrid.Internal;
using Blazor_ApexGrid_Enterprise.Models;
using Microsoft.AspNetCore.Components;
using Microsoft.JSInterop;

namespace Blazor_ApexGrid_Enterprise.Components;

/// <summary>
/// The enterprise grid: renders <c>&lt;apex-grid-enterprise&gt;</c>, which extends
/// <c>&lt;apex-grid&gt;</c>, so every <see cref="ApexGrid{TItem}"/> parameter, method and event
/// works here unchanged. It adds row grouping, aggregations, a grand-total row, pivoting, cell
/// range selection, a context menu and XLSX export.
/// </summary>
/// <remarks>
/// A commercial product: without a license key (see
/// <see cref="Blazor_ApexGrid_Enterprise.ApexGridEnterprise.SetLicense"/>) the grid renders a trial
/// watermark. A feature works only when its module is selected (all are by default, see
/// <see cref="ApexGridEnterpriseModules"/>). The enterprise parameters apply on change, as
/// <c>Pagination</c> does: a change in .NET is pushed to the grid after the next render, and only
/// the parameters that changed are applied, so what the user did in the grid since (a group added
/// from the context menu, a group toggled) stays until the matching parameter changes.
/// </remarks>
/// <typeparam name="TItem">The row type.</typeparam>
public class ApexGridEnterprise<TItem> : ApexGrid<TItem>
{
    private string? _lastEnterpriseJson;
    private string? _appliedLicense;

    /// <inheritdoc />
    protected override string ElementTagName => "apex-grid-enterprise";

    /// <inheritdoc />
    protected override string ModulePath => "./_content/Blazor-ApexGrid-Enterprise/js/blazor-apexgrid-enterprise.js?ver=0.1.0";

    /// <summary>
    /// The columns to group rows by, outermost first, by camelCase key (apex-grid-enterprise
    /// <c>groupBy</c>). Group headers render full-width with a toggle, a leaf count, and the
    /// <see cref="Aggregations"/> as subtotals over the filtered leaves. Needs the Grouping module.
    /// </summary>
    [Parameter] public List<string>? GroupBy { get; set; }

    /// <summary>Initial expansion of the group rows. Needs the Grouping module.</summary>
    [Parameter] public GridGroupingOptions? GroupingOptions { get; set; }

    /// <summary>
    /// Aggregations per column (apex-grid-enterprise <c>aggregations</c>), shown on group headers
    /// and read with <see cref="GetAggregationsAsync"/>. Needs the Aggregation module.
    /// </summary>
    [Parameter] public GridAggregations? Aggregations { get; set; }

    /// <summary>A grand-total row over the whole view. Needs the TotalRow module.</summary>
    [Parameter] public GridTotalRowConfiguration? TotalRow { get; set; }

    /// <summary>A pivot of the rows into a cross-tab. Wins over <see cref="GroupBy"/>. Needs the Pivot module.</summary>
    [Parameter] public GridPivotConfiguration? Pivot { get; set; }

    /// <summary>
    /// Set to <c>false</c> to turn Excel-style cell range selection off. Ctrl or Cmd+C copies a
    /// range; paste and the fill handle write only to editable columns of a grid with
    /// <c>Editing</c> on. Default: on. Needs the RangeSelection module.
    /// </summary>
    [Parameter] public bool? RangeSelection { get; set; }

    /// <summary>
    /// The context menu: off, or extra items whose clicks raise <see cref="OnContextMenuItemClick"/>.
    /// Default: on, with the built-in items. Needs the ContextMenu module.
    /// </summary>
    [Parameter] public GridContextMenuConfiguration? ContextMenu { get; set; }

    /// <summary>The cell range selection changed (<c>apex-range-changed</c>), with live statistics.</summary>
    [Parameter] public EventCallback<GridRangeChangedEventArgs> OnRangeChanged { get; set; }

    /// <summary>A group row was expanded or collapsed (<c>groupExpanded</c>).</summary>
    [Parameter] public EventCallback<GridGroupExpandedEventArgs> OnGroupExpanded { get; set; }

    /// <summary>A context menu item from <see cref="GridContextMenuConfiguration.Items"/> was chosen.</summary>
    [Parameter] public EventCallback<GridContextMenuItemClickEventArgs<TItem>> OnContextMenuItemClick { get; set; }

    // what the interop module applies; events tell it which listeners to forward to .NET, so a
    // range drag does not cross the interop for every cell when nothing listens
    private object EnterpriseConfig() => new
    {
        groupBy = GroupBy,
        groupingOptions = GroupingOptions,
        aggregations = Aggregations,
        totalRow = TotalRow,
        pivot = Pivot,
        rangeSelection = RangeSelection,
        contextMenu = ContextMenu,
        events = new
        {
            rangeChanged = OnRangeChanged.HasDelegate,
            groupExpanded = OnGroupExpanded.HasDelegate,
        },
    };

    /// <inheritdoc />
    protected override void ExtendConfig(IDictionary<string, object?> config)
    {
        var enterprise = EnterpriseConfig();
        _lastEnterpriseJson = GridSerializer.Serialize(enterprise);
        config["enterprise"] = enterprise;
    }

    /// <inheritdoc />
    protected override async Task OnAfterRenderAsync(bool firstRender)
    {
        // Each grid passes the app's modules and key before its first init. The interop applies a
        // key once (a changed key again) and registers the element when the first grid comes.
        var license = Blazor_ApexGrid_Enterprise.ApexGridEnterprise.LicenseKey;
        if (firstRender || license != _appliedLicense)
        {
            _appliedLicense = license;
            var module = await GetModuleAsync();
            await module.InvokeVoidAsync(
                "configure",
                Blazor_ApexGrid_Enterprise.ApexGridEnterprise.ModuleIds(Blazor_ApexGrid_Enterprise.ApexGridEnterprise.Modules),
                license);
        }

        await base.OnAfterRenderAsync(firstRender);

        if (!firstRender && IsInitialized)
        {
            var json = GridSerializer.Serialize(EnterpriseConfig());
            if (json != _lastEnterpriseJson)
            {
                _lastEnterpriseJson = json;
                await (await GetModuleAsync()).InvokeVoidAsync("setEnterpriseConfig", ElementId, json);
            }
        }
    }

    // --- Aggregation and the total row ---------------------------------------

    /// <summary>The <see cref="Aggregations"/> computed over the current view.</summary>
    public async Task<GridAggregationResults> GetAggregationsAsync()
        => IsInitialized
            ? await (await GetModuleAsync()).InvokeAsync<GridAggregationResults>("getAggregations", ElementId)
            : new();

    /// <summary>The values the grand-total row shows (empty without <see cref="TotalRow"/> or during a pivot).</summary>
    public async Task<GridAggregationResults> GetTotalsAsync()
        => IsInitialized
            ? await (await GetModuleAsync()).InvokeAsync<GridAggregationResults>("getTotals", ElementId)
            : new();

    // --- Grouping --------------------------------------------------------------

    /// <summary>Every group row in the current view, outermost first, without their leaf rows.</summary>
    public async Task<List<GridGroupInfo>> GetGroupsAsync()
        => IsInitialized
            ? await (await GetModuleAsync()).InvokeAsync<List<GridGroupInfo>>("getGroups", ElementId)
            : new();

    /// <summary>Expands the group with the given path key (see <see cref="GridGroupInfo.Key"/>).</summary>
    public Task ExpandGroupAsync(string key) => CallAsync("expandGroup", key);

    /// <summary>Collapses the group with the given path key.</summary>
    public Task CollapseGroupAsync(string key) => CallAsync("collapseGroup", key);

    /// <summary>Toggles the group with the given path key.</summary>
    public Task ToggleGroupAsync(string key) => CallAsync("toggleGroup", key);

    /// <summary>Expands every group row.</summary>
    public Task ExpandAllGroupsAsync() => CallAsync("expandAllGroups");

    /// <summary>Collapses every group row.</summary>
    public Task CollapseAllGroupsAsync() => CallAsync("collapseAllGroups");

    // --- Pivot -------------------------------------------------------------------

    /// <summary>Whether a pivot view is active.</summary>
    public async Task<bool> IsPivotingAsync()
        => IsInitialized && await (await GetModuleAsync()).InvokeAsync<bool>("isPivoting", ElementId);

    // --- Range selection -----------------------------------------------------------

    /// <summary>Selects the cells from <paramref name="from"/> to <paramref name="to"/> (one cell without it).</summary>
    public Task SelectRangeAsync(GridCellAddress from, GridCellAddress? to = null) => CallAsync("selectRange", from, to);

    /// <summary>Clears the cell range selection.</summary>
    public Task ClearRangeSelectionAsync() => CallAsync("clearRangeSelection");

    /// <summary>Statistics over the selected cells.</summary>
    public async Task<GridRangeStats> GetSelectionStatsAsync()
        => IsInitialized
            ? await (await GetModuleAsync()).InvokeAsync<GridRangeStats>("getSelectionStats", ElementId)
            : new();

    /// <summary>The active range, or <c>null</c> when nothing is selected.</summary>
    public async Task<GridRangeBounds?> GetSelectionBoundsAsync()
        => IsInitialized
            ? await (await GetModuleAsync()).InvokeAsync<GridRangeBounds?>("getSelectionBounds", ElementId)
            : null;

    // --- XLSX export -----------------------------------------------------------------

    /// <summary>
    /// Downloads the grid as an .xlsx file (<c>data.xlsx</c> unless <see cref="GridXlsxExportOptions.Filename"/>
    /// names it). With <c>ShowExport</c> the toolbar's export menu offers the same as "Export XLSX".
    /// </summary>
    public async Task ExportToXlsxAsync(GridXlsxExportOptions? options = null)
    {
        if (!IsInitialized) return;
        await (await GetModuleAsync()).InvokeVoidAsync("exportToXlsx", ElementId, GridSerializer.Serialize(options));
    }

    /// <summary>
    /// Builds the .xlsx workbook and returns its bytes without a download, for example to attach
    /// it to an email or upload it. <see cref="GridXlsxExportOptions.Filename"/> is ignored.
    /// </summary>
    public async Task<byte[]> GetXlsxBytesAsync(GridXlsxExportOptions? options = null)
        => IsInitialized
            ? await (await GetModuleAsync()).InvokeAsync<byte[]>("getXlsxBytes", ElementId, GridSerializer.Serialize(options))
            : Array.Empty<byte>();

    private async Task CallAsync(string identifier, params object?[] args)
    {
        if (!IsInitialized) return;
        var all = new object?[args.Length + 1];
        all[0] = ElementId;
        args.CopyTo(all, 1);
        await (await GetModuleAsync()).InvokeVoidAsync(identifier, all);
    }

    // --- JS -> .NET event bridge ---------------------------------------------------
    [JSInvokable] public Task HandleRangeChanged(GridRangeChangedEventArgs a) => Raise(OnRangeChanged, a);
    [JSInvokable] public Task HandleGroupExpanded(GridGroupExpandedEventArgs a) => Raise(OnGroupExpanded, a);
    [JSInvokable] public Task HandleContextMenuItemClick(GridContextMenuItemClickEventArgs<TItem> a) => Raise(OnContextMenuItemClick, a);

    private static Task Raise<T>(EventCallback<T> callback, T args)
        => callback.HasDelegate ? callback.InvokeAsync(args) : Task.CompletedTask;
}
