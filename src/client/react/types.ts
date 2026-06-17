/*
 * adonis-inertia-modal — React client
 */

import type { HttpMethod, ModalOptions } from '../core/types.ts'

/**
 * Minimal slice of the Inertia page object the modal layer needs.
 */
export interface PageInfo {
  component: string
  url: string
  version?: string
  props: Record<string, unknown>
}

export interface VisitOptions {
  method?: HttpMethod
  data?: Record<string, unknown>
  headers?: Record<string, string>
  config?: ModalOptions
  onStart?: () => void
  onSuccess?: () => void
  onError?: (error: unknown) => void
  onClose?: () => void
  onAfterLeave?: () => void
  listeners?: Record<string, (...args: unknown[]) => void>
  /** Props for a local modal (href starting with `#`). */
  props?: Record<string, unknown>
  /** Push a browser-history entry so the Back button closes this modal. */
  history?: boolean
  /** How array values are serialized into the GET query string (default 'brackets'). */
  queryStringArrayFormat?: 'brackets' | 'indices'
}

export interface ReloadOptions {
  only?: string[]
  except?: string[]
  data?: Record<string, unknown>
  headers?: Record<string, string>
  onStart?: () => void
  onSuccess?: () => void
  onError?: (error: unknown) => void
  onFinish?: () => void
}

export type PrefetchMode = 'hover' | 'click' | 'mount'
export type PrefetchOption = boolean | PrefetchMode | PrefetchMode[]

export interface PrefetchOptions {
  method?: HttpMethod
  data?: Record<string, unknown>
  headers?: Record<string, string>
  /** Cache lifetime in ms (default 30000). */
  cacheFor?: number
}
