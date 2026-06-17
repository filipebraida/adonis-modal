/*
 * adonis-modal — framework-agnostic core
 */

import type { EventEmitter } from './event_emitter.ts'

/**
 * The modal envelope as delivered by the server in `page.props.modal`
 * (mirrors the server-side ModalPayload).
 */
export interface ModalResponsePayload {
  component: string
  props: Record<string, unknown>
  baseUrl?: string
  redirectUrl?: string
  key?: string
}

export type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete'

/**
 * Per-modal presentation overrides (subset of ModalTypeConfig + slideover flag).
 */
export type ModalOptions = Record<string, unknown> & { slideover?: boolean }

/**
 * An entry in the modal stack. Framework-agnostic: holds the component *name*;
 * the framework layer (React/Vue) resolves it to an actual component.
 */
export interface ModalEntry {
  id: string
  name?: string
  component: string
  props: Record<string, unknown>
  /** The URL this modal was requested from (used to reload its props). */
  url?: string
  baseUrl?: string
  redirectUrl?: string
  config: ModalOptions
  isOpen: boolean
  index: number
  onTopOfStack: boolean
  emitter: EventEmitter
  onClose?: () => void
  onAfterLeave?: () => void
}

export interface PushOptions {
  name?: string
  url?: string
  config?: ModalOptions
  onClose?: () => void
  onAfterLeave?: () => void
}
