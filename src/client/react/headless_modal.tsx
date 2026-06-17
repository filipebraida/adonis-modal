/*
 * adonis-inertia-modal — React client
 */

import type { ReactNode } from 'react'

import { useResolvedModal, type UseModalReturn } from './use_modal.ts'

export interface HeadlessModalProps {
  /** Render-prop receiving the modal instance; you supply the entire UI. */
  children: (modal: UseModalReturn) => ReactNode
  /** When set, binds to a local (client-only) modal opened via href="#name". */
  name?: string
}

/**
 * Like <Modal>, but renders no UI of its own. You get the modal instance
 * (props, close, reload, emit, config, ...) and build the dialog, backdrop,
 * transitions and accessibility yourself. Renders nothing when no modal is open.
 */
export function HeadlessModal({ children, name }: HeadlessModalProps) {
  const modal = useResolvedModal(name)

  if (!modal) {
    return null
  }

  return <>{children(modal)}</>
}

export default HeadlessModal
