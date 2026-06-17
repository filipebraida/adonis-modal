/*
 * adonis-modal — React client
 */

import type { ReactNode } from 'react'

import useModal, { type UseModalReturn } from './use_modal.ts'

export interface ModalProps {
  children: ReactNode | ((modal: UseModalReturn) => ReactNode)
  onClose?: () => void
  closeButton?: boolean
}

/**
 * Wraps a page's content so it renders as a modal. Reads the current modal
 * instance from context; renders nothing when not inside a modal or when closed.
 *
 * Note: this is a minimal overlay for the MVP. Native <dialog>, focus trapping,
 * sizes/positions and slideovers come in later phases.
 */
export function Modal({ children, onClose, closeButton = true }: ModalProps) {
  const modal = useModal()

  if (!modal || !modal.isOpen) {
    return null
  }

  const handleClose = () => {
    onClose?.()
    modal.close()
  }

  return (
    <div className="im-backdrop" data-modal-id={modal.id} onClick={handleClose}>
      <div
        className="im-panel"
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        {closeButton && (
          <button
            type="button"
            className="im-close-button"
            aria-label="Close"
            onClick={handleClose}
          >
            &times;
          </button>
        )}
        {typeof children === 'function' ? children(modal) : children}
      </div>
    </div>
  )
}
