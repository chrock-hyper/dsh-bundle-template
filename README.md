# dsh-bundle-template

English | [中文](README.zh.md)

TypeScript + [tsdown](https://tsdown.dev) starter for a [DeepSeek Harness](https://github.com/deepseek-ai) bundle. It ships a working **Host** half and a working **Client** half, both built to the exact artifact shapes DSH loads, plus a contract check that fails before a broken bundle reaches a profile.

## Why this exists

DSH's own client bundles are produced by a tsdown preset at `packages/client/tsdown.client.ts`, and that preset is **not published in any package** — the docs say so directly: a package outside the DSH repository has to reproduce that build itself. The Client half must be a script that calls `window.__ModuleLoader__.load({ id, factory })`, while the Host half is ordinary ESM. Getting both out of one TypeScript project, with `package.json` exports that match, is the whole job of this template.

## Requirements

- Node.js ≥ 24.9
- pnpm (npm works too)
- DSH `>=0.2.0 <0.3.0` (declared in `engines.dsh`)

## Quick start

```sh
pnpm install
pnpm check      # typecheck → build → contract checks → packed-file check
```

## Layout

```
src/index.ts          Host half: apply(ctx, config), exports named `name`/`inject`/`Config`
src/client.tsx        Client half: named `inject`/`apply`, returns a plugin object
src/contract.ts       Local types for the browser contract (no runtime imports)
build/tsdown.host.ts  ESM build → lib/index.js + lib/index.d.ts
build/tsdown.client.ts CJS build + loader wrapper → lib/client.js
cordis.patch.yml      The bundle layer: one inserted row with default config
locale/{en,zh}.json   Display metadata read by Plugin Manager and Settings
docs/DETAIL.md        The detail document shown on the bundle's plugin page
scripts/check-*.ts    Contract and packaging gates
```

## Build contract

Two builds, two consumers, two formats. They write into the same `lib/`, so neither config sets `clean`; `pnpm build` wipes the directory once, first.

| Half | Format | Consumer | Produces |
|---|---|---|---|
| Host | ESM, `platform: node` | Node imports it as an ordinary module | `lib/index.js`, `lib/index.d.ts` |
| Client | CJS wrapped in `window.__ModuleLoader__.load(...)` | The page fetches it as a script and runs it | `lib/client.js` |

`package.json` exports both, so the loader needs no special paths:

```json
{
  ".":        { "types": "./lib/index.d.ts", "default": "./lib/index.js" },
  "./client": { "types": "./lib/client.d.ts", "default": "./lib/client.js" }
}
```

### Rules the build enforces

- **Named exports in the Client half.** The wrapper hands `module.exports` back to the loader. A default export arrives as `{ default: ... }` and registers nothing.
- **Only baseline `require` calls.** The page seeds a short module table — in practice `react` and `react/jsx-runtime`. Never import a `@deepseek-ai/*` package into the Client half: `import type` is erased and safe, a runtime import is not. The contract check greps for it.
- **No top-level side effects.** Running a client bundle only registers a factory; everything else happens when the module materialises.
- **One package name.** The registered `id`, the `dsh.client` declaration, and `package.json` `name` must agree.

## Local development

```sh
# 1. A web-shaped profile. `dsh plugin add` alone creates a base-backed profile,
#    which has no UI for the Client half to land in — start from the web template.
dsh --profile dev --from-default-profile web --dump-config > /dev/null

# 2. Link this checkout into it.
dsh plugin --profile dev add .

# 3. Confirm the layer composed, without booting.
dsh --profile dev --dump-config   # shows "# == dsh-bundle-template"

# 4. Boot and open the tokenized URL the CLI prints.
dsh --profile dev --port 0
```

Rebuild after source edits (`pnpm build`); a linked checkout is read in place. DSH resolves `@deepseek-ai/*` peers from the running installation, so the Host half shares the host's Cordis instance instead of a duplicate — pnpm prints a peer warning for the linked in package, which is expected here.

`pnpm install` also runs `prepare`, so a plain install leaves you with built output (~1.7 s, no type checking — the CI job owns that).

## Install it elsewhere

```sh
dsh plugin --profile demo add ./                # local directory (links the checkout)
dsh plugin --profile demo add ./pkg-0.1.0.tgz   # packed tarball
dsh plugin --profile demo add github:owner/repo#<sha>  # straight from git
```

A git install fetches **sources, not artifacts**: it runs this package's `prepare` script, so pnpm ≥ 10 asks you to allow that build the first time. Copy the package key pnpm prints into the profile's `pnpm-workspace.yaml`:

```yaml
allowBuilds:
  dsh-bundle-template: true
```

That allowance lets the package execute code on your machine at install time, so pin a commit when installing from git.

## Rename the template

Replace all of these together; the contract check fails if the registration id drifts from `package.json`:

1. `package.json` → `name`, `description`
2. `build/tsdown.client.ts` reads the name from the manifest, so it needs no edit
3. `cordis.patch.yml` → row `id` and `name`
4. `locale/{en,zh}.json` → `meta.title`, `meta.description`
5. `docs/DETAIL.md`, `README.md`, `README.zh.md`

## Gotchas this template already solves

- **`--config build/x.ts` makes tsdown treat `build/` as the working directory.** Both configs pin `cwd` to the project root; without it, `src/index.ts` does not resolve.
- **CJS output defaults to `.cjs` in a `"type": "module"` package.** The client config forces `.js` via `outExtensions`: the page fetches `client.js` by name and never imports it through Node, so the safety extension only breaks the expected path.
- **The Host build must not bundle `@deepseek-ai/*`.** A second Cordis or Schemastery instance on the host side breaks shared identity. They stay external and are declared under both `peerDependencies` and `devDependencies`.
- **A linked directory install hides `files` mistakes.** `pnpm pack:check` packs the tarball and asserts every needed entry is present and no `src/` leaks in.

## License

MIT
