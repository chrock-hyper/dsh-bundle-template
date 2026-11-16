# Bundle template

A monorepo bundle: one meta-package that composes independent plugin packages.

## Rows

| Row | Package | What it adds |
|---|---|---|
| `echo` | `@dsh-bundle-template/echo` | the `template_echo` tool, configured by the row |
| `badge` | `@dsh-bundle-template/badge` | a small `badge` chip in the composer dock |

The rows are independent. Disabling `echo` in Plugin Manager removes the tool
but leaves the badge; disabling `badge` removes the browser bundle while the
tool stays. The bundle itself has no Host code and no Client half.

## Configuration

The `echo` row supplies `greeting` (string, default `Hello`) and `maxRepeats`
(integer, default `3`). The `badge` row has no configuration. Edit the row's
`config` in `cordis.patch.yml`, or override it from the profile's own patch
layer.

## Adding a plugin

1. Copy `packages/echo` or `packages/badge` to `packages/<name>`.
2. Rename its package, source, locale, and icon.
3. Add `"@your-scope/<name>": "workspace:*"` to this package's `dependencies`.
4. Add one `- id` / `name` row to `cordis.patch.yml`; add `config` only when the
   plugin exports a `Config` schema.
5. Run `pnpm install` and `pnpm check` from the workspace root.

## Limitations

- The badge is decorative: it has no click target and shows no live state.
- The tool's output is one text block; it declares no UI card.
- The Client half renders inline styles only. Shipped UI packages are not used,
  because a bundle installed outside the DSH installation cannot resolve them
  at runtime.
