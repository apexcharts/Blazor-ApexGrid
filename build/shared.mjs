// The modules the community bundle (apex-grid.bundle.js) shares with the enterprise bundle
// (apex-grid-enterprise.bundle.js), so a page holds exactly one apex-grid core and one Lit.
//
// apex-grid-enterprise imports 'apex-grid', 'apex-grid/internal' and Lit. Bundled on its own it
// would carry a second core, and a page with both packages would then hold two ApexGrid classes:
// the second core's registerComponent() skips every tag the first already defined, so nothing
// throws, but the enterprise grid would extend a class other than the registered <apex-grid>, its
// rows would be the first core's elements, each copy would keep its own module state (the host
// sizing setup() turns on, for one), and an `instanceof ApexGrid` check made by one copy would
// fail for a grid from the other.
//
// So the community bundle publishes these modules' namespaces once, on a registry keyed by
// Symbol.for(SHARED_KEY), and the enterprise bundle reads every import of them from there instead
// of bundling them. The enterprise interop module imports the community interop module (which
// imports the core) before the enterprise bundle, so the registry is always filled first, in
// whichever order the two packages' components render.
//
// The enterprise bundle never names the core bundle's URL, so a Blazor-ApexGrid update that moves
// the core bundle's ?ver= cache buster cannot make it load a second copy of the core.

/** Symbol.for() key of the registry the community bundle fills. */
export const SHARED_KEY = 'blazor-apexgrid.shared';

/**
 * Specifiers the registry holds. Add one here (and rebuild both bundles) when an enterprise
 * release imports another Lit or apex-grid entry point: npm run bundle:enterprise fails and names
 * it until then.
 */
export const SHARED_MODULES = [
  'apex-grid',
  'apex-grid/internal',
  'lit',
  'lit/decorators.js',
  'lit/directives/live.js',
];

/** Specifiers that must come from the registry, never from a bundled copy. */
export const isSharedFamily = (specifier) => /^(?:apex-grid(?:\/|$)|lit(?:\/|$)|@lit\/|@lit-labs\/)/.test(specifier);
