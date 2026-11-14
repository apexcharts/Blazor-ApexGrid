import { build } from 'esbuild';
import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { SHARED_KEY, SHARED_MODULES } from './shared.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const version = JSON.parse(readFileSync(resolve(here, 'node_modules/apex-grid/package.json'), 'utf8')).version;
const outFile = resolve(here, '../src/Blazor-ApexGrid/wwwroot/js/apex-grid.bundle.js');
const banner = `/*! apex-grid v${version} (bundled with dependencies via esbuild) | https://apexcharts.com | do not edit */`;

// The registry the enterprise bundle reads (see shared.mjs): the namespace of every shared module,
// from this bundle's own copy, under its specifier. The first bundle to load fills it.
const sharedRegistry = {
  name: 'blazor-apexgrid-shared',
  setup(b) {
    b.onResolve({ filter: /^blazor-apexgrid:shared$/ }, (args) => ({ path: args.path, namespace: 'blazor-apexgrid' }));
    b.onLoad({ filter: /.*/, namespace: 'blazor-apexgrid' }, () => ({
      resolveDir: here,
      contents: [
        ...SHARED_MODULES.map((specifier, i) => `import * as m${i} from ${JSON.stringify(specifier)};`),
        `const key = Symbol.for(${JSON.stringify(SHARED_KEY)});`,
        'if (!globalThis[key]) {',
        '  Object.defineProperty(globalThis, key, {',
        '    value: Object.freeze({',
        `      version: ${JSON.stringify(version)},`,
        `      modules: Object.freeze({ ${SHARED_MODULES.map((s, i) => `${JSON.stringify(s)}: m${i}`).join(', ')} }),`,
        '    }),',
        '  });',
        '}',
      ].join('\n'),
    }));
  },
};

await build({
  entryPoints: [resolve(here, 'entry.mjs')],
  bundle: true,
  format: 'esm',
  minify: true,
  treeShaking: false,
  legalComments: 'none',
  target: ['es2021'],
  outfile: outFile,
  banner: { js: banner },
  plugins: [sharedRegistry],
});

// vendor the grid's stylesheet too
copyFileSync(
  resolve(here, 'node_modules/apex-grid/styles.css'),
  resolve(here, '../src/Blazor-ApexGrid/wwwroot/css/apex-grid.css')
);

// the Ignite UI add-on, a separate opt-in bundle (apex-grid 4.0 and later ship it)
const igniteUIFile = resolve(here, '../src/Blazor-ApexGrid/wwwroot/js/apex-grid.ignite-ui.bundle.js');
if (existsSync(resolve(here, 'node_modules/apex-grid/ignite-ui.js'))) {
  await build({
    entryPoints: [resolve(here, 'entry-ignite-ui.mjs')],
    bundle: true,
    format: 'esm',
    minify: true,
    legalComments: 'none',
    target: ['es2021'],
    outfile: igniteUIFile,
    banner: { js: `/*! apex-grid v${version} Ignite UI add-on (bundled via esbuild) | https://apexcharts.com | do not edit */` },
  });
  console.log(`Bundled apex-grid/ignite-ui v${version} -> ${igniteUIFile}`);
} else {
  console.log(`apex-grid v${version} has no ignite-ui entry; skipped the Ignite UI add-on bundle`);
}

const out = readFileSync(outFile, 'utf8');
console.log(`Bundled apex-grid v${version} -> ${outFile} (${out.length} bytes)`);
if (!out.includes(SHARED_KEY)) throw new Error(`the core bundle does not publish the ${SHARED_KEY} registry`);
console.log(`Shared with Blazor-ApexGrid-Enterprise: ${SHARED_MODULES.join(', ')}`);

// both bundles are loaded as-is by the browser, so neither may keep a bare framework import
const bare = /(?:^|[^.\w])(?:import|from)\s*["'](?:lit|igniteui|@lit)/m;
const withBare = [outFile, igniteUIFile].filter((file) => existsSync(file) && bare.test(readFileSync(file, 'utf8')));
console.log(
  withBare.length
    ? `WARNING: possible unresolved bare imports remain in ${withBare.join(', ')}`
    : 'OK: no bare framework imports remain'
);
