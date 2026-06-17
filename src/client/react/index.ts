/*
 * adonis-inertia-modal — React client entrypoint
 */

export { ModalStackProvider, type ModalStackProviderProps } from './modal_stack_provider.tsx'
export { ModalRoot } from './modal_root.tsx'
export { ModalRenderer } from './modal_renderer.tsx'
export { Modal, type ModalProps } from './modal.tsx'
export { ModalLink, type ModalLinkProps } from './modal_link.tsx'
export { Deferred, type DeferredProps } from './deferred.tsx'
export { WhenVisible, type WhenVisibleProps } from './when_visible.tsx'
export { HeadlessModal, type HeadlessModalProps } from './headless_modal.tsx'
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
