/**
 * Host half of the badge plugin.
 *
 * The badge is a Client-side decoration, but a Client bundle attaches to an
 * active Loader row: `dsh-client-modules` scans active rows and reads the
 * nearest package manifest's `dsh.client`. This no-op Host entry is that
 * anchor; all behavior lives in `src/client.tsx`.
 */
import type { Context } from '@deepseek-ai/cordis'

export const name = '@dsh-bundle-template/badge'

/** No Host services are required. */
export const inject: string[] = []

export function apply(_ctx: Context): void {
  // Intentionally empty: the row's only job is to activate the Client half.
}
