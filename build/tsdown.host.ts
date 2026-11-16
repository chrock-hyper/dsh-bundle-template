/**
 * Host build: one ESM entry, Node platform, declarations beside the output.
 *
 * `@deepseek-ai/*` stays external on purpose. Those packages are resolved from
 * the running DSH installation, so bundling a copy would hand the host a second
 * Cordis instance and a second Schemastery — shared identity is the point of
 * declaring them under both `peerDependencies` and `devDependencies`.
 */
import { fileURLToPath } from 'node:url'

import { defineConfig } from 'tsdown'

/** Running with `--config build/…` makes tsdown treat `build/` as cwd; pin the root. */
const root = fileURLToPath(new URL('..', import.meta.url))

export default defineConfig({
  cwd: root,
  entry: { index: 'src/index.ts' },
  format: ['esm'],
  platform: 'node',
  outDir: 'lib',
  // The client build writes into the same directory; only `npm run clean` wipes it.
  clean: false,
  sourcemap: true,
  dts: true,
  // Keep `lib/index.js` / `lib/index.d.ts`; DSH resolves plain .js entries.
  fixedExtension: false,
  deps: {
    neverBundle: [/^@deepseek-ai\//],
  },
})
