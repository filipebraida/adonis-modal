/*
 * adonis-modal — React client
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
  type ComponentType,
  type ReactNode,
} from 'react'
import { router as inertiaRouter, usePage as inertiaUsePage } from '@inertiajs/react'

import { createFetchClient } from '../core/fetch_client.ts'
import { requestModal, type HttpClientLike } from '../core/open.ts'
import { ModalStack } from '../core/stack.ts'
import type { ModalEntry, ModalResponsePayload } from '../core/types.ts'
import { ModalStackContext, type ModalStackContextValue } from './context.ts'
import type { PageInfo, ReloadOptions, VisitOptions } from './types.ts'

export interface ModalStackProviderProps {
  children: ReactNode
  /** HTTP client used to fetch modals. Defaults to a fetch-based client. */
  httpClient?: HttpClientLike
  /** Resolves a component name to a component. Defaults to Inertia's resolver. */
  resolveComponent?: (name: string) => Promise<ComponentType>
  /** Reads the current Inertia page. Defaults to Inertia's usePage(). */
  usePageHook?: () => PageInfo
  /** Navigates the browser (used when closing a deep-linked modal). */
  navigate?: (url: string) => void
}

export function ModalStackProvider({
  children,
  httpClient,
  resolveComponent,
  usePageHook,
  navigate,
}: ModalStackProviderProps) {
  const stackRef = useRef<ModalStack | null>(null)
  if (!stackRef.current) {
    stackRef.current = new ModalStack()
  }
  const stackInstance = stackRef.current

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

  const page = (usePageHook ?? (inertiaUsePage as unknown as () => PageInfo))()
  const pageRef = useRef(page)
  pageRef.current = page

  const close = useCallback(
    (id: string) => {
      stackInstance.close(id)
      stackInstance.remove(id)
    },
    [stackInstance]
  )

  const visit = useCallback(
    async (href: string, options: VisitOptions = {}): Promise<ModalEntry> => {
      options.onStart?.()
      try {
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

        options.onSuccess?.()
        return entry
      } catch (error) {
        options.onError?.(error)
        throw error
      }
    },
    [client, stackInstance]
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
        const payload = await requestModal(client, {
          href: entry.url,
          data: options.data,
          headers: options.headers,
          currentComponent: current.component,
          version: current.version,
          only: options.only ?? ['modal'],
        })
        stackInstance.updateProps(id, payload.props)
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
    if (!pageModal || !pageModal.key || stackInstance.get(pageModal.key)) {
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
  }, [pageModal, stackInstance, doNavigate])

  const value: ModalStackContextValue = {
    stack,
    page,
    resolve,
    visit,
    close,
    reload,
  }

  return <ModalStackContext.Provider value={value}>{children}</ModalStackContext.Provider>
}
