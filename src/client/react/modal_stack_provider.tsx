/*
 * adonis-inertia-modal — React client
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ComponentType,
  type ReactNode,
} from 'react'
import { router as inertiaRouter } from '@inertiajs/react'

import { createFetchClient } from '../core/fetch_client.ts'
import { ModalHistory } from '../core/history.ts'
import { ModalLocationError, requestModal, type HttpClientLike } from '../core/open.ts'
import { PrefetchCache } from '../core/prefetch_cache.ts'
import { generateId, ModalStack } from '../core/stack.ts'
import type { ModalEntry, ModalResponsePayload } from '../core/types.ts'
import { ModalStackContext, type ModalStackContextValue } from './context.ts'
import type { PageInfo, PrefetchOptions, ReloadOptions, VisitOptions } from './types.ts'

export interface ModalStackProviderProps {
  children: ReactNode
  /** HTTP client used to fetch modals. Defaults to a fetch-based client. */
  httpClient?: HttpClientLike
  /** Resolves a component name to a component. Defaults to Inertia's resolver. */
  resolveComponent?: (name: string) => Promise<ComponentType>
  /** Navigates the browser (used when closing a deep-linked modal). */
  navigate?: (url: string) => void
}

const EMPTY_PAGE: PageInfo = { component: '', url: '', props: {} }

