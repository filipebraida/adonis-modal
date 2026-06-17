/*
 * adonis-inertia-modal
 *
 * Backend-driven modals for Inertia.js on AdonisJS.
 */

/**
 * Headers used by adonis-inertia-modal on top of the standard Inertia protocol.
 *
 * The modal "rides along" as a shared `modal` prop on a regular Inertia page,
 * so we reuse Inertia's own headers (`x-inertia`, `x-inertia-partial-*`) and
 * only add a few modal-specific ones.
 */
export const ModalHeaders = {
  /**
   * Response header marking the payload as a modal response, so the client
   * plugin knows to stack the modal instead of replacing the current page.
   */
  Modal: 'x-inertia-modal',

  /**
   * Request/response header carrying the modal instance key. Reused across
   * sparse reloads (`modal.props.*`) and validation errors so the mounted
   * modal is not remounted.
   */
  Key: 'x-inertia-modal-key',

  /**
   * Request header telling the server where to navigate when the modal closes.
   * Takes precedence over the referer and the configured base URL.
   */
  Redirect: 'x-inertia-modal-redirect',
} as const

export type ModalHeader = (typeof ModalHeaders)[keyof typeof ModalHeaders]
