/**
 * Host half of the echo plugin.
 *
 * A Host plugin is a Cordis plugin: it exports `apply(ctx, config)` plus an
 * optional `inject` (service names it needs) and an optional `Config`
 * (Schemastery schema that validates the bundle row's `config` at activation).
 *
 * `@deepseek-ai/*` imports stay bare. The build externalizes them, and the
 * package declares them in both `peerDependencies` and `devDependencies`: the
 * profile resolver routes a linked importer's bare request to the installation
 * copy when the importer declares it as a peer, while the dev copy only serves
 * typecheck and local builds.
 */
import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import Schema from '@deepseek-ai/schemastery'

export const name = '@dsh-bundle-template/echo'

/** The tool registry must be up before `apply` runs. */
export const inject = ['tools']

export interface Config {
  /** Word the example tool repeats. Change it from the bundle row, not code. */
  greeting: string
  /** Upper bound accepted by the example tool. */
  maxRepeats: number
}

export const Config: Schema<Config> = Schema.object({
  greeting: Schema.string().default('Hello'),
  maxRepeats: Schema.number().default(3),
})

export function apply(ctx: Context, config: Config) {
  ctx.tools.register(
    defineTool({
      name: 'template_echo',
      description: 'Repeat a greeting a configurable number of times.',
      parameters: {
        who: { type: 'string', required: true, description: 'Who to greet' },
        times: {
          type: 'integer',
          description: 'How many times to repeat the greeting',
        },
      },
      output: {
        schema: { type: 'string' },
        render: (_args, value) => [{ type: 'text', text: value }],
      },
      async execute(args) {
        const times = Math.min(Math.max(args.times ?? 1, 1), config.maxRepeats)
        return Array.from({ length: times }, () => `${config.greeting}, ${args.who}!`).join('\n')
      },
    }),
  )
}
