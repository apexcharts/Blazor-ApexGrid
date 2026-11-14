using Blazor_ApexGrid.Sample;
using Microsoft.AspNetCore.Components.Web;
using Microsoft.AspNetCore.Components.WebAssembly.Hosting;

var builder = WebAssemblyHostBuilder.CreateDefault(args);
builder.RootComponents.Add<App>("#app");
builder.RootComponents.Add<HeadOutlet>("head::after");

// Blazor-ApexGrid-Enterprise: the license key for the enterprise grids (none here, so they render
// the trial watermark), and the feature modules, all of them by default.
builder.Services.AddApexGridEnterprise(options =>
{
    options.LicenseKey = builder.Configuration["ApexGrid:LicenseKey"];
});

await builder.Build().RunAsync();
