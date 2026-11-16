# @dsh-bundle-template/bundle

The composition package. It carries `dsh.bundle.patch`, bundle-level locale and
icon, and no runtime code.

Its `dependencies` list every plugin package the patch mounts:

```json
"dependencies": {
  "@dsh-bundle-template/echo": "workspace:*",
  "@dsh-bundle-template/badge": "workspace:*"
}
```

`pnpm pack`/`pnpm publish` rewrite `workspace:*` to the actual versions, so
install the plugin packages (or let the bundle's dependencies install them)
before expecting the rows to resolve.

See the workspace `README.md` for the local development flow and the
`@deepseek-ai/*` peer/dev rule.
