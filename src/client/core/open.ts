/*
 * adonis-inertia-modal — framework-agnostic core
 *
 * Orchestrates the network side of opening/reloading a modal: issue the
 * controlled partial request and extract the modal payload. The HTTP client is
 * injected (Inertia's axios in the app, a fake in tests).
 */

import { buildModalRequest, parseModalPayload, type BuildModalRequestParams } from './request.ts'
import type { ModalResponsePayload } from './types.ts'

export interface HttpResponseLike {
  data: unknown
  status?: number
  /** Response headers, lowercased keys (e.g. `x-inertia-location`). */
  headers?: Record<string, string>
  /** Whether the request followed one or more redirects (fetch `Response.redirected`). */
  redirected?: boolean
  /** Final URL after redirects (fetch `Response.url`). */
  url?: string
}

export interface HttpClientLike {
  request(config: {
    url: string
    method: string
    data: Record<string, unknown> | undefined
    params: Record<string, unknown> | undefined
    headers: Record<string, string>
  }): Promise<HttpResponseLike>
}

/**
 * Thrown when the modal request resolved to a navigation rather than a modal:
 * an Inertia version mismatch (409 + `X-Inertia-Location`, `hard` = full reload)
 * or a redirect such as an expired-session bounce to /login (`hard` = false, a
 * normal Inertia visit). The caller performs the navigation.
 */
export class ModalLocationError extends Error {
  constructor(
    public readonly location: string,
    public readonly hard: boolean
  ) {
    super(`adonis-inertia-modal: modal request resolved to a navigation → ${location}`)
    this.name = 'ModalLocationError'
  }
}

/**
 * Request a modal from the server and return its payload (`props.modal`).
 * Throws `ModalLocationError` when the response is a redirect / version mismatch
 * (so the caller can navigate), or a generic Error when it simply isn't a modal.
 */
export async function requestModal(
  client: HttpClientLike,
  params: BuildModalRequestParams
): Promise<ModalResponsePayload> {
  const response = await client.request(buildModalRequest(params))
  const payload = parseModalPayload(response.data)

  if (payload) {
    return payload
  }

  // Inertia version mismatch → 409 with X-Inertia-Location → full reload for fresh assets.
  const headers = response.headers ?? {}
  const location = headers['x-inertia-location'] ?? headers['X-Inertia-Location']
  if (location) {
    throw new ModalLocationError(location, true)
  }

  // A followed redirect (e.g. an expired session bounced to /login) → visit there.
  if (response.redirected && response.url) {
    throw new ModalLocationError(response.url, false)
  }

  throw new Error(
    'adonis-inertia-modal: the response did not contain a modal payload. This usually means the ' +
      'server returned a redirect (e.g. an expired session) or the route does not return ' +
      'inertia.modal(...).'
  )
}
