/*
 * adonis-inertia-modal — React client entrypoint
 */

export { ModalStackProvider, type ModalStackProviderProps } from './ModalStackProvider.tsx'
export { ModalRoot } from './ModalRoot.tsx'
export { ModalRenderer } from './ModalRenderer.tsx'
export { Modal, type ModalProps } from './Modal.tsx'
export { ModalLink, type ModalLinkProps } from './ModalLink.tsx'
export { Deferred, type DeferredProps } from './Deferred.tsx'
export { WhenVisible, type WhenVisibleProps } from './WhenVisible.tsx'
export { HeadlessModal, type HeadlessModalProps } from './HeadlessModal.tsx'
export { useResolvedModal } from './use_modal.ts'
export { default as useModal, type UseModalReturn } from './use_modal.ts'
export { useModalStack, useModalIndex, type ModalStackContextValue } from './context.ts'
export type {
  PageInfo,
  VisitOptions,
  ReloadOptions,
  PrefetchOption,
  PrefetchMode,
  PrefetchOptions,
} from './types.ts'

export {
  putConfig,
  getConfig,
  resetConfig,
  type ModalConfig,
  type ModalTypeConfig,
} from '../core/config.ts'
export type { ModalEntry, ModalResponsePayload, ModalOptions, HttpMethod } from '../core/types.ts'
