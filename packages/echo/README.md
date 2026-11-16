# @dsh-bundle-template/echo

Host plugin for the bundle template: registers the `template_echo` tool.

## Configuration

| Key | Type | Default | Meaning |
|---|---|---|---|
| `greeting` | string | `Hello` | Word the tool repeats |
| `maxRepeats` | integer | `3` | Upper bound for `times` |

The bundle's row in `packages/bundle/cordis.patch.yml` supplies defaults. An
invalid value fails the plugin load with a message naming the field.

## Build

From the workspace root:

```sh
pnpm build
```

The Host build emits `lib/index.js` and `lib/index.d.ts`. `@deepseek-ai/*`
stays external; the package declares those imports as peers and dev
dependencies so the running installation supplies the instance.
