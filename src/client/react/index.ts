/*
 * adonis-modal — React client entrypoint
 */

export { ModalStackProvider, type ModalStackProviderProps } from './ModalStackProvider.tsx'
export { ModalRoot } from './ModalRoot.tsx'
export { ModalRenderer } from './ModalRenderer.tsx'
export { Modal, type ModalProps } from './Modal.tsx'
export { ModalLink, type ModalLinkProps } from './ModalLink.tsx'
export { default as useModal, type UseModalReturn } from './use_modal.ts'
export { useModalStack, useModalIndex, type ModalStackContextValue } from './context.ts'
export type { PageInfo, VisitOptions, ReloadOptions } from './types.ts'

export {
  putConfig,
  getConfig,
  resetConfig,
  type ModalConfig,
  type ModalTypeConfig,
} from '../core/config.ts'
export type { ModalEntry, ModalResponsePayload, ModalOptions, HttpMethod } from '../core/types.ts'
