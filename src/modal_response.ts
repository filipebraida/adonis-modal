/// <reference types="@adonisjs/session/session_middleware" />

/*
 * adonis-inertia-modal
 *
 * Backend-driven modals for Inertia.js on AdonisJS.
 */

import { randomUUID } from 'node:crypto'
import type { HttpContext } from '@adonisjs/core/http'
import { BaseSerializer } from '@adonisjs/core/transformers'
import { InertiaHeaders } from '@adonisjs/inertia'

import { ModalHeaders } from './headers.ts'
import { resolveModalProps, type ResolveModalPropsOptions } from './resolve_modal_props.ts'
import type { Backdrop, ModalPayload, ModalProps } from './types.ts'

/**
 * Serializes modal prop values the same way the Inertia adapter serializes
 * top-level page props, so transformer outputs (`SomeTransformer.transform(...)`),
 * Lucid models, dates, etc. resolve to plain JSON inside `modal.props` — which
 * the adapter would otherwise leave unresolved because they're nested.
 */
class ModalSerializer extends BaseSerializer {
  wrap: undefined = undefined
  definePaginationMetaData(metaData: unknown): unknown {
    return metaData
  }
}
const modalSerializer = new ModalSerializer()

/**
 * Minimal surface of the per-request Inertia instance we rely on. The adapter's
 * real `Inertia` type can't be used here: its `share()` requires `JSONDataTypes`
 * (an index signature) which our typed `ModalPayload` envelope doesn't satisfy.
 */
export interface InertiaLike {
  share(state: Record<string, unknown>): unknown
  render(component: string, props: Record<string, unknown>): unknown
}

/**
 * Minimal surface of the AdonisJS router we rely on. Injected by the provider
 * (resolved from the container) rather than imported as a global service, so
 * the class stays usable without a booted app — e.g. in unit tests.
 */
export interface RouterLike {
  usingDomains: boolean
  makeUrl(name: string, params?: any[] | Record<string, any>, options?: Record<string, any>): string
  match(uri: string, method: string, shouldDecodeParam: boolean, hostname?: string | null): any
}

/**
 * A chainable, awaitable builder returned by `inertia.modal(...)`.
 *
 * The modal is delivered as a shared `modal` prop on a regular Inertia page,
 * so the backdrop (base route) renders normally and the modal "rides along".
 * There are three rendering paths, selected from the request headers:
 *
 *  - **Via link** (Inertia request that partially reloads the current backdrop
 *    component): re-render that component cheaply, merging only the `modal`
 *    prop. The backdrop stays put and the modal is stacked on top.
 *  - **Direct URL access** (non-Inertia full load, or an Inertia visit without a
 *    known backdrop): dispatch the base route handler in the same context so the
 *    backdrop page renders with the modal shared into it. Deep-linkable.
 *  - **Refresh backdrop**: force the direct path even on Inertia requests to get
 *    fresh backdrop data behind the modal.
 *
 * See docs/design/spike-server-dispatch.md for the full rationale.
 */
export class ModalResponse {
  #refreshBackdrop = false
  #forceBase = false
  #renderPromise?: Promise<unknown>

  private props: ModalProps

  constructor(
    private inertia: InertiaLike,
    private ctx: HttpContext,
    private component: string,
    props: ModalProps,
    private backdrop: Backdrop,
    private router?: RouterLike
  ) {
    // Copy so `.with(...)` never mutates the caller's object (a controller may
    // reuse or share the props it passes in).
    this.props = { ...props }
  }

  /**
   * Force re-rendering the backdrop with fresh data even on Inertia requests.
   */
  refreshBackdrop(refresh = true): this {
    this.#refreshBackdrop = refresh
    return this
  }

  /**
   * Ignore the redirect header / referer and force the configured base URL as
   * the place to navigate when the modal closes.
   */
  forceBase(force = true): this {
    this.#forceBase = force
    return this
  }

  /**
   * Merge additional props into the modal.
   */
  with(props: ModalProps): this
  with(key: string, value: unknown): this
  with(key: string | ModalProps, value?: unknown): this {
    if (typeof key === 'string') {
      this.props[key] = value
    } else {
      this.props = { ...this.props, ...key }
    }
    return this
  }

  /**
   * Make the builder awaitable, so a controller can simply
   * `return inertia.modal(component, props, backdrop)`.
   */
  then<T>(
    onfulfilled?: ((value: any) => T | PromiseLike<T>) | null,
    onrejected?: ((reason: any) => any) | null
  ): Promise<T> {
    return this.render().then(onfulfilled, onrejected)
  }

