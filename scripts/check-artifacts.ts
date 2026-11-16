/**
 * Contract check for the built artifacts.
 *
 * Installation success proves almost nothing: DSH loads plugin rows lazily and
 * reports a broken half only when the row activates. This script executes both
 * halves the way their real hosts do, so a broken bundle fails here instead of
 * in a user's profile.
 *
 *   Host   — imported as ESM and inspected for the plugin exports.
 *   Client — evaluated against a fake `window.__ModuleLoader__`, then its
 *            factory and `apply` are run against a fake slot context.
 */
import { existsSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import vm from 'node:vm'

const root = fileURLToPath(new URL('..', import.meta.url))
const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
  name: string
  exports: Record<string, unknown>
  dsh?: { bundle?: { patch?: string } }
}

const failures: string[] = []
const passes: string[] = []

function check(label: string, run: () => void | Promise<void>) {
  return Promise.resolve()
    .then(run)
    .then(() => {
      passes.push(label)
    })
    .catch((error: unknown) => {
      failures.push(`${label}\n    ${error instanceof Error ? error.message : String(error)}`)
    })
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function assertFile(relative: string) {
  const path = join(root, relative)
  assert(existsSync(path), `missing file: ${relative}`)
  assert(statSync(path).size > 0, `empty file: ${relative}`)
  return path
}

/** Every `exports` target must exist, or the loader resolves nothing. */
async function checkExportTargets() {
  const targets: string[] = []
  const collect = (value: unknown) => {
    if (typeof value === 'string') targets.push(value)
    else if (value && typeof value === 'object') Object.values(value).forEach(collect)
  }
  collect(manifest.exports)
  assert(targets.length > 0, 'package.json exports declares no targets')

  for (const target of targets) {
    if (!target.startsWith('./')) continue
    if (target.includes('*')) continue
    assertFile(target.slice(2))
  }
}

/** The Host half: ESM plugin exports that DSH can mount as a row. */
async function checkHostHalf() {
  const entry = assertFile('lib/index.js')
  const module = (await import(pathToFileURL(entry).href)) as Record<string, unknown>

  assert(typeof module.apply === 'function', 'host half exports no apply() function')
  assert(
    Array.isArray(module.inject) && module.inject.every((item) => typeof item === 'string'),
    'host half exports no inject string array',
  )
  const schema = module.Config as { '~standard'?: unknown } | undefined
  assert(schema, 'host half exports no Config schema')
  assert(schema?.['~standard'] !== null && schema?.['~standard'] !== undefined,
    'Config must be a Schemastery schema implementing Standard Schema, not a plain object')

  const source = readFileSync(entry, 'utf8')
  const badImport = /from\s+["'](?!node:|@deepseek-ai\/)[^"']+["']/.exec(source)
  assert(!badImport, `host half imports a package that DSH does not resolve: ${badImport?.[0]}`)
}

/** The Client half: a script that registers one lazy factory under the package name. */
function checkClientHalf() {
  const entry = assertFile('lib/client.js')
  const source = readFileSync(entry, 'utf8')

  assert(
    source.includes('window.__ModuleLoader__.load('),
    'client half never calls window.__ModuleLoader__.load(...)',
  )

  const forbidden = /require\(\s*["']@deepseek-ai\//.exec(source)
  assert(
    !forbidden,
    'client half requires a @deepseek-ai/* package at runtime; the page module table cannot answer it (bundle it or use `import type`)',
  )

  type Factory = (requireModule: (request: string) => unknown) => unknown
  const registrations: Array<{ id: string; factory: Factory }> = []
  const context = vm.createContext({
    window: {
      __ModuleLoader__: {
        load(options: { id: string; factory: Factory }) {
          registrations.push(options)
        },
      },
    },
  })
  vm.runInContext(source, context, { filename: 'lib/client.js' })

  assert(registrations.length === 1, `client half registered ${registrations.length} factories, expected 1`)
  const registration = registrations[0]!
  assert(
    registration.id === manifest.name,
    `client half registers id "${registration.id}" but the package is "${manifest.name}"`,
  )

  const react = {
    useState: <T,>(initial: T) => [initial, () => {}] as [T, () => void],
    useEffect: (callback: () => void) => callback(),
    createElement: (type: unknown, props: unknown) => ({ type, props }),
    Fragment: Symbol('Fragment'),
  }
  const jsxRuntime = {
    jsx: (type: unknown, props: unknown) => ({ type, props }),
    jsxs: (type: unknown, props: unknown) => ({ type, props }),
  }
  const stubs: Record<string, unknown> = { react, 'react/jsx-runtime': jsxRuntime, 'react/jsx-dev-runtime': jsxRuntime }
  const requireStub = (request: string) => {
    const value = stubs[request]
    assert(value, `client half required "${request}", which the page module table does not seed`)
    return value
  }

  const plugin = registration.factory(requireStub) as { inject?: unknown; apply?: unknown }
  assert(typeof plugin.apply === 'function', 'client factory did not return a plugin with apply()')
  assert(Array.isArray(plugin.inject), 'client plugin does not declare its client service injections')

  const injections: string[] = []
  const registered: Array<{ options: { name: string; id: string }; component: unknown }> = []
  const ctx = {
    slots: {
      inject(name: string, callback: () => void) {
        injections.push(name)
        callback()
      },
      register(options: { name: string; id: string }, component: unknown) {
        registered.push({ options, component })
        return () => {}
      },
    },
    effect(callback: () => () => void) {
      callback()
    },
  }

  ;(plugin.apply as (context: unknown) => void)(ctx)

  assert(injections.length > 0, 'client apply() never injects a slot')
  assert(registered.length > 0, 'client apply() never registers a component')
  const first = registered[0]!
  assert(
    typeof first.options.name === 'string' && typeof first.options.id === 'string',
    'registered slot entry is missing a name or id',
  )
  assert(typeof first.component === 'function', 'registered component is not a function')

  const rendered = (first.component as (props: Record<string, unknown>) => unknown)({})
  assert(rendered !== undefined, 'registered component rendered nothing')
}

/** Display metadata: the plugin row in Plugin Manager shows these. */
async function checkBundleMetadata() {
  const patchPath = manifest.dsh?.bundle?.patch
  assert(patchPath, 'package.json declares no dsh.bundle.patch')
  const patch = readFileSync(assertFile(patchPath!.replace(/^\.\//, '')), 'utf8')
  assert(
    patch.includes(`name: ${manifest.name}`),
    `cordis.patch.yml never references "${manifest.name}", so the bundle inserts nothing`,
  )

  for (const locale of ['locale/en.json', 'locale/zh.json']) {
    const parsed = JSON.parse(readFileSync(assertFile(locale), 'utf8')) as {
      meta?: { title?: string; description?: string }
    }
    assert(parsed.meta?.title, `${locale} has no meta.title`)
    assert(parsed.meta?.description, `${locale} has no meta.description`)
  }

  const iconPath = assertFile('icon.svg')
  const icon = readFileSync(iconPath, 'utf8')
  assert(icon.trimStart().startsWith('<svg'), 'icon.svg does not start with an <svg> element')
  assert(statSync(iconPath).size <= 256 * 1024, 'icon.svg exceeds the 256 KiB limit')
}

await check('exports targets resolve', checkExportTargets)
await check('host half mounts as a DSH plugin row', checkHostHalf)
await check('client half honours the module-table contract', checkClientHalf)
await check('bundle display metadata is complete', checkBundleMetadata)

for (const label of passes) console.log(`  ok  ${label}`)
for (const failure of failures) console.error(`  FAIL  ${failure}`)

if (failures.length > 0) {
  console.error(`\n${failures.length} contract check(s) failed.`)
  process.exit(1)
}

console.log(`\nAll ${passes.length} contract checks passed for ${manifest.name}.`)
