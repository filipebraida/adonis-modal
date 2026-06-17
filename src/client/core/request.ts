/*
 * adonis-inertia-modal — framework-agnostic core
 *
 * Builds the raw HTTP request used to open/reload a modal. We bypass Inertia's
 * page-swap and issue a controlled partial request (only the `modal` prop) so
 * the server hits the "via link" path and the backdrop page is preserved.
 * Mirrors inertiaui/modal's ModalRoot.reload mechanics.
 */

import type { HttpMethod, ModalResponsePayload } from './types.ts'

export const MODAL_HEADERS = {
  modal: 'X-Inertia-Modal',
  key: 'X-Inertia-Modal-Key',
  redirect: 'X-Inertia-Modal-Redirect',
} as const

export interface BuildModalRequestParams {
  href: string
  method?: HttpMethod
  data?: Record<string, unknown>
  headers?: Record<string, string>
  /** Component currently on screen (becomes the partial component). */
  currentComponent: string
  /** Asset version, echoed back so Inertia can detect a mismatch. */
  version?: string
  /** Props to request; defaults to only the `modal` prop. */
  only?: string[]
  modalKey?: string
  redirectUrl?: string
  /** How array values are serialized into the GET query string. */
  queryStringArrayFormat?: 'brackets' | 'indices'
}

export interface ModalRequest {
  url: string
  method: HttpMethod
  data: Record<string, unknown> | undefined
  params: Record<string, unknown> | undefined
  headers: Record<string, string>
  queryStringArrayFormat?: 'brackets' | 'indices'
}

/**
 * Build the request descriptor for opening or reloading a modal.
 */
export function buildModalRequest(params: BuildModalRequestParams): ModalRequest {
  const method = (params.method ?? 'get').toLowerCase() as HttpMethod
  const only = params.only ?? ['modal']
  const data = params.data ?? {}

  const headers: Record<string, string> = {
    ...params.headers,
    'Accept': 'text/html, application/xhtml+xml',
    'X-Requested-With': 'XMLHttpRequest',
    'X-Inertia': 'true',
    'X-Inertia-Partial-Component': params.currentComponent,
    'X-Inertia-Partial-Data': only.join(','),
  }

  if (params.version) {
    headers['X-Inertia-Version'] = params.version
  }
  if (params.modalKey) {
    headers[MODAL_HEADERS.key] = params.modalKey
  }
  if (params.redirectUrl) {
    headers[MODAL_HEADERS.redirect] = params.redirectUrl
  }

  return {
    url: params.href,
    method,
    data: method === 'get' ? undefined : data,
    params: method === 'get' ? data : undefined,
    headers,
    queryStringArrayFormat: params.queryStringArrayFormat,
  }
}

/**
 * Extract the modal payload from an Inertia page response (`props.modal`).
 * Accepts either an already-parsed page object or its JSON string.
 */
export function parseModalPayload(responseData: unknown): ModalResponsePayload | null {
  let page = responseData
  if (typeof page === 'string') {
    try {
      page = JSON.parse(page)
    } catch {
      return null
    }
  }

  const props = (page as { props?: Record<string, unknown> })?.props
  const modal = props?.modal as ModalResponsePayload | undefined

  if (!modal || typeof modal.component !== 'string') {
    return null
  }
  return modal
}