  /**
   * Resolve the response: a PageObject (Inertia request) or HTML (initial load).
   * Memoized so awaiting the builder more than once does not re-run the pipeline
   * (which would re-dispatch the backdrop, mint a new key and re-set headers).
   */
  render(): Promise<unknown> {
    if (!this.#renderPromise) {
      this.#renderPromise = this.#render()
    }
    return this.#renderPromise
  }

  async #render(): Promise<unknown> {
    const request = this.ctx.request
    const isInertia = !!request.header(InertiaHeaders.Inertia)
    const partialComponent = request.header(InertiaHeaders.PartialComponent)

    /**
     * Share the modal envelope so whichever backdrop renders carries it as the
     * `modal` prop.
     */
    this.inertia.share({ modal: await this.#buildPayload() })

    /**
     * Path A — opened via link: the client partially reloads the current
     * backdrop component requesting only the `modal` prop. Re-render that exact
     * component; Inertia keeps the page and merges `props.modal`.
     */
    if (isInertia && partialComponent && !this.#refreshBackdrop) {
      this.ctx.response.header(ModalHeaders.Modal, 'true')
      return this.inertia.render(partialComponent, {})
    }

    /**
     * Path B/C — direct access or explicit refresh: render a fresh backdrop by
     * dispatching the base route handler within the current context.
     */
    this.ctx.response.header(ModalHeaders.Modal, 'true')
    return this.#renderBackdrop()
  }

  /**
   * Dispatch the base route handler in the current context to render the
   * backdrop. We invoke ONLY the handler (not the full middleware pipeline) on
   * purpose: re-running global middleware would re-init `ctx.inertia` and drop
   * our shared `modal` prop. See docs/design/spike-server-dispatch.md §3.
   */
  async #renderBackdrop(): Promise<unknown> {
    const ctx = this.ctx
    const router = this.#requireRouter()
    const baseUrl = this.#resolveBaseUrl()
    const [path] = baseUrl.split('?')

    const hostname = router.usingDomains ? ctx.request.hostname() : undefined
    const shouldDecodeParam = ctx.request.parsedUrl?.shouldDecodeParam ?? true
    const matched = router.match(path, 'GET', shouldDecodeParam, hostname)

    if (!matched) {
      throw new Error(
        `adonis-inertia-modal: could not resolve a GET route for the backdrop URL "${baseUrl}". ` +
          `Make sure the backdrop route/url passed to inertia.modal(...) exists.`
      )
    }

    /**
     * Point the context at the base route so its handler resolves params and
     * route-model bindings against the backdrop, while `ctx.request.url()`
     * (used for the page URL) still reflects the modal URL — keeping the
     * browser on the deep-linkable modal address.
     */
    const previous = {
      params: ctx.params,
      subdomains: ctx.subdomains,
      route: ctx.route,
      routeKey: ctx.routeKey,
    }
    ctx.params = matched.params
    ctx.subdomains = matched.subdomains
    ctx.route = matched.route
    ctx.routeKey = matched.routeKey

    /**
     * Restore the original routing state once the backdrop handler has produced
     * its response, so anything that runs after (exception handling, logging,
     * post-handler middleware) still sees the modal route the request hit.
     */
    try {
      const handler = matched.route.handler
      if (typeof handler === 'function') {
        return await handler(ctx)
      }
      return await handler.handle(ctx.containerResolver, ctx)
    } finally {
      ctx.params = previous.params
      ctx.subdomains = previous.subdomains
      ctx.route = previous.route
      ctx.routeKey = previous.routeKey
    }
  }

  /**
   * Build the modal envelope, resolving defer/optional/merge/always wrappers and
   * dot-notation inside `modal.props`.
   */
  async #buildPayload(): Promise<ModalPayload> {
    const resolved = await resolveModalProps(this.props, this.#resolveOptions())

    const payload: ModalPayload = {
      component: this.component,
      baseUrl: this.#resolveBaseUrl(),
      redirectUrl: this.#redirectUrl(),
      props: await this.#serializeProps(resolved.props),
      key: this.#modalKey(),
    }

    if (Object.keys(resolved.deferred).length > 0) {
      payload.deferred = resolved.deferred
    }
    if (resolved.mergeProps.length > 0) {
      payload.mergeProps = resolved.mergeProps
    }
    if (resolved.deepMergeProps.length > 0) {
      payload.deepMergeProps = resolved.deepMergeProps
    }

    return payload
  }

