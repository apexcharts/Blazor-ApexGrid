# Roadmap and open items

Decisions and known defects for `Blazor-ApexGrid`, recorded so they survive the
conversations that produced them. Nothing here is packed into the nupkg (only
`README.md` and `LICENSE.md` are).

Last reviewed: 2026-11-14.

---

## 1. Enterprise support ships as a second package

**Decision: `Blazor-ApexGrid-Enterprise`, a companion package. Not an `Edition`
parameter on this one.**

**Built: Blazor-ApexGrid-Enterprise 0.1.0, with Blazor-ApexGrid 1.4.0
(2026-11-14, not released).** What it is, and what is still open:

- **Where.** `src/Blazor-ApexGrid-Enterprise`, a second project in this repo
  (as Blazor-ApexCharts keeps its MAUI companion), same TFMs and package
  metadata, packed with its own `README.md` and the commercial `LICENSE.md`
  that mirrors apex-grid-enterprise's terms. It references
  `Blazor-ApexGrid` as a project, which packs as a NuGet dependency
  (`>= 1.4.0`), and carries only its own static web assets.
- **One apex-grid core per page.** apex-grid-enterprise 0.10.0 imports
  `apex-grid`, `apex-grid/internal` and Lit. The enterprise bundle inlines
  none of them: `build/bundle.mjs` makes the community bundle publish those
  modules' namespaces on a registry (`Symbol.for("blazor-apexgrid.shared")`,
  the list is `build/shared.mjs`), and `build/bundle-enterprise.mjs`
  answers every import of them from that registry (and fails the build if a
  file of the core or Lit is inlined, or a bare import remains). The
  enterprise interop module imports Blazor-ApexGrid's interop module first,
  so the core has always run before the enterprise bundle, whichever
  package's component renders first; the browser runs the core bundle URL
  once. The enterprise bundle never names that URL, so a Blazor-ApexGrid
  update that moves its `?ver=` cannot load a second core; it checks the
  core's version against apex-grid-enterprise's range (`^5.0.0`) instead.
  `tests/e2e/enterprise.mjs` proves it for enterprise first, community
  first and both at once: `<apex-grid-enterprise>` extends the registered
  `<apex-grid>` class, one core bundle URL, each core tag defined once, one
  `apex-grid-row` class. A bundle built with its own core fails those checks
  (tried by swapping one in): nothing throws and the grids still render,
  which is why the check is on the class chain.
- **Seam opened in `ApexGrid<TItem>` (1.4.0).** `ExtendConfig` (protected
  virtual: adds keys to the init config), `ElementId`, `IsInitialized` and
  `GetModuleAsync` (protected), and an `applyConfig` parameter on the
  interop `init` that a wrapping module passes. The `?ver=` cache busters
  now carry the package version, since the vendored core bundle changed
  without a core bump.
- **Modelled.** `GroupBy`, `GroupingOptions`, `Aggregations`, `TotalRow`,
  `Pivot` (rows, on, values and `PivotOptions`), `RangeSelection`,
  `ContextMenu` (on or off, and .NET items whose click raises
  `OnContextMenuItemClick`, added through the `apex-context-menu-opening`
  event so the built-in items stay), XLSX export (`ExportToXlsxAsync`,
  `GetXlsxBytesAsync`, and the toolbar entry), `OnRangeChanged`,
  `OnGroupExpanded`, and the group, aggregation, total, pivot and range
  methods. The parameters apply on change, and only the ones that changed.
- **Licence and modules.** `AddApexGridEnterprise(o => ...)` or the static
  `ApexGridEnterprise.SetLicense` / `UseModules`; every declarative module
  is selected by default. The first enterprise grid on a page calls
  `use()`, `register()` and `setLicense()`.
- **Deferred.** The server-side and infinite row models (the `getRows`
  callback below), the six companion elements, master/detail, formulas,
  integrated charts and the AI toolkit (its lazily loaded engine is replaced
  in the bundle by a module that says so). Callback options are not
  modelled: the context menu's `items` function and `run`, the cancellable
  opening and `groupExpanding` events, and the export `formatter`.
