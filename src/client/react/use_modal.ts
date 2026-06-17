/*
 * adonis-modal — React client
 */

import type { ModalEntry, ModalOptions } from '../core/types.ts'
import { useModalIndex, useModalStack, type ModalStackContextValue } from './context.ts'
import type { ReloadOptions } from './types.ts'

export interface UseModalReturn {
  id: string
  props: Record<string, unknown>
  /** Validation errors shared by the server (Inertia `errors` prop). */
  errors: Record<string, string>
  /** Per-modal presentation config (slideover, position, ...). */
  config: ModalOptions
  isOpen: boolean
  index: number
  onTopOfStack: boolean
  close: () => void
  reload: (options?: ReloadOptions) => Promise<void>
  emit: (event: string, ...args: unknown[]) => void
  on: (event: string, callback: (...args: unknown[]) => void) => () => void
}

/**
 * Build the public modal instance from a stack entry + the stack context.
 */
function createModalInstance(entry: ModalEntry, ctx: ModalStackContextValue): UseModalReturn {
  return {
    id: entry.id,
    props: entry.props,
    errors: (ctx.page.props?.errors as Record<string, string>) ?? {},
    config: entry.config,
    isOpen: entry.isOpen,
    index: entry.index,
    onTopOfStack: entry.onTopOfStack,
    close: () => ctx.close(entry.id),
    reload: (options) => ctx.reload(entry.id, options),
    emit: (event, ...args) => entry.emitter.emit(event, ...args),
    on: (event, callback) => entry.emitter.on(event, callback),
  }
}

/**
 * Access the modal instance for the component currently being rendered inside a
 * modal. Returns null when not inside a modal.
 */
export default function useModal(): UseModalReturn | null {
  const ctx = useModalStack()
  const index = useModalIndex()
  const entry = ctx.stack[index]
  return entry ? createModalInstance(entry, ctx) : null
}

/**
 * Resolve the modal instance for either a server modal (current render context)
 * or a local modal addressed by `name`. Returns null when none is open. Shared
 * by <Modal> and <HeadlessModal>.
 */
export function useResolvedModal(name?: string): UseModalReturn | null {
  const ctx = useModalStack()
  const index = useModalIndex()

  if (name) {
    const local = ctx.stack.find((item) => item.name === name && item.local && item.isOpen)
    return local ? createModalInstance(local, ctx) : null
  }

  const entry = ctx.stack[index]
  return entry && entry.isOpen ? createModalInstance(entry, ctx) : null
}
