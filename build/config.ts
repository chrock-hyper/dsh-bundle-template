import { defineConfig } from 'tsdown'

/** One plugin package the build script can emit. */
export interface PackageBuild {
  /** Absolute package directory; tsdown resolves `src/` relative to it. */
  dir: string
  /** Package name; the Client wrapper registers this as the module-table id. */
  name: string
}

/**
 * Host half: one ESM entry, Node platform, declarations beside the output.
 *
 * `@deepseek-ai/*` stays external. The profile resolver routes a linked
 * importer's bare request to the installation copy when that package declares
 * the request in `peerDependencies`; bundling a copy would defeat that and
 * hand the Host a second Cordis or Schemastery instance.
 */
export function hostConfig(pkg: PackageBuild) {
  return defineConfig({
    cwd: pkg.dir,
    entry: { index: 'src/index.ts' },
    format: ['esm'],
    platform: 'node',
    outDir: 'lib',
    // The Client build writes into the same directory; only `clean` decides.
    clean: false,
    sourcemap: true,
    dts: true,
    // Keep `lib/index.js` / `lib/index.d.ts`; DSH resolves plain .js entries.
    fixedExtension: false,
    deps: {
      neverBundle: [/^@deepseek-ai\//],
    },
  })
}

/**
 * Client half: one CJS chunk wrapped in the page module table's registration
 * call.
 *
 * The page never imports a client bundle. It fetches the file as a script and
 * expects `window.__ModuleLoader__.load({ id, factory })`, where `factory`
 * runs lazily and returns the plugin object. CJS maps onto that shape with no
 * shimming. `require` targets stay on the page's baseline: `react` and
 * `react/jsx-runtime`.
 */
export function clientConfig(pkg: PackageBuild) {
  const openLoader = [
    '/* Bundled by tsdown, then wrapped for the DSH client module table. */',
    `window.__ModuleLoader__.load({ id: ${JSON.stringify(pkg.name)}, factory(require) {`,
    'var module = { exports: {} };',
    'var exports = module.exports;',
  ].join('\n')

  const closeLoader = ['return module.exports;', '} });', ''].join('\n')

  return defineConfig({
    cwd: pkg.dir,
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
    // Keep `lib/client.js`. This file is served to the page and run as a
    // script; Node never imports it, so the `.cjs` safety extension buys
    // nothing here.
    outExtensions: () => ({ js: '.js', dts: '.d.ts' }),
    banner: `${openLoader}\n`,
    footer: `\n${closeLoader}`,
    deps: {
      neverBundle: ['react', 'react-dom', 'react/jsx-runtime'],
    },
  })
}
