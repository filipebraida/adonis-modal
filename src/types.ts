/*
 * adonis-inertia-modal
 *
 * Backend-driven modals for Inertia.js on AdonisJS.
 */

/**
 * Props passed to a modal component. Values may be plain data or zero-arg
 * functions (sync or async) that are resolved lazily when the payload is built.
 *
 * Keys may use dot-notation (e.g. `'stats.today'`) which is unpacked into a
 * nested object so partial reloads of `modal.props.*` work — the AdonisJS
 * Inertia adapter does not yet resolve nested/dot-notation props natively
 * (see docs/design/inertia-v3-compat.md).
 */
export type ModalProps = Record<string, unknown>

/**
 * The serialized modal envelope sent to the client as the shared `modal` prop.
 */
export interface ModalPayload {
  /** Component to render inside the modal (e.g. `users/show`). */
  component: string
  /** URL of the backdrop page, used when the modal is opened directly. */
  baseUrl: string
  /** Where to navigate when the modal closes. */
  redirectUrl: string
  /** Resolved (dot-notation unpacked) props for the modal component. */
  props: Record<string, unknown>
  /** Unique-per-instance key (preserved across sparse reloads / validation). */
  key: string
  /** Deferred prop names by group, for the client's <Deferred> component. */
  deferred?: Record<string, string[]>
  /** Modal prop names to shallow-merge on the client. */
  mergeProps?: string[]
  /** Modal prop names to deep-merge on the client. */
  deepMergeProps?: string[]
}
