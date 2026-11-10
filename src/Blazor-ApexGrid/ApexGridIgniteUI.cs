namespace Blazor_ApexGrid;

/// <summary>
/// Opts the grids into Ignite UI theming.
/// </summary>
/// <remarks>
/// With this on, the interop module loads the apex-grid Ignite UI add-on
/// (<c>_content/Blazor-ApexGrid/js/apex-grid.ignite-ui.bundle.js</c>) once, before the first grid
/// initializes. Every grid on the page then follows the Ignite UI theme the page loads (its
/// <c>--ig-*</c> tokens): an <c>--ag-*</c> token you set wins, then the family <c>--apx-*</c>
/// tokens, then Ignite UI, then the built-in values. The add-on needs no extra license key.
/// Set <c>DesignSystem="false"</c> on a grid to turn it off for that grid. Requires apex-grid 4.0
/// or later in the bundle.
/// </remarks>
public static class ApexGridIgniteUI
{
    /// <summary>Gets whether the Ignite UI add-on is loaded before the first grid initializes.</summary>
    public static bool IsEnabled { get; private set; }

    /// <summary>
    /// Loads the Ignite UI add-on before the first grid initializes. Call this in Program.cs.
    /// </summary>
    /// <example>
    /// <code>
    /// // in Program.cs
    /// ApexGridIgniteUI.Enable();
    /// </code>
    /// </example>
    public static void Enable() => IsEnabled = true;
}
