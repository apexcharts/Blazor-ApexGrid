# Roadmap and open items

Decisions and known defects for `Blazor-ApexGrid`, recorded so they survive the
conversations that produced them. Nothing here is packed into the nupkg (only
`README.md` and `LICENSE.md` are).

Last reviewed: 2026-10-31.

---

## 1. Enterprise support ships as a second package

**Decision: `Blazor-ApexGrid-Enterprise`, a companion package. Not an `Edition`
parameter on this one.**

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

`apex-grid-enterprise` 0.8.0 depends on `apex-grid ^3.6.0` (as of 2026-10-31;
it was 0.7.0 on `^3.5.0` when this was first written). We vendor **3.3.0**.
The bundled core has to be bumped before any of this is possible, and it is
worth doing on its own merits.

### Seam to add when bumping the core

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
- **Cell and header templates are JS function strings**, passed through
  `AdditionalConfig` (`[JsonExtensionData]`), not Razor render fragments. There
  are zero `RenderFragment` parameters in the component, so a template cannot
  contain Blazor components.
