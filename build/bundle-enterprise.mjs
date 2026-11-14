// Bundles apex-grid-enterprise for Blazor-ApexGrid-Enterprise without a second apex-grid core.
//
// Every import of apex-grid, apex-grid/internal and Lit is answered from the registry that
// Blazor-ApexGrid's core bundle publishes (see shared.mjs), so the output holds only the enterprise
// code and apex-commons. Run `npm run bundle` first when the core changes: both bundles must be
// built from the same node_modules, which is what keeps the shared export lists in step.
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, sep } from 'node:path';
import { SHARED_KEY, SHARED_MODULES, isSharedFamily } from './shared.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const readPackage = (name) => JSON.parse(readFileSync(resolve(here, 'node_modules', name, 'package.json'), 'utf8'));
const enterprise = readPackage('apex-grid-enterprise');
const core = readPackage('apex-grid');
const outFile = resolve(here, '../src/Blazor-ApexGrid-Enterprise/wwwroot/js/apex-grid-enterprise.bundle.js');

// apex-grid-enterprise states the core it supports as a caret range. The core bundle is built from
// the same node_modules, so check it here, and again in the browser against the core that
// Blazor-ApexGrid actually loaded (a newer Blazor-ApexGrid may bundle a newer core).
const range = enterprise.dependencies?.['apex-grid'] ?? '';
const caret = /^\^(\d+)\.(\d+)\.(\d+)$/.exec(range);
if (!caret || caret[1] === '0') throw new Error(`unsupported apex-grid range in apex-grid-enterprise: "${range}"`);
const min = caret.slice(1).map(Number);
const satisfies = (version) => {
  const [major, minor, patch] = version.split(/[.+-]/).map(Number);
  return major === min[0] && (minor > min[1] || (minor === min[1] && patch >= min[2]));
};
if (!satisfies(core.version))
  throw new Error(`apex-grid-enterprise ${enterprise.version} needs apex-grid ${range}; node_modules has ${core.version}`);

// The export names of a shared module, as esbuild resolves them from node_modules.
async function exportNames(specifier) {
  const result = await build({
    stdin: { contents: `export * from ${JSON.stringify(specifier)};`, resolveDir: here, loader: 'js' },
    bundle: true,
    format: 'esm',
    write: false,
    metafile: true,
    logLevel: 'silent',
  });
  return Object.values(result.metafile.outputs)[0].exports;
}

const sharedExports = Object.fromEntries(
  await Promise.all(SHARED_MODULES.map(async (specifier) => [specifier, await exportNames(specifier)]))
);

// Runs first in the bundle: finds the registry, and refuses a core outside the supported range
// rather than extend a class it was not built for.
const hostModule = `
const registry = globalThis[Symbol.for(${JSON.stringify(SHARED_KEY)})];
if (!registry) {
  throw new Error(
    "Blazor-ApexGrid-Enterprise: the apex-grid core from Blazor-ApexGrid has not loaded. Load this " +
      "bundle through _content/Blazor-ApexGrid-Enterprise/js/blazor-apexgrid-enterprise.js, which " +
      "imports Blazor-ApexGrid's module first."
  );
}
const [major, minor, patch] = String(registry.version).split(/[.+-]/).map(Number);
if (major !== ${min[0]} || minor < ${min[1]} || (minor === ${min[1]} && patch < ${min[2]})) {
  throw new Error(
    "Blazor-ApexGrid-Enterprise: apex-grid-enterprise ${enterprise.version} needs apex-grid ${range}, " +
      "but Blazor-ApexGrid loaded apex-grid " + registry.version + ". Use the Blazor-ApexGrid " +
      "version this package depends on."
  );
}
export function shared(specifier) {
  const namespace = registry.modules[specifier];
  if (!namespace) {
    throw new Error(
      "Blazor-ApexGrid-Enterprise: Blazor-ApexGrid does not share " + specifier + ". Update Blazor-ApexGrid."
    );
  }
  return namespace;
}
`;

// apexcharts is an optional peer that apex-grid-enterprise loads with import('apexcharts') only to
// draw an integrated chart. Those are offered only with the <apex-grid-chart> companion element,
// which this package does not register, so the path is not reachable today. Should it be, draw
// with the page's ApexCharts global, as chart columns do, instead of a bare import the browser
// cannot resolve.
const pageApexCharts = `
export default function ApexChartsFromPage(element, options) {
  const ApexCharts = globalThis.ApexCharts;
  if (typeof ApexCharts !== "function") {
    throw new Error(
      "Blazor-ApexGrid-Enterprise: drawing a chart needs ApexCharts on the page as window.ApexCharts " +
        "(a script tag). It is not bundled."
    );
  }
  return new ApexCharts(element, options);
}
`;

