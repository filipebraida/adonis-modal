/*
 * adonis-inertia-modal — Vue client
 */

import { shallowRef, type App, type Component } from 'vue'
import { router as inertiaRouter } from '@inertiajs/vue3'

import { createFetchClient } from '../core/fetch_client.ts'
import { ModalHistory } from '../core/history.ts'
import { ModalLocationError, requestModal, type HttpClientLike } from '../core/open.ts'
import { PrefetchCache } from '../core/prefetch_cache.ts'
import { generateId, ModalStack } from '../core/stack.ts'
import type { ModalEntry, ModalResponsePayload } from '../core/types.ts'
import { modalStackKey, type ModalContext } from './context.ts'
import type { PageInfo, PrefetchOptions, ReloadOptions, VisitOptions } from './types.ts'

export interface ModalPluginOptions {
  httpClient?: HttpClientLike
  resolveComponent?: (name: string) => Promise<Component>
  navigate?: (url: string) => void
}

const EMPTY_PAGE: PageInfo = { component: '', url: '', props: {} }

export function createModalContext(options: ModalPluginOptions = {}): ModalContext {
  const instance = new ModalStack()
  const stack = shallowRef<ModalEntry[]>(instance.getSnapshot())
  instance.subscribe(() => {
    stack.value = instance.getSnapshot()
  })

  const page = shallowRef<PageInfo>(EMPTY_PAGE)

  const client = options.httpClient ?? createFetchClient()
  const resolve =
    options.resolveComponent ??
    ((name: string) => inertiaRouter.resolveComponent(name) as Promise<Component>)
  const navigate = options.navigate ?? ((url: string) => inertiaRouter.visit(url))

  const cache = new PrefetchCache()

  const modalHistory = new ModalHistory()
  // Close the popped modal directly (Back already removed the browser entry).
  modalHistory.install((id) => instance.close(id))

  // Mark closing (fires onClose); the modal's leave transition drives remove().
  // A UI close of a history-tracked modal also rolls back its browser entry.
  const close = (id: string) => {
    if (modalHistory.tracks(id)) {
      modalHistory.release(id)
    }
    instance.close(id)
  }
  const closeAll = () => instance.closeAll()
  const remove = (id: string) => instance.remove(id)

  const prefetch = async (href: string, opts: PrefetchOptions = {}) => {
    if (href.startsWith('#')) return
    const key = PrefetchCache.key(href, opts.method, opts.data)
    if (cache.has(key)) return
    const current = page.value
    const payload = await requestModal(client, {
      href,
      method: opts.method,
      data: opts.data,
      headers: opts.headers,
      currentComponent: current.component,
      version: current.version,
      redirectUrl: current.url,
    })
    cache.set(key, payload, opts.cacheFor)
  }

  const visit = async (href: string, opts: VisitOptions = {}): Promise<ModalEntry> => {
    if (href.startsWith('#')) {
      const entry = instance.push(
        { component: '', props: opts.props ?? {}, key: generateId() },
        {
          name: href.slice(1),
          local: true,
          config: opts.config,
          onClose: opts.onClose,
          onAfterLeave: opts.onAfterLeave,
        }
      )
      if (opts.listeners) {
        for (const [event, cb] of Object.entries(opts.listeners)) entry.emitter.on(event, cb)
      }
      opts.onSuccess?.()
      return entry
    }

    opts.onStart?.()
    try {
      const current = page.value
      const key = PrefetchCache.key(href, opts.method, opts.data)
      const payload =
        cache.get(key) ??
        (await requestModal(client, {
          href,
          method: opts.method,
          data: opts.data,
          headers: opts.headers,
          currentComponent: current.component,
          version: current.version,
          redirectUrl: current.url,
        }))

      const entry = instance.push(payload, {
        url: href,
        config: opts.config,
        onClose: opts.onClose,
        onAfterLeave: opts.onAfterLeave,
      })
      if (opts.listeners) {
        for (const [event, cb] of Object.entries(opts.listeners)) entry.emitter.on(event, cb)
      }
      if (opts.history) {
        modalHistory.push(entry.id)
      }
      opts.onSuccess?.()
      return entry
    } catch (error) {
      // Redirect / version mismatch: navigate instead of treating it as an error.
      if (error instanceof ModalLocationError) {
        if (error.hard && typeof window !== 'undefined') {
          window.location.href = error.location
        } else {
          navigate(error.location)
        }
        throw error
      }
      // Default behavior: log so a failed open (404, non-modal response) isn't
      // silent. Pass onError to override (e.g. a toast).
      if (opts.onError) {
        opts.onError(error)
      } else {
        console.error(
          '[adonis-inertia-modal] Failed to open modal (pass onError to handle):',
          error
        )
      }
      throw error
    }
  }

  const reload = async (id: string, opts: ReloadOptions = {}): Promise<void> => {
    const entry = instance.get(id)
    if (!entry?.url) return
    opts.onStart?.()
    try {
      const current = page.value
      const only = opts.only ? ['modal', ...opts.only.map((k) => `modal.props.${k}`)] : ['modal']
      const payload = await requestModal(client, {
        href: entry.url,
        data: opts.data,
        headers: opts.headers,
        currentComponent: current.component,
        version: current.version,
        only,
      })
      let props = payload.props
      if (opts.except) {
        const except = new Set(opts.except)
        props = Object.fromEntries(Object.entries(props).filter(([key]) => !except.has(key)))
      }
      instance.updateProps(id, props)
      opts.onSuccess?.()
    } catch (error) {
      opts.onError?.(error)
      throw error
    } finally {
      opts.onFinish?.()
    }
  }

  /**
   * Fed by ModalRoot whenever the Inertia page changes. Mirrors the React
   * provider: a real navigation resets the stack; a modal in the page props is
   * pushed (or updated in place if the top modal is the same one re-rendered).
   */
  let prevUrl: string | undefined
  const syncPage = (next: PageInfo) => {
    const navigated = prevUrl !== undefined && prevUrl !== next.url
    prevUrl = next.url
    page.value = next
    if (navigated) instance.reset()

    const pageModal = next.props?.modal as ModalResponsePayload | undefined
    if (!pageModal || !pageModal.key || instance.get(pageModal.key)) return

    const top = instance.top
    if (top && top.component === pageModal.component && top.baseUrl === pageModal.baseUrl) {
      instance.updateProps(top.id, pageModal.props)
      return
    }
    instance.push(pageModal, {
      url: next.url,
      onClose: () => {
        if (pageModal.redirectUrl) navigate(pageModal.redirectUrl)
      },
    })
  }

  return {
    stack,
    page,
    resolve,
    visit,
    visitModal: visit,
    close,
    closeAll,
    remove,
    reload,
    prefetch,
    syncPage,
    navigate,
  }
}

export const modal = {
  install(app: App, options: ModalPluginOptions = {}) {
    app.provide(modalStackKey, createModalContext(options))
  },
}