- **Publishing.** `.github/workflows/publish-nuget-enterprise.yml` runs on a
  `release-enterprise: X.Y.Z` head commit and tags `enterprise-vX.Y.Z`; the
  maintainer configures the NuGet trusted publishing policy for the new
  package ID first. The community workflows now describe only `v*` tags.

The decision record follows, as written before the build.

`apex-grid-enterprise` is not a plugin that augments `<apex-grid>`. It is a
separate custom element, `<apex-grid-enterprise>`, that inherits every community
feature and adds the analytics tier on top. Its `define.js` registers only its
own tag and its six companion elements, never `apex-grid`, so the two can coexist
on a page without a `customElements.define` collision.

### Why a second package rather than one package with a switch

The deciding factor is that this wrapper vendors a pre-built, self-contained ESM
instead of resolving a dependency graph. That is the whole point of it: no npm,
no bundler, no script tag. It also means there is no tree-shaking to fall back
on.

- On npm the split costs nothing, because `apex-grid-enterprise` depends on
  `apex-grid` and the bundler resolves it. A community user never downloads
  enterprise bytes because they are not in the dependency tree.
- Here, one package would have to either carry both bundles, so every community
  user's nupkg contains enterprise bytes they cannot shake out, or carry only
  the enterprise bundle, so free users pay for all of it. Two packages is the
  only shape where a community payload stays community-sized.

The family already ships this way: `Blazor-ApexCharts` plus
`Blazor-ApexCharts-MAUI`.

One argument that was raised and should not be reused: the watermark pattern in
ApexMaps and ApexCharts (licensed features work in full, with a watermark, until
a key is applied) is about how licensing is *enforced*, not how code is
*distributed*. `apex-grid-enterprise` watermarks too, and that is orthogonal to
which package it lives in.

### Shape

- `PackageReference` on `Blazor-ApexGrid` for the shared surface. The models,
  configuration classes, enums and event args under `Blazor_ApexGrid.Models` are
  already `public` and need no change to be reused.
- Its own vendored bundle at `_content/Blazor-ApexGrid-Enterprise/`.
- An `ApexGridEnterprise<TItem>` component, ideally inheriting
  `ApexGrid<TItem>` rather than forking it (see the seam below).
- A licence key surface. This package deliberately has none, because the
  Community tier is keyless; enterprise gates on `LicenseManager` from
  `apex-commons`, so the key has to be settable.

### Prerequisite, needed regardless of this decision

**Met in 1.3.0, first published in 1.4.0.** `apex-grid-enterprise` 0.10.0
depends on `apex-grid ^5.0.0` (as of 2026-11-14), and 1.3.0 vendors
**5.0.0**. 1.3.0 was never published (nuget.org stops at 1.2.1), so 1.4.0
is the first release on the 5.0.0 core and its release notes carry the 1.3.0
changes. Keep the two in step: an enterprise release that needs a newer core
needs this package bumped first. The original note follows.

`apex-grid-enterprise` 0.8.0 depends on `apex-grid ^3.6.0` (as of 2026-10-31;
it was 0.7.0 on `^3.5.0` when this was first written). We vendor **3.3.0**.
The bundled core has to be bumped before any of this is possible, and it is
worth doing on its own merits.

### Seam to add when bumping the core

**Done in 1.1.0, extended in 1.4.0** (see Built, above). The core was bundled at 3.6.0 then (5.0.0 from 1.3.0),
and `ApexGrid<TItem>` has two protected virtual members: `ElementTagName` (the
element it renders and waits for, passed to `init` as `tagName`) and
`ModulePath` (the interop module to import). An enterprise component overrides
both and points `ModulePath` at a bridge that re-exports this one's functions
after importing its own bundle. `SerializeConfig` is still private and `init`
only applies the keys it knows, so passing enterprise config is the first
thing the enterprise package adds. The original note follows.

The element tag is hardcoded in two places:

