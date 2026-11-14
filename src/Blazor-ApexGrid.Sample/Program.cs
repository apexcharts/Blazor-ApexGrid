using Blazor_ApexGrid.Sample;
using Blazor_ApexGrid_Enterprise;
using Microsoft.AspNetCore.Components.Web;
using Microsoft.AspNetCore.Components.WebAssembly.Hosting;

var builder = WebAssemblyHostBuilder.CreateDefault(args);
builder.RootComponents.Add<App>("#app");
builder.RootComponents.Add<HeadOutlet>("head::after");

// Blazor-ApexGrid-Enterprise: the license key for the enterprise grids (none in
// wwwroot/appsettings.json, so they render the trial watermark), and the feature modules: all of
// them, unless ApexGrid:Modules names a subset such as "Grouping, Aggregation".
builder.Services.AddApexGridEnterprise(options =>
{
    options.LicenseKey = builder.Configuration["ApexGrid:LicenseKey"];
    if (Enum.TryParse<ApexGridEnterpriseModules>(builder.Configuration["ApexGrid:Modules"], out var modules))
        options.Modules = modules;
});

await builder.Build().RunAsync();
