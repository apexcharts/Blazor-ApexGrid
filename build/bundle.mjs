import { build } from 'esbuild';
import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const version = JSON.parse(readFileSync(resolve(here, 'node_modules/apex-grid/package.json'), 'utf8')).version;
const outFile = resolve(here, '../src/Blazor-ApexGrid/wwwroot/js/apex-grid.bundle.js');
const banner = `/*! apex-grid v${version} (bundled with dependencies via esbuild) | https://apexcharts.com | do not edit */`;

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

// both bundles are loaded as-is by the browser, so neither may keep a bare framework import
const bare = /(?:^|[^.\w])(?:import|from)\s*["'](?:lit|igniteui|@lit)/m;
const withBare = [outFile, igniteUIFile].filter((file) => existsSync(file) && bare.test(readFileSync(file, 'utf8')));
console.log(
  withBare.length
    ? `WARNING: possible unresolved bare imports remain in ${withBare.join(', ')}`
    : 'OK: no bare framework imports remain'
);
