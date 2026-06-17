/*
 * adonis-modal — React client
 */

import { createContext, useContext, type ComponentType } from 'react'

import type { ModalEntry } from '../core/types.ts'
import type { PageInfo, ReloadOptions, VisitOptions } from './types.ts'

export interface ModalStackContextValue {
  stack: ModalEntry[]
  page: PageInfo
  resolve: (name: string) => Promise<ComponentType>
  visit: (href: string, options?: VisitOptions) => Promise<ModalEntry>
  /** Programmatic alias of visit() for opening a modal from code. */
  visitModal: (href: string, options?: VisitOptions) => Promise<ModalEntry>
  close: (id: string) => void
  reload: (id: string, options?: ReloadOptions) => Promise<void>
}

export const ModalStackContext = createContext<ModalStackContextValue | null>(null)

export function useModalStack(): ModalStackContextValue {
  const context = useContext(ModalStackContext)
  if (!context) {
    throw new Error('adonis-modal: useModalStack() must be used within <ModalStackProvider>.')
  }
  return context
}

/**
 * The index of the modal currently being rendered (set by ModalRenderer), so
 * useModal() can locate its entry in the stack.
 */
export const ModalIndexContext = createContext<number>(-1)

export function useModalIndex(): number {
  return useContext(ModalIndexContext)
}
