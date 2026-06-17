/*
 * adonis-inertia-modal — Vue client entrypoint
 */

export { modal, createModalContext, type ModalPluginOptions } from './plugin.ts'
export { ModalRoot } from './modal_root.ts'
export { ModalRenderer } from './modal_renderer.ts'
export { Modal } from './modal.ts'
export { ModalLink } from './modal_link.ts'
export { Deferred } from './deferred.ts'
export { WhenVisible } from './when_visible.ts'
export { HeadlessModal } from './headless_modal.ts'
export { useResolvedModal } from './use_modal.ts'
export { default as useModal, type UseModalReturn } from './use_modal.ts'
export {
  useModalStack,
  useModalIndex,
  modalStackKey,
  modalIndexKey,
  type ModalContext,
} from './context.ts'
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
