using Blazor_ApexGrid_Enterprise;

namespace Microsoft.Extensions.DependencyInjection;

/// <summary>Registers Blazor-ApexGrid-Enterprise's settings.</summary>
public static class ApexGridEnterpriseServiceCollectionExtensions
{
    /// <summary>
    /// Sets the license key and the feature modules for every <c>ApexGridEnterprise</c> in the app,
    /// and registers the <see cref="ApexGridEnterpriseOptions"/> as a singleton. Equivalent to
    /// <see cref="ApexGridEnterprise.Configure"/>.
    /// </summary>
    /// <example>
    /// <code>
    /// builder.Services.AddApexGridEnterprise(options =>
    /// {
    ///     options.LicenseKey = builder.Configuration["ApexGrid:LicenseKey"];
    /// });
    /// </code>
    /// </example>
    public static IServiceCollection AddApexGridEnterprise(
        this IServiceCollection services, Action<ApexGridEnterpriseOptions>? configure = null)
    {
        ArgumentNullException.ThrowIfNull(services);
        var options = new ApexGridEnterpriseOptions();
        configure?.Invoke(options);
        ApexGridEnterprise.Configure(options);
        services.AddSingleton(options);
        return services;
    }
}
