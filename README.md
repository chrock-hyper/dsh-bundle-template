# dsh-bundle-template

English | [中文](README.zh.md)

A pnpm monorepo starter for a [DeepSeek Harness](https://github.com/deepseek-ai) bundle: **one meta-package plus N real plugin packages**. Each plugin is installed, enabled, disabled, and versioned independently; a plugin that has a browser surface ships its own Client half and its own row-level display metadata. The meta-package only composes the rows and supplies default configuration.

## Why a monorepo

DSH identifies one Loader row through three different keys:

- **Loader**: `name` accepts anything — a bare package, a subpath, a relative path, a `file:` URL;
- **client-modules**: accepts a package — it walks up from the row's module to the nearest `package.json`, and one package may have only one active Client source;
- **Plugin Manager metadata**: accepts a bare package specifier only — a relative-path row has no row-level title or icon.

For a component to have an independent row, its own Client lifecycle, and its own row metadata all at once, the plugin must be a real package that Node can resolve. The meta-package inserts rows and supplies defaults; it never merges the plugins into one runtime object.

Read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) (Chinese) for the full derivation and the four shape trade-offs.

## Layout

```
packages/
  bundle/               # meta-package: cordis.patch.yml + bundle-level locale/icon/docs
  echo/                 # plugin: Host tool template_echo
  badge/                # plugin: no-op Host entry + Client badge
build/config.ts         # shared tsdown config: Host ESM / Client loader wrapper
scripts/build.ts        # enumerate packages/*, build each half
scripts/check-pack.ts   # per-package npm pack file-list check
templates/github-actions/ci.yml  # optional CI, disabled by default
docs/ARCHITECTURE.md    # identity model and shape trade-offs
```

## Quick start

```sh
pnpm install
pnpm check
```

`pnpm check` runs `typecheck`, `build`, and `pack:check`. The contract check is not included yet; add it per package when you need it.

`pnpm install` runs the root `prepare`, so `lib/` exists after install.

## The two examples

| Package | What it does | Host half | Client half |
|---|---|---|---|
| `@dsh-bundle-template/echo` | `template_echo` tool, configured by the row | yes | — |
| `@dsh-bundle-template/badge` | a chip under the composer | no-op anchor | yes |
| `@dsh-bundle-template/bundle` | composition: patch, locale, icon, docs | — | — |

`echo` shows a Host-only plugin; `badge` shows a Host anchor plus a Client half. Each plugin carries its own `locale/` and `icon.svg`, so every Plugin Manager row has its own title, description, and artwork.

## Add a plugin

1. Copy `packages/echo` or `packages/badge` to `packages/<name>`.
2. Rename the package, then update `src/`, `locale/`, and `icon.svg`.
3. Add `"@your-scope/<name>": "workspace:*"` to `packages/bundle/package.json` dependencies.
4. Add one row to `packages/bundle/cordis.patch.yml`; add `config` only when the plugin exports a `Config` schema.
5. Run `pnpm install` (creates the workspace link) and `pnpm check` from the root.

N=1 and N=10 use the same path; the meta-package needs no code change for a new plugin.

## The `@deepseek-ai/*` rule

Every plugin package:

- declares each imported `@deepseek-ai/*` package in both `peerDependencies` and `devDependencies`;
- keeps those packages external at build time (`neverBundle` in `build/config.ts`);
- uses `import type` only in the Client half; never a runtime import.

All three are required:

- `devDependencies` let local builds, type checking, and tests resolve the package;
- `peerDependencies` let the profile resolver route a linked importer's bare request to the installation copy — `dsh-app-boot`'s resolver reads an ancestor `package.json`'s peers and routes a match to installation scope;
- keeping the import external means a bare request still exists at runtime. If the bundler inlines `@deepseek-ai/*`, you get a second Cordis or Schemastery instance and the peer declaration cannot help.

The Client half is outside this mechanism: the browser module table seeds only baseline modules such as `react`; a runtime `@deepseek-ai/*` import fails the whole bundle at load.

## Local development

```sh
# 1. Create a web-capable dev profile (a plain plugin add creates a base
#    profile with no UI surface for the Client half).
dsh --profile dev --from-default-profile web --dump-config > /dev/null

# 2. Install at the monorepo root so packages/bundle/node_modules has the
#    sibling links.
pnpm install

# 3. Link the meta-package. Do not use file: (see below).
dsh plugin --profile dev add ./packages/bundle

# 4. Confirm the composed rows.
dsh --profile dev --dump-config   # expect echo and badge

# 5. Start.
dsh --profile dev --port 0
```

