# @dsh-bundle-template/badge

Client plugin for the bundle template: renders a small `badge` chip in the
composer dock (`conversation.composer.dock`).

The package also exports a no-op Host entry. That row is what `dsh-client-modules`
scans to discover `dsh.client`; without an active Loader row the browser bundle
is never part of the boot graph.

## Notes

- No configuration.
- The Client half imports only `react`; `@deepseek-ai/*` is never required at
  runtime in the browser.
- The slot entry id is `dsh-bundle-template.badge`; keep it stable per package.

## Build

From the workspace root:

```sh
pnpm build
```

The Host build emits `lib/index.js`; the Client build emits the wrapped
`lib/client.js` and its declarations.
