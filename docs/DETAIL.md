# Bundle template

A starting point for a DeepSeek Harness bundle built with TypeScript and tsdown.

## What it does

The bundle adds two small, self-contained capabilities so that both halves of a
client-capable plugin are exercised end to end:

- **A tool.** `template_echo` repeats a greeting. The greeting and the repeat
  cap come from the plugin's configuration, not from code.
- **A badge.** A small `template` chip in the composer dock, rendered by the
  Client half.

Both are examples to replace. Nothing here talks to the network, writes files,
or reads another plugin's state.

## Configuration

| Key | Type | Default | Meaning |
|---|---|---|---|
| `greeting` | string | `Hello` | Word the tool repeats |
| `maxRepeats` | integer | `3` | Upper bound for `times` |

Edit the row's `config` in a profile's `cordis.patch.yml` to change them. An
invalid value fails the plugin load with a message naming the field.

## Limitations

- The badge is decorative: it has no click target and shows no live state.
- The tool's output is a single text block; it declares no UI card.
- The Client half renders inline styles only. Shipped UI packages are not used,
  because a bundle installed outside the DSH installation cannot resolve them
  at runtime.
