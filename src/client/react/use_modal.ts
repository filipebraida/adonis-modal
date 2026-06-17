/*
 * adonis-modal — React client
 */

import { useModalIndex, useModalStack } from './context.ts'
import type { ReloadOptions } from './types.ts'

export interface UseModalReturn {
  id: string
  props: Record<string, unknown>
  isOpen: boolean
  index: number
  onTopOfStack: boolean
  close: () => void
  reload: (options?: ReloadOptions) => Promise<void>
  emit: (event: string, ...args: unknown[]) => void
  on: (event: string, callback: (...args: unknown[]) => void) => () => void
}

/**
 * Access the modal instance for the component currently being rendered inside a
 * modal. Returns null when not inside a modal.
 */
export default function useModal(): UseModalReturn | null {
  const { stack, close, reload } = useModalStack()
  const index = useModalIndex()
  const entry = stack[index]

  if (!entry) {
    return null
  }

  return {
    id: entry.id,
    props: entry.props,
    isOpen: entry.isOpen,
    index: entry.index,
    onTopOfStack: entry.onTopOfStack,
    close: () => close(entry.id),
    reload: (options) => reload(entry.id, options),
    emit: (event, ...args) => entry.emitter.emit(event, ...args),
    on: (event, callback) => entry.emitter.on(event, callback),
  }
}
