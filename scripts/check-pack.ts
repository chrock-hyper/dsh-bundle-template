/**
 * Packaged-file check.
 *
 * A local directory install links the checkout, so it hides every `files`
 * mistake: everything is present because nothing was packed. This script runs
 * `npm pack --dry-run` for every package and asserts that the installed
 * tarball — not the working tree — carries each file the loader and the
 * display metadata need.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

interface Manifest {
  name: string
  version: string
  dsh?: {
    bundle?: { patch?: string | string[] }
    client?: { platform?: string }
  }
}

const root = fileURLToPath(new URL('..', import.meta.url))
const packagesDir = join(root, 'packages')
// A project-local npm cache and log directory keep the check independent of a
// machine-wide `~/.npm` (which is often owned by another user or root).
const cacheDir = join(root, '.tmp', 'npm-cache')
const logsDir = join(root, '.tmp', 'npm-logs')
mkdirSync(cacheDir, { recursive: true })
mkdirSync(logsDir, { recursive: true })

const failures: string[] = []

function packedFiles(dir: string): Set<string> {
  const output = execFileSync(
    'npm',
    ['pack', '--dry-run', '--json', '--ignore-scripts', '--cache', cacheDir, '--logs-dir', logsDir],
    { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] },
  )
  const results = JSON.parse(output) as Array<{ files: Array<{ path: string }> }>
  const result = results[0]
  if (!result) throw new Error('npm pack returned no result')
  return new Set(result.files.map(file => file.path))
}

function requireFile(name: string, packed: Set<string>, path: string): void {
  if (!packed.has(path)) failures.push(`${name}: missing ${path}`)
}

function forbidPrefix(name: string, packed: Set<string>, prefix: string): void {
  for (const path of packed) {
    if (path.startsWith(prefix)) failures.push(`${name}: ${path} leaked into the tarball`)
  }
}

for (const entry of readdirSync(packagesDir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
  if (!entry.isDirectory()) continue
  const dir = join(packagesDir, entry.name)
  const manifestPath = join(dir, 'package.json')
  if (!existsSync(manifestPath)) continue

  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Manifest
  const packed = packedFiles(dir)
  const isBundle = manifest.dsh?.bundle?.patch !== undefined
  const hasHost = existsSync(join(dir, 'src/index.ts'))
  const hasClient = manifest.dsh?.client !== undefined

  requireFile(manifest.name, packed, 'package.json')

  if (isBundle) {
    const patches = manifest.dsh?.bundle?.patch
    for (const patch of Array.isArray(patches) ? patches : patches === undefined ? [] : [patches]) {
      requireFile(manifest.name, packed, patch.replace(/^\.\//, ''))
    }
    requireFile(manifest.name, packed, 'locale/en.json')
    requireFile(manifest.name, packed, 'locale/zh.json')
    requireFile(manifest.name, packed, 'icon.svg')
    requireFile(manifest.name, packed, 'docs/DETAIL.md')
  } else {
    if (hasHost) {
      requireFile(manifest.name, packed, 'lib/index.js')
      requireFile(manifest.name, packed, 'lib/index.d.ts')
    }
    if (hasClient) {
      requireFile(manifest.name, packed, 'lib/client.js')
      requireFile(manifest.name, packed, 'lib/client.d.ts')
    }
    if (existsSync(join(dir, 'locale'))) {
      requireFile(manifest.name, packed, 'locale/en.json')
      requireFile(manifest.name, packed, 'locale/zh.json')
    }
    if (existsSync(join(dir, 'icon.svg'))) requireFile(manifest.name, packed, 'icon.svg')
  }

  if (existsSync(join(dir, 'README.md'))) requireFile(manifest.name, packed, 'README.md')
  forbidPrefix(manifest.name, packed, 'src/')
  forbidPrefix(manifest.name, packed, 'build/')
  forbidPrefix(manifest.name, packed, 'scripts/')

  console.log(`  ok  ${manifest.name}@${manifest.version} packs ${packed.size} files`)
}

if (failures.length > 0) {
  console.error(`\n${failures.length} pack check(s) failed:\n${failures.map(failure => `  - ${failure}`).join('\n')}`)
  console.error('Fix the package "files" list; a linked directory install never reveals this.')
  process.exit(1)
}

console.log(`\nAll ${readdirSync(packagesDir, { withFileTypes: true }).filter(entry => entry.isDirectory()).length} package(s) pack the required files.`)
