/**
 * Build every plugin package in the monorepo.
 *
 * Package layout:
 *   packages/<name>/src/index.ts   Host entry (required for a plugin row)
 *   packages/<name>/src/client.tsx Client entry (only with dsh.client)
 *   packages/<name>/lib/           Build output, gitignored
 *
 * The bundle package has no Host or Client code: it only contributes a patch,
 * so it is skipped here.
 */
import { existsSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { build } from 'tsdown'

import { clientConfig, hostConfig } from '../build/config.ts'

interface Manifest {
  name: string
  dsh?: {
    bundle?: { patch?: string | string[] }
    client?: { platform?: string }
  }
}

const root = fileURLToPath(new URL('..', import.meta.url))
const packagesDir = join(root, 'packages')
let built = 0

for (const entry of readdirSync(packagesDir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
  if (!entry.isDirectory()) continue
  const dir = join(packagesDir, entry.name)
  const manifestPath = join(dir, 'package.json')
  if (!existsSync(manifestPath)) continue

  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Manifest
  // A bundle package is pure composition: patch, locale, docs, icon.
  if (manifest.dsh?.bundle?.patch !== undefined) continue

  const hasHost = existsSync(join(dir, 'src/index.ts'))
  const hasClient = manifest.dsh?.client !== undefined
  if (!hasHost && !hasClient) continue
  if (hasClient && !existsSync(join(dir, 'src/client.tsx'))) {
    throw new Error(`${manifest.name}: dsh.client is declared but src/client.tsx is missing`)
  }

  rmSync(join(dir, 'lib'), { recursive: true, force: true })
  const pkg = { dir, name: manifest.name }

  if (hasHost) {
    console.log(`build ${manifest.name}: host`)
    await build(hostConfig(pkg))
  }
  if (hasClient) {
    console.log(`build ${manifest.name}: client`)
    await build(clientConfig(pkg))
  }
  built += 1
}

console.log(`built ${built} plugin package(s).`)
