/*
 * adonis-inertia-modal — React client
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ElementType,
  type MouseEvent,
  type ReactNode,
} from 'react'

import { getConfig } from '../core/config.ts'
import type { HttpMethod, ModalOptions } from '../core/types.ts'
import { useModalStack } from './context.ts'
import type { PrefetchMode, PrefetchOption } from './types.ts'

export interface ModalLinkProps {
  href: string
  method?: HttpMethod
  data?: Record<string, unknown>
  headers?: Record<string, string>
  as?: ElementType
  /** Per-modal presentation overrides (maxWidth, position, panelClasses, ...). */
  config?: ModalOptions
  /** Open as a slideover instead of a centered modal. */
  slideover?: boolean
  /** Prefetch the modal on hover/click/mount (true = hover). */
  prefetch?: PrefetchOption
  /** Prefetch cache lifetime in ms (default 30000). */
  cacheFor?: number
  /** Push a browser-history entry so the Back button closes this modal. */
  history?: boolean
  /** Navigate to the route as a full page instead of opening a modal (responsive opt-out). */
  navigate?: boolean
  onStart?: () => void
  onSuccess?: () => void
  onError?: (error: unknown) => void
  onClose?: () => void
  onAfterLeave?: () => void
  onPrefetching?: () => void
  onPrefetched?: () => void
  children: ReactNode | ((state: { loading: boolean }) => ReactNode)
  [key: string]: unknown
}

/**
 * Opens a route in a modal. Like Inertia's <Link>, but the response is rendered
 * as a stacked modal over the current page.
 *
 * Any extra `on<Event>` function props (other than the lifecycle callbacks
 * above) are registered as event-bus listeners on the opened modal.
 */
export function ModalLink({
  href,
  method = 'get',
  data,
  headers,
  as: Component = 'a',
  config,
  slideover,
  prefetch = false,
  cacheFor = 30000,
  history,
  navigate,
  onStart,
  onSuccess,
  onError,
  onClose,
  onAfterLeave,
  onPrefetching,
  onPrefetched,
  children,
  ...rest
}: ModalLinkProps) {
  const { visit, prefetch: prefetchModal, navigate: doNavigate } = useModalStack()
  const [loading, setLoading] = useState(false)
  const hoverTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const prefetchModes = useMemo<PrefetchMode[]>(() => {
    if (prefetch === true) return ['hover']
    if (prefetch === false) return []
    return Array.isArray(prefetch) ? prefetch : [prefetch]
  }, [prefetch])

  const doPrefetch = useCallback(() => {
    onPrefetching?.()
    prefetchModal(href, { method, data, headers, cacheFor })
      .then(() => onPrefetched?.())
      .catch(() => {})
  }, [prefetchModal, href, method, data, headers, cacheFor, onPrefetching, onPrefetched])

  useEffect(() => {
    if (prefetchModes.includes('mount')) {
      doPrefetch()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    return () => {
      if (hoverTimeout.current) clearTimeout(hoverTimeout.current)
    }
  }, [])

  const domProps: Record<string, unknown> = {}
  const listeners: Record<string, (...args: unknown[]) => void> = {}
  for (const [key, value] of Object.entries(rest)) {
    if (key.startsWith('on') && typeof value === 'function') {
      const event = key.charAt(2).toLowerCase() + key.slice(3)
      listeners[event] = value as (...args: unknown[]) => void
    } else {
      domProps[key] = value
    }
  }

  // The event-bus listeners and lifecycle callbacks can change between renders
  // (and `listeners` is a fresh object each render). Read them from a ref so the
  // memoized `handle` always uses the latest, never a stale first-render closure.
  const latest = useRef({ listeners, onStart, onSuccess, onError, onClose, onAfterLeave })
  latest.current = { listeners, onStart, onSuccess, onError, onClose, onAfterLeave }

  const handle = useCallback(
    async (event?: MouseEvent) => {
      event?.preventDefault()
      if (loading) {
        return
      }
      // `navigate` mode: open the route as a full page instead of a modal.
      const navigateMode = navigate ?? (getConfig('navigate') as boolean | undefined) ?? false
      if (navigateMode && !href.startsWith('#')) {
        doNavigate(href)
        return
      }
      setLoading(true)
      const callbacks = latest.current
      try {
        await visit(href, {
          method,
          data,
          headers,
          config: { ...config, ...(slideover !== undefined ? { slideover } : {}) },
          history,
          onStart: callbacks.onStart,
          onSuccess: callbacks.onSuccess,
          onError: callbacks.onError,
          onClose: callbacks.onClose,
          onAfterLeave: callbacks.onAfterLeave,
          listeners: callbacks.listeners,
        })
      } catch {
        // onError already invoked inside visit()
      } finally {
        setLoading(false)
      }
    },
    [href, method, data, headers, config, slideover, history, navigate, loading, visit, doNavigate]
  )

  const handleMouseEnter = useCallback(() => {
    if (!prefetchModes.includes('hover')) return
    hoverTimeout.current = setTimeout(doPrefetch, 75)
  }, [prefetchModes, doPrefetch])

  const handleMouseLeave = useCallback(() => {
    if (hoverTimeout.current) {
      clearTimeout(hoverTimeout.current)
      hoverTimeout.current = null
    }
  }, [])

  const handleMouseDown = useCallback(() => {
    if (prefetchModes.includes('click')) doPrefetch()
  }, [prefetchModes, doPrefetch])

  return (
    <Component
      {...domProps}
      href={href}
      onClick={handle}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onMouseDown={handleMouseDown}
    >
      {typeof children === 'function' ? children({ loading }) : children}
    </Component>
  )
}
