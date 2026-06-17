/*
 * adonis-inertia-modal — React client
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
  /** The modal directly below this one in the stack, or null. */
  getParentModal: () => UseModalReturn | null
  /** The modal directly above this one in the stack, or null. */
  getChildModal: () => UseModalReturn | null
}

/** Stable empty-errors reference so consumers keying effects on `errors` don't churn. */
const EMPTY_ERRORS: Record<string, string> = {}

/**
 * Build the public modal instance from a stack entry + the stack context.
 */
function createModalInstance(entry: ModalEntry, ctx: ModalStackContextValue): UseModalReturn {
  return {
    id: entry.id,
    props: entry.props,
    errors: (ctx.page.props?.errors as Record<string, string>) ?? EMPTY_ERRORS,
    config: entry.config,
    isOpen: entry.isOpen,
    index: entry.index,
    onTopOfStack: entry.onTopOfStack,
    close: () => ctx.close(entry.id),
    reload: (options) => ctx.reload(entry.id, options),
    emit: (event, ...args) => entry.emitter.emit(event, ...args),
    on: (event, callback) => entry.emitter.on(event, callback),
    getParentModal: () => {
      const parent = ctx.stack[entry.index - 1]
      return parent ? createModalInstance(parent, ctx) : null
    },
    getChildModal: () => {
      const child = ctx.stack[entry.index + 1]
      return child ? createModalInstance(child, ctx) : null
    },
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

  // Resolve while the entry EXISTS (not only while isOpen): the <Modal> must
  // stay mounted through its leave transition so it can drive removal.
  if (name) {
    const local = ctx.stack.find((item) => item.name === name && item.local)
    return local ? createModalInstance(local, ctx) : null
  }

  const entry = ctx.stack[index]
  return entry ? createModalInstance(entry, ctx) : null
}
