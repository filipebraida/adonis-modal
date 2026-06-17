/*
 * adonis-modal — React client
 */

import { useCallback, useState, type ElementType, type MouseEvent, type ReactNode } from 'react'

import type { HttpMethod, ModalOptions } from '../core/types.ts'
import { useModalStack } from './context.ts'

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
  onStart?: () => void
  onSuccess?: () => void
  onError?: (error: unknown) => void
  onClose?: () => void
  onAfterLeave?: () => void
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
  onStart,
  onSuccess,
  onError,
  onClose,
  onAfterLeave,
  children,
  ...rest
}: ModalLinkProps) {
  const { visit } = useModalStack()
  const [loading, setLoading] = useState(false)

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

  const handle = useCallback(
    async (event?: MouseEvent) => {
      event?.preventDefault()
      if (loading) {
        return
      }
      setLoading(true)
      try {
        await visit(href, {
          method,
          data,
          headers,
          config: { ...config, ...(slideover !== undefined ? { slideover } : {}) },
          onStart,
          onSuccess,
          onError,
          onClose,
          onAfterLeave,
          listeners,
        })
      } catch {
        // onError already invoked inside visit()
      } finally {
        setLoading(false)
      }
    },
    [href, method, data, headers, config, slideover, loading, visit]
  )

  return (
    <Component {...domProps} href={href} onClick={handle}>
      {typeof children === 'function' ? children({ loading }) : children}
    </Component>
  )
}
