/**
 * Client build: one CJS chunk wrapped in the page module table's registration
 * call.
 *
 * The DSH page never imports a client bundle. It fetches the file as a script
 * and expects it to call `window.__ModuleLoader__.load({ id, factory })`, where
 * `factory(require)` runs lazily and returns the plugin object. CJS is the
 * format that maps onto that shape with no shimming: top-level `require(...)`
 * calls become lookups in the page's module table.
 *
 * Keep `require` targets to the baseline the page already seeds — in practice
 * `react` and `react/jsx-runtime`. A `@deepseek-ai/*` request from here cannot
 * be satisfied for an out-of-tree plugin, and the bundle fails at load.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { defineConfig } from 'tsdown'

const manifest = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
) as { name: string }

/** Running with `--config build/…` makes tsdown treat `build/` as cwd; pin the root. */
const root = fileURLToPath(new URL('..', import.meta.url))

/** Opens the loader call; the wrapper's own `module`/`exports` shims follow. */
const openLoader = [
  '/* Bundled by tsdown, then wrapped for the DSH client module table. */',
  `window.__ModuleLoader__.load({ id: ${JSON.stringify(manifest.name)}, factory(require) {`,
  'var module = { exports: {} };',
  'var exports = module.exports;',
].join('\n')

/** Hands the module namespace back to the loader and closes the call. */
const closeLoader = ['return module.exports;', '} });', ''].join('\n')

export default defineConfig({
  cwd: root,
  entry: { client: 'src/client.tsx' },
  format: ['cjs'],
  // CJS always targets Node.js unless told otherwise; this bundle is browser-only.
  platform: 'neutral',
  inputOptions: { platform: 'browser' },
  target: 'es2022',
  outDir: 'lib',
  clean: false,
  sourcemap: true,
  dts: true,
  // Keep `lib/client.js`. This file is served to the page and run as a script;
  // Node never imports it, so the `.cjs` safety extension buys nothing here.
  outExtensions: () => ({ js: '.js', dts: '.d.ts' }),
  banner: `${openLoader}\n`,
  footer: `\n${closeLoader}`,
  deps: {
    neverBundle: ['react', 'react-dom', 'react/jsx-runtime'],
  },
})