- the `<apex-grid>` markup in `src/Blazor-ApexGrid/Components/ApexGrid.razor`
- `customElements.whenDefined("apex-grid")` in
  `src/Blazor-ApexGrid/wwwroot/js/blazor-apexgrid.js`

Make it overridable (a protected virtual, or a parameter) so the enterprise
component can inherit and add modules instead of forking 450 lines that then
drift. Cheap to do while the file is already open for the core bump.

### What makes this expensive, and the suggested order

The cost is not in modelling more options. It is in two things the current
wrapper does not do at all:

1. **Callbacks into .NET.** The server-side and infinite row models take a
   `getRows` callback, so JS has to call into .NET and await a result. Today the
   interop is strictly one way: .NET pushes serialized config, JS fires events
   back. This is a new interop pattern.
2. **Six companion custom elements.** The tool panel, set filter, status bar,
   filter builder, chart panel and AI panel are each placed in your own markup
   and bound to a grid through a `grid` property, so each needs to be a real
   Blazor component.

So when this is built, do the **declarative** modules first: grouping,
aggregation, pivot, total row, range selection, context menu and XLSX export.
Those are config-driven and reuse `GridSerializer` as it stands. Defer the two
row models and the six companion elements to a second pass. That gets the
most-asked analytics features out at a fraction of the cost.

(0.1.0 followed this order: the declarative modules are in, and both items
above are still open.)

### Trigger

Demand is unproven: 1.0.0 shipped days before this note. The
`/blazor-data-grid/` page on the website states the enterprise gap plainly in a
"What this package does not cover" section, which makes it the instrument: if
.NET teams arrive and bounce off that section, that is the signal to start.

---

## 2. Defects found while writing the website pillar (2026-09-23)

**Fixed in 1.0.1**, together with a fourth found on 2026-10-31: the csproj still
packed `LICENSE` after the file was renamed to `LICENSE.md` (69af780), so
`dotnet pack` failed with NU5019 and no release was possible. The README's
licence paragraph was rewritten to the current Community License terms at the
same time.

Each was found by reading this repo's source rather than its README, so the
README and csproj are the things that are wrong, not the code.

- **`PackageReleaseNotes` claims "all 27 grid events". The real count is 29.**
  29 `[JSInvokable]` handlers in `ApexGrid.razor`, 29 `EventCallback`
  parameters. Fix the release notes on the next version bump.
- **`PackageTags` lists `webassembly` but not `server`.** This understates the
  package in nuget.org search. Blazor Server works: every interop call goes
  through `IJSRuntime` and `IJSObjectReference`, the module is imported in
  `OnAfterRenderAsync` rather than during prerendering, and there is no
  `IJSInProcessRuntime` path anywhere. Add `server` and `blazor-server`.
- **The README calls `GridExpansionConfiguration` "master-detail".** That name
  collides with the Enterprise "master / detail grids" feature, which is a
  different thing (real nested grids). What this package has is community row
  expansion with an HTML detail panel. Rename it in the README to avoid
  promising the enterprise feature.

## 3. Documented behaviour worth keeping in mind

Not defects, but things that surprised a careful reader. All three are in the
README's "Good to know" section as of 1.0.1:

- **Data changes are detected by identity and count.** `DataHash()` is
  `Data.GetHashCode()` plus `Data.Count()`. Adding or removing rows changes the
  count and reassigning the collection changes the identity, so both redraw.
  Editing a property on a row already in the list changes neither, and that edit
  will not appear until `RefreshAsync()` is called.
- **The grid needs a bounded height.** `Height` defaults to `400px`. A
  percentage whose parent has no height of its own resolves to zero and the grid
  renders as nothing, which looks identical to the render-mode mistake.
- **Cell and header templates are not supported.** The core takes them as JS
  functions, and the interop never turns a string into one, so a template string
  sent through `AdditionalConfig` (`[JsonExtensionData]`) stays a string the grid
  cannot call. There are zero `RenderFragment` parameters in the component
  either, so Razor templates are not an option today.