export function ModalStackProvider({
  children,
  httpClient,
  resolveComponent,
  navigate,
}: ModalStackProviderProps) {
  const stackRef = useRef<ModalStack | null>(null)
  if (!stackRef.current) {
    stackRef.current = new ModalStack()
  }
  const stackInstance = stackRef.current

  const historyRef = useRef<ModalHistory | null>(null)
  if (!historyRef.current) {
    historyRef.current = new ModalHistory()
  }
  const modalHistory = historyRef.current

  const stack = useSyncExternalStore(
    stackInstance.subscribe,
    stackInstance.getSnapshot,
    stackInstance.getSnapshot
  )

  const client = useMemo(() => httpClient ?? createFetchClient(), [httpClient])
  const resolve = useMemo<(name: string) => Promise<ComponentType>>(
    () =>
      resolveComponent ??
      ((name) => inertiaRouter.resolveComponent(name) as Promise<ComponentType>),
    [resolveComponent]
  )
  const doNavigate = useMemo<(url: string) => void>(
    () => navigate ?? ((url) => inertiaRouter.visit(url)),
    [navigate]
  )

  /**
   * The current Inertia page is fed in by <ModalRoot> (which lives inside the
   * Inertia app where usePage() works), so the provider can wrap <App> at the
   * root without needing the page context itself.
   */
  const [page, setPage] = useState<PageInfo>(EMPTY_PAGE)
  const pageRef = useRef(page)
  pageRef.current = page
  const prevUrlRef = useRef<string | undefined>(undefined)
  const syncPage = useCallback((next: PageInfo) => setPage(next), [])

  // Close the popped modal directly (Back already removed the browser entry).
  useEffect(() => {
    modalHistory.install((id) => stackInstance.close(id))
  }, [modalHistory, stackInstance])

  // Mark closing (fires onClose); the modal's leave transition drives remove().
  // A UI close of a history-tracked modal also rolls back its browser entry.
  const close = useCallback(
    (id: string) => {
      if (modalHistory.tracks(id)) {
        modalHistory.release(id)
      }
      stackInstance.close(id)
    },
    [stackInstance, modalHistory]
  )
  const closeAll = useCallback(() => stackInstance.closeAll(), [stackInstance])
  const remove = useCallback((id: string) => stackInstance.remove(id), [stackInstance])

  /**
   * Bounded prefetch cache keyed by href+method+data.
   */
  const cacheRef = useRef(new PrefetchCache())

  const prefetch = useCallback(
    async (href: string, options: PrefetchOptions = {}) => {
      if (href.startsWith('#')) {
        return
      }
      const key = PrefetchCache.key(href, options.method, options.data)
      if (cacheRef.current.has(key)) {
        return
      }
      const current = pageRef.current
      const payload = await requestModal(client, {
        href,
        method: options.method,
        data: options.data,
        headers: options.headers,
        currentComponent: current.component,
        version: current.version,
        redirectUrl: current.url,
      })
      cacheRef.current.set(key, payload, options.cacheFor)
    },
    [client]
  )

  const visit = useCallback(
    async (href: string, options: VisitOptions = {}): Promise<ModalEntry> => {
      /**
       * Local modal: `href` like `#confirm`. No server request; the content is
       * defined inline via <Modal name="confirm">.
       */
      if (href.startsWith('#')) {
        const entry = stackInstance.push(
          { component: '', props: options.props ?? {}, key: generateId() },
          {
            name: href.slice(1),
            local: true,
            config: options.config,
            onClose: options.onClose,
            onAfterLeave: options.onAfterLeave,
          }
        )
        if (options.listeners) {
          for (const [event, callback] of Object.entries(options.listeners)) {
            entry.emitter.on(event, callback)
          }
        }
        options.onSuccess?.()
        return entry
      }

      options.onStart?.()
      try {
        const current = pageRef.current
        // Serve from the prefetch cache when available (and unexpired).
        const key = PrefetchCache.key(href, options.method, options.data)
        const payload =
          cacheRef.current.get(key) ??
          (await requestModal(client, {
            href,
            method: options.method,
            data: options.data,
            headers: options.headers,
            currentComponent: current.component,
            version: current.version,
            redirectUrl: current.url,
          }))

        const entry = stackInstance.push(payload, {
          url: href,
          config: options.config,
          onClose: options.onClose,
          onAfterLeave: options.onAfterLeave,
        })

        if (options.listeners) {
          for (const [event, callback] of Object.entries(options.listeners)) {
            entry.emitter.on(event, callback)
          }
        }

        if (options.history) {
          modalHistory.push(entry.id)
        }

        options.onSuccess?.()
        return entry
      } catch (error) {
        // Redirect / version mismatch: navigate instead of treating it as an error.
        if (error instanceof ModalLocationError) {
          if (error.hard && typeof window !== 'undefined') {
            window.location.href = error.location
          } else {
            doNavigate(error.location)
          }
          throw error
        }
        // Default behavior: log so a failed open (404, non-modal response) isn't
        // silent. Pass onError to override (e.g. a toast).
        if (options.onError) {
          options.onError(error)
        } else {
          console.error('[adonis-inertia-modal] Failed to open modal (pass onError to handle):', error)
        }
        throw error
      }
    },
    [client, stackInstance, modalHistory]
  )

  const reload = useCallback(
    async (id: string, options: ReloadOptions = {}): Promise<void> => {
      const entry = stackInstance.get(id)
      if (!entry?.url) {
        return
      }
      options.onStart?.()
      try {
        const current = pageRef.current
        // Map requested modal prop names to `modal.props.*` so the server only
        // computes those (needed for deferred/optional props). Without `only`,
        // refetch the whole modal.
        const only = options.only
          ? ['modal', ...options.only.map((key) => `modal.props.${key}`)]
          : ['modal']

        const payload = await requestModal(client, {
          href: entry.url,
          data: options.data,
          headers: options.headers,
          currentComponent: current.component,
          version: current.version,
          only,
        })

        let props = payload.props
        if (options.except) {
          const except = new Set(options.except)
          props = Object.fromEntries(Object.entries(props).filter(([key]) => !except.has(key)))
        }

        stackInstance.updateProps(id, props)
        options.onSuccess?.()
      } catch (error) {
        options.onError?.(error)
        throw error
      } finally {
        options.onFinish?.()
      }
    },
    [client, stackInstance]
  )

  /**
   * Deep-link / direct-access: a modal present in the page props (server sent
   * `props.modal` on a full page load) is pushed onto the stack. Closing it
   * navigates back to its redirect URL so the browser URL stays clean.
   */
  const pageModal = page.props?.modal as ModalResponsePayload | undefined
  useEffect(() => {
    /**
     * A real navigation (URL change) closes any open modals. This handles e.g.
     * a successful form submit that redirects to a page without a modal. Cleared
     * silently (no onClose) since we're already on the new page.
     */
    const navigated = prevUrlRef.current !== undefined && prevUrlRef.current !== page.url
    prevUrlRef.current = page.url
    if (navigated) {
      stackInstance.reset()
    }

    if (!pageModal || !pageModal.key || stackInstance.get(pageModal.key)) {
      return
    }

    /**
     * If the top modal is the same one re-rendered (same component + backdrop) —
     * e.g. a validation redirect-back re-rendered the modal route with a fresh
     * key — update it in place instead of stacking a duplicate. This keeps the
     * modal mounted (form state preserved) and surfaces the new `errors`.
     */
    const top = stackInstance.top
    if (top && top.component === pageModal.component && top.baseUrl === pageModal.baseUrl) {
      stackInstance.updateProps(top.id, pageModal.props)
      return
    }

    stackInstance.push(pageModal, {
      url: pageRef.current.url,
      onClose: () => {
        if (pageModal.redirectUrl) {
          doNavigate(pageModal.redirectUrl)
        }
      },
    })
  }, [page.url, pageModal, stackInstance, doNavigate])

  const value: ModalStackContextValue = {
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
    navigate: doNavigate,
    syncPage,
  }

  return <ModalStackContext.Provider value={value}>{children}</ModalStackContext.Provider>
}
