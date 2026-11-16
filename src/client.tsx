/**
 * Client half of the bundle.
 *
 * Contract (enforced by `scripts/check-artifacts.ts`):
 *   - the built file registers itself as `window.__ModuleLoader__.load({ id, factory })`
 *     with `id` equal to the package name;
 *   - `factory(require)` returns a plugin object with `inject` and `apply`;
 *   - the only runtime `require` calls are baseline modules the page already
 *     provides — in practice `react` and `react/jsx-runtime`. Never require a
 *     `@deepseek-ai/*` package from here: the page's module table answers a
 *     short list, and a request outside it fails the whole bundle at load.
 *
 * Use named exports. The wrapper hands `module.exports` back to the loader, so
 * a default export would arrive as `{ default: ... }` and register nothing.
 */
import { useEffect, useState } from 'react'

import type { ClientContext } from './contract'

const SLOT = 'conversation.composer.dock'

export const inject = ['slots']

export function apply(ctx: ClientContext) {
  ctx.slots.inject(SLOT, () => {
    ctx.slots.register(
      { name: SLOT, id: 'dsh-bundle-template.badge', order: 50 },
      Badge,
    )
  })
}

function Badge() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  return (
    <span
      title="Served by the dsh-bundle-template client bundle"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.35em',
        padding: '0.2em 0.55em',
        borderRadius: '999px',
        border: '1px solid currentColor',
        font: 'inherit',
        fontSize: '0.75em',
        opacity: mounted ? 0.85 : 0.4,
        transition: 'opacity 160ms ease',
        pointerEvents: 'none',
      }}
    >
      <span aria-hidden="true">◆</span>
      template
    </span>
  )
}
