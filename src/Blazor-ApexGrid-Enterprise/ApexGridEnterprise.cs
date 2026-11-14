namespace Blazor_ApexGrid_Enterprise;

/// <summary>
/// The apex-grid-enterprise feature modules this package bundles. An enterprise grid gets only
/// the modules the app selects (see <see cref="ApexGridEnterpriseOptions.Modules"/>); a property
/// whose module is not selected is ignored, as in apex-grid-enterprise.
/// </summary>
[Flags]
public enum ApexGridEnterpriseModules
{
    /// <summary>No feature modules: the grid has the community features, XLSX export and the watermark.</summary>
    None = 0,

    /// <summary><c>aggregationModule</c>: <c>Aggregations</c> and <c>GetAggregationsAsync</c>.</summary>
    Aggregation = 1,

    /// <summary><c>groupingModule</c>: <c>GroupBy</c> row grouping with group subtotals.</summary>
    Grouping = 2,

    /// <summary><c>pivotModule</c>: <c>Pivot</c>.</summary>
    Pivot = 4,

    /// <summary><c>totalRowModule</c>: <c>TotalRow</c> and <c>GetTotalsAsync</c>.</summary>
    TotalRow = 8,

    /// <summary><c>rangeSelectionModule</c>: cell range selection, the fill handle, and range copy and paste.</summary>
    RangeSelection = 16,

    /// <summary><c>contextMenuModule</c>: the right-click and header kebab menu.</summary>
    ContextMenu = 32,

    /// <summary>Every declarative module above. The default.</summary>
    All = Aggregation | Grouping | Pivot | TotalRow | RangeSelection | ContextMenu,
}

/// <summary>Settings shared by every enterprise grid in the app.</summary>
public class ApexGridEnterpriseOptions
{
    /// <summary>
    /// The license key (<c>APEX-...</c>). Without one the grids keep working but render a trial
    /// watermark, which is for evaluation only.
    /// </summary>
    public string? LicenseKey { get; set; }

    /// <summary>The feature modules to opt into. Default: <see cref="ApexGridEnterpriseModules.All"/>.</summary>
    public ApexGridEnterpriseModules Modules { get; set; } = ApexGridEnterpriseModules.All;
}

/// <summary>
/// The license key and the feature modules for every <c>ApexGridEnterprise</c> in the app.
/// </summary>
/// <remarks>
/// Set both once at startup, in Program.cs, before the first enterprise grid renders: either here
/// or through <c>builder.Services.AddApexGridEnterprise(...)</c>, which sets the same values. The
/// first enterprise grid on a page opts apex-grid-enterprise into the modules, registers
/// <c>&lt;apex-grid-enterprise&gt;</c> and calls <c>ApexGridEnterprise.setLicense(key)</c>; every
/// grid that renders later applies a key that changed since.
/// <para>
/// Licensing is offline: there are no network calls and nothing is blocked. Without a valid key
/// (none set, a key that fails its signature check, or one whose subscription has ended) each
/// enterprise grid renders the trial watermark; a key that is set but cannot be used also logs a
/// console warning that says why. Community <c>ApexGrid</c> components on the same page are not
/// affected.
/// </para>
/// </remarks>
public static class ApexGridEnterprise
{
    /// <summary>The license key set with <see cref="SetLicense"/>, or <c>null</c>.</summary>
    public static string? LicenseKey { get; private set; }

    /// <summary>The feature modules the grids opt into. Default: all of them.</summary>
    public static ApexGridEnterpriseModules Modules { get; private set; } = ApexGridEnterpriseModules.All;

    /// <summary>Sets the license key that removes the trial watermark. Call it in Program.cs.</summary>
    /// <example>
    /// <code>
    /// // in Program.cs
    /// ApexGridEnterprise.SetLicense(builder.Configuration["ApexGrid:LicenseKey"]);
    /// </code>
    /// </example>
    public static void SetLicense(string? key) => LicenseKey = string.IsNullOrWhiteSpace(key) ? null : key.Trim();

    /// <summary>
    /// Selects the feature modules the grids opt into. Modules are registered with the element when
    /// the first enterprise grid on a page renders, so call this in Program.cs; a selection made
    /// later adds modules for the grids created after it and cannot remove one.
    /// </summary>
    public static void UseModules(ApexGridEnterpriseModules modules) => Modules = modules;

    /// <summary>Applies <paramref name="options"/>: its key and its modules.</summary>
    public static void Configure(ApexGridEnterpriseOptions options)
    {
        ArgumentNullException.ThrowIfNull(options);
        SetLicense(options.LicenseKey);
        UseModules(options.Modules);
    }

    // the module ids the interop module maps to apex-grid-enterprise's module objects
    internal static string[] ModuleIds(ApexGridEnterpriseModules modules)
    {
        var ids = new List<string>();
        if (modules.HasFlag(ApexGridEnterpriseModules.Aggregation)) ids.Add("aggregation");
        if (modules.HasFlag(ApexGridEnterpriseModules.Grouping)) ids.Add("grouping");
        if (modules.HasFlag(ApexGridEnterpriseModules.Pivot)) ids.Add("pivot");
        if (modules.HasFlag(ApexGridEnterpriseModules.TotalRow)) ids.Add("totalRow");
        if (modules.HasFlag(ApexGridEnterpriseModules.RangeSelection)) ids.Add("rangeSelection");
        if (modules.HasFlag(ApexGridEnterpriseModules.ContextMenu)) ids.Add("contextMenu");
        return ids.ToArray();
    }
}