  /**
   * Serialize each modal prop value via the adapter's serializer (transformers,
   * Lucid models, dates → plain JSON), mirroring how Inertia serializes
   * top-level props.
   */
  async #serializeProps(props: Record<string, unknown>): Promise<Record<string, unknown>> {
    const resolver = this.ctx.containerResolver
    const entries = await Promise.all(
      Object.entries(props).map(async ([key, value]) => {
        if (value === null || value === undefined) {
          return [key, value] as const
        }
        return [key, await modalSerializer.serialize(value as never, resolver)] as const
      })
    )
    return Object.fromEntries(entries)
  }

  /**
   * Derive prop-resolution options from the request: a partial reload targeting
   * `modal.props.*` becomes a cherry-pick of those (relative) modal prop names.
   */
  #resolveOptions(): ResolveModalPropsOptions {
    const prefix = 'modal.props.'
    const strip = (entries: string[]) =>
      entries.filter((entry) => entry.startsWith(prefix)).map((entry) => entry.slice(prefix.length))

    const only = strip(this.#headerList(InertiaHeaders.PartialOnly))
    if (only.length > 0) {
      return { partial: true, only }
    }

    const except = strip(this.#headerList(InertiaHeaders.PartialExcept))
    if (except.length > 0) {
      return { partial: true, except }
    }

    return { partial: false }
  }

  /**
   * Resolve where to navigate when the modal closes.
   */
  #redirectUrl(): string {
    if (this.#forceBase) {
      return this.#resolveBaseUrl()
    }

    const request = this.ctx.request
    const headerRedirect = request.header(ModalHeaders.Redirect)
    const referer = request.header(InertiaHeaders.Inertia) ? request.header('referer') : undefined
    const candidate = headerRedirect ?? referer

    return (candidate && this.#sameOriginPath(candidate)) || this.#resolveBaseUrl()
  }

  /**
   * Reduce a redirect candidate to a safe same-origin path. The candidate comes
   * from client-controlled headers (`x-inertia-modal-redirect` / `referer`), so
   * an absolute URL to another host is rejected to avoid an open redirect when
   * the client navigates here on close. Root-relative paths pass through;
   * same-host absolute URLs are reduced to path+query; anything else returns
   * undefined (caller falls back to the base URL).
   */
  #sameOriginPath(value: string): string | undefined {
    // Root-relative path (but not a protocol-relative "//host").
    if (value.startsWith('/') && !value.startsWith('//')) {
      return value
    }
    try {
      const host = this.ctx.request.host()
      const url = new URL(value)
      if (host && url.host === host) {
        return `${url.pathname}${url.search}`
      }
    } catch {
      // Not a parseable absolute URL — fall through to undefined.
    }
    return undefined
  }

  /**
   * Decide the modal instance key. Reuse the client-supplied key for sparse
   * reloads of the on-screen modal (`only: ['modal.props.*']`) and for
   * validation error responses, so the mounted modal/form is not remounted.
   * Otherwise mint a fresh key for a new modal instance.
   */
  #modalKey(): string {
    if (this.#isSparseModalReload() || this.#hasValidationErrors()) {
      return this.ctx.request.header(ModalHeaders.Key) ?? randomUUID()
    }
    return randomUUID()
  }

  #isSparseModalReload(): boolean {
    const request = this.ctx.request
    if (!request.header(InertiaHeaders.PartialComponent)) {
      return false
    }

    const targetsModalProps = (entries: string[]) =>
      entries.some((entry) => entry.startsWith('modal.props.'))

    return (
      targetsModalProps(this.#headerList(InertiaHeaders.PartialOnly)) ||
      targetsModalProps(this.#headerList(InertiaHeaders.PartialExcept))
    )
  }

  #hasValidationErrors(): boolean {
    const session = this.ctx.session
    if (!session) {
      return false
    }
    const errors = session.flashMessages.get('inputErrorsBag') as
      | Record<string, unknown>
      | undefined
    return !!errors && Object.keys(errors).length > 0
  }

  #headerList(header: string): string[] {
    return (this.ctx.request.header(header) ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
  }

  #resolveBaseUrl(): string {
    const backdrop = this.backdrop
    if ('url' in backdrop) {
      return backdrop.url
    }
    const options = backdrop.qs ? { qs: backdrop.qs } : undefined
    return this.#requireRouter().makeUrl(backdrop.route, backdrop.params, options)
  }

  #requireRouter(): RouterLike {
    if (!this.router) {
      throw new Error(
        'adonis-inertia-modal: the router is not available. This usually means the ModalResponse was ' +
          'constructed without one (the provider injects it automatically in a running app).'
      )
    }
    return this.router
  }
}
