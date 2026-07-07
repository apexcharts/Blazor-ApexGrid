import { build } from 'esbuild';
import { readFileSync, writeFileSync, copyFileSync } from 'node:fs';
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

const out = readFileSync(outFile, 'utf8');
const bareLeft = /(?:^|[^.\w])(?:import|from)\s*["'](?:lit|igniteui|@lit)/m.test(out);
console.log(`Bundled apex-grid v${version} -> ${outFile} (${out.length} bytes)`);
console.log(bareLeft ? 'WARNING: possible unresolved bare imports remain' : 'OK: no bare framework imports remain');
