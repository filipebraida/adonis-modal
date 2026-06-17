/*
 * adonis-modal — React client
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