// The AI toolkit is not part of this package: apex-grid-enterprise loads its engine with dynamic
// imports only when runPrompt() runs, which no .NET API calls, so those imports (about 50 KB) and
// the optional Claude SDK peer are answered with a module that says so instead.
const noAI = `
throw new Error("Blazor-ApexGrid-Enterprise: the AI toolkit is not part of this package.");
`;

const fromRegistry = {
  name: 'blazor-apexgrid-enterprise-shared',
  setup(b) {
    b.onResolve({ filter: /^\.\/features\/ai\// }, (args) =>
      args.kind === 'dynamic-import' ? { path: args.path, namespace: 'stub' } : undefined
    );
    b.onResolve({ filter: /^[^./]/ }, (args) => {
      if (args.path === 'blazor-apexgrid:host') return { path: args.path, namespace: 'host' };
      if (args.path === 'apexcharts') return { path: args.path, namespace: 'stub' };
      if (args.path === '@anthropic-ai/sdk') return { path: args.path, namespace: 'stub' };
      if (!isSharedFamily(args.path)) return undefined; // apex-grid-enterprise, apex-commons
      if (!SHARED_MODULES.includes(args.path))
        return {
          errors: [
            {
              text:
                `${args.path} is not in the registry Blazor-ApexGrid shares (build/shared.mjs). ` +
                'Add it there and rebuild both bundles.',
            },
          ],
        };
      return { path: args.path, namespace: 'shared' };
    });
    b.onLoad({ filter: /.*/, namespace: 'host' }, () => ({ contents: hostModule, loader: 'js' }));
    b.onLoad({ filter: /.*/, namespace: 'stub' }, (args) => ({
      contents: args.path === 'apexcharts' ? pageApexCharts : noAI,
      loader: 'js',
    }));
    b.onLoad({ filter: /.*/, namespace: 'shared' }, (args) => ({
      loader: 'js',
      contents: [
        'import { shared } from "blazor-apexgrid:host";',
        `const m = shared(${JSON.stringify(args.path)});`,
        ...sharedExports[args.path].map((name) => `export const ${name} = m.${name};`),
      ].join('\n'),
    }));
  },
};

const banner =
  `/*! apex-grid-enterprise v${enterprise.version} (bundled via esbuild; apex-grid, lit and @lit are ` +
  'not included: they come from the Blazor-ApexGrid bundle) | https://apexcharts.com | ' +
  'commercial license, see LICENSE.md | do not edit */';

const result = await build({
  entryPoints: [resolve(here, 'entry-enterprise.mjs')],
  bundle: true,
  format: 'esm',
  minify: true,
  legalComments: 'none',
  target: ['es2021'],
  outfile: outFile,
  metafile: true,
  banner: { js: banner },
  plugins: [fromRegistry],
});

const out = readFileSync(outFile, 'utf8');
console.log(`Bundled apex-grid-enterprise v${enterprise.version} (apex-grid ${range}) -> ${outFile} (${out.length} bytes)`);

// The core and Lit must come from the registry only: no file of theirs may be in the bundle.
const inputs = Object.keys(result.metafile.inputs);
const inlined = inputs.filter((input) =>
  /(?:^|[/\\])node_modules[/\\](?:apex-grid|lit|lit-html|lit-element|@lit|@lit-labs)[/\\]/.test(input.split(sep).join('/'))
);
if (inlined.length) {
  console.log(`ERROR: the enterprise bundle inlines a second copy of shared code: ${inlined.slice(0, 5).join(', ')}`);
  process.exit(1);
}
console.log(`OK: no apex-grid core or Lit inlined (${SHARED_MODULES.join(', ')} read from the Blazor-ApexGrid bundle)`);

// The browser loads the bundle as-is, so it may keep no bare import, static or dynamic.
const externals = Object.values(result.metafile.outputs).flatMap((o) => o.imports).filter((i) => i.external);
// (esbuild's list is authoritative; the patterns are a second look at the written file)
const bare = [
  /(?:^|[;}\n])\s*(?:import|export)\b[^;"'`]*?\bfrom\s*["'](?![./])[^"']+["']/m, // import x from "y"
  /(?:^|[;}\n])\s*import\s*["'](?![./])[^"']+["']/m, // import "y"
  /(?:^|[^.\w$])import\s*\(\s*["'](?![./])[^"']+["']\s*\)/m, // import("y")
];
if (externals.length || bare.some((pattern) => pattern.test(out))) {
  console.log(`ERROR: unresolved imports remain: ${JSON.stringify(externals.map((i) => i.path))}`);
  process.exit(1);
}
console.log('OK: no bare imports remain');