**`file:` does not work.** `workspace:*` resolves only inside the workspace. Installing the meta-package through `file:` makes pnpm resolve its dependencies in the consumer context and fails with:

```
ERR_PNPM_WORKSPACE_PKG_NOT_FOUND
"@scope/echo@workspace:*" is in the dependencies but no package named "@scope/echo" is present in the workspace
```

Use `link:` / `dsh plugin add`. In a packed or published install, `pnpm pack` rewrites `workspace:*` to real versions; that is when `file:` tarballs or a registry install applies.

### What a link install does and does not prove

A link install proves composition: the rows mount, the Client half loads, the row config applies.

It does not prove that the plugins use the host's `@deepseek-ai/*` instances. When only the meta-package is linked, the plugin packages live outside the linked root; the profile resolver's linked-root check may not cover them, so their static imports fall back to Node resolution and the workspace's dev-dependency copies.

To test instance sharing, either:

1. make each plugin package a top-level `link:` in the disposable dev profile, so each becomes a linked root; or
2. do a release-like install: `pnpm pack` every package and install the tarballs into a disposable profile (a local registry makes this easier).

Do not conclude that instance sharing works just because the linked UI renders.

## Build

| Half | Format | Consumer | Artifact |
|---|---|---|---|
| Host | ESM, `platform: node` | Node imports it as a normal module | `packages/<name>/lib/index.js`, `index.d.ts` |
| Client | CJS wrapped in `window.__ModuleLoader__.load(...)` | the page fetches and runs it as a script | `packages/<name>/lib/client.js` |

- Each package owns its `lib/`; `scripts/build.ts` cleans it per package.
- `build/config.ts` is the shared config; `scripts/build.ts` enumerates `packages/*`, skips the pure meta-package, and builds the Host and/or Client half from `src/index.ts` and `dsh.client`.
- Host builds keep `@deepseek-ai/*` external; Client builds keep `react` and `react/jsx-runtime` external.
- The Client loader id comes from the package name at build time; renaming a package does not require editing the banner.

## Pack and publish

```sh
pnpm --filter @dsh-bundle-template/echo pack
pnpm --filter @dsh-bundle-template/badge pack
pnpm --filter @dsh-bundle-template/bundle pack
```

`pnpm pack` rewrites the bundle's `workspace:*` dependencies to real versions. Installing the meta-package then installs the plugin packages from those versions, so **publish every plugin package**, not just the meta-package.

- Publish plugins first, then the meta-package.
- A single-tarball distribution could use `bundledDependencies`, but whether DSH's install path preserves bundled dependencies needs an experiment; this template does not assume it.
- There is no publish workflow; releasing is a manual step.

## Optional CI

The template ships no `.github/workflows/`. To enable it:

```sh
mkdir -p .github/workflows
cp templates/github-actions/ci.yml .github/workflows/ci.yml
```

The workflow runs `pnpm typecheck`, `pnpm build`, and `pnpm pack:check`, installing with `--ignore-scripts` so a build failure is not mistaken for an install failure.

## Rename for your scope

`@dsh-bundle-template` is a placeholder. Update:

1. `name` in every `packages/*/package.json`;
2. the `dependencies` keys in `packages/bundle/package.json`;
3. every `name` in `packages/bundle/cordis.patch.yml`;
4. the `name` constants and comments in each plugin's source;
5. titles and package names in `locale/*.json`, `README.md`, and `docs/`.

Then run `pnpm install && pnpm check`. The Client loader id is read from `package.json` at build time.

## Pitfalls this template already handles

- **The meta-package must not declare `dsh.client`.** It inserts several rows, and one package may have only one active Client source.
- **One UI-bearing component per package.** Do not put several panels under one package's `dsh.client`; their UI lifecycle becomes coupled and cannot be enabled per row.
- **A plugin package must export `./locale/*.json`, `./icon`, and `./package.json`.** `readPluginMeta` reads row titles and icons through those exports; exporting only `.` and `./client` leaves the metadata unreadable.
- **A relative-path row has a Client half but no row metadata; a subpath row has metadata but no Client half.** A bare package root is the only specifier where all three identities agree.
- **The Client half must not runtime-import `@deepseek-ai/*`.** The page module table does not answer it; `import type` is erased and safe.
- **A link install is not a production install.** Verify instance sharing separately.
- **Do not hand-replace `workspace:*` with `file:`.** `pnpm pack` rewrites only `workspace:`, and a `file:` path would leak into the tarball.

## License

MIT
