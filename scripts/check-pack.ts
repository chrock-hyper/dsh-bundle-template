/**
 * Packaged-file check.
 *
 * A local directory install links the checkout, so it hides every `files`
 * mistake: everything is present because nothing was packed. This script runs
 * `npm pack --dry-run` and asserts that the installed bundle — not the working
 * tree — carries each file the loader and the display metadata need.
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
  name: string
  version: string
  dsh?: { client?: { platform?: string } }
}

const REQUIRED = [
  'package.json',
  'cordis.patch.yml',
  'icon.svg',
  'docs/DETAIL.md',
  'locale/en.json',
  'locale/zh.json',
  'lib/index.js',
  'lib/index.d.ts',
]

// A project-local npm cache keeps the check independent of a machine-wide
// `~/.npm` (which is often owned by another user or root).
const cacheDir = join(root, '.tmp', 'npm-cache')
mkdirSync(cacheDir, { recursive: true })

const output = execFileSync(
  'npm',
  ['pack', '--dry-run', '--json', '--ignore-scripts', '--cache', cacheDir],
  { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] },
)
const results = JSON.parse(output) as Array<{ files: Array<{ path: string }> }>
const result = results[0]
if (!result) {
  console.error('npm pack returned no result; cannot verify the tarball contents.')
  process.exit(1)
}
const packed = new Set(result.files.map((file) => file.path))

const client = manifest.dsh?.client
if (client) {
  REQUIRED.push('lib/client.js', 'lib/client.d.ts')
}

const missing = REQUIRED.filter((path) => !packed.has(path))
const forbidden = [...packed].filter(
  (path) => path.startsWith('src/') || path.startsWith('build/') || path.startsWith('scripts/'),
)

if (missing.length > 0) {
  console.error(`Missing from the packed tarball:\n${missing.map((p) => `  - ${p}`).join('\n')}`)
  console.error('Add them to "files" in package.json; a linked directory install never reveals this.')
  process.exit(1)
}

if (forbidden.length > 0) {
  console.error(`Sources leaked into the tarball:\n${forbidden.map((p) => `  - ${p}`).join('\n')}`)
  process.exit(1)
}

console.log(`  ok  ${manifest.name}@${manifest.version} packs ${packed.size} files, all required entries present`)
