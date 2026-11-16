/**
 * The browser-side contract a DSH client bundle must satisfy.
 *
 * These types are authored locally on purpose: the DSH client runtime is not
 * published as a stable consumer API, so a template that imported it would
 * break on the next release. Type-only imports of `@deepseek-ai/dsh-*` are
 * acceptable for slot names, but nothing here may reach the bundle as a
 * runtime `require`.
 */

/** What `factory(require)` must return: a Cordis plugin object. */
export interface ClientPlugin {
  /** Client service names this plugin needs before `apply` runs. */
  inject?: string[]
  apply(ctx: ClientContext): void
}

/** The subset of the client context this template uses. */
export interface ClientContext {
  slots: {
    /** Run `callback` once the named slot exists. */
    inject(name: string, callback: () => void): void
    /** Contribute a component to the named slot. */
    register(
      options: { name: string; id: string; order?: number },
      component: (props: Record<string, unknown>) => unknown,
    ): () => void
  }
  /** Run `callback` on activation; the returned disposer runs on unload. */
  effect(callback: () => () => void): void
}

/** The page-global module loader every client bundle registers itself into. */
export interface ModuleLoader {
  load(options: {
    id: string
    factory: (require: (request: string) => unknown) => ClientPlugin
  }): void
}
