/*
 * adonis-inertia-modal — framework-agnostic core
 *
 * Orchestrates the network side of opening/reloading a modal: issue the
 * controlled partial request and extract the modal payload. The HTTP client is
 * injected (Inertia's axios in the app, a fake in tests).
 */

import { buildModalRequest, parseModalPayload, type BuildModalRequestParams } from './request.ts'
import type { ModalResponsePayload } from './types.ts'

export interface HttpClientLike {
  request(config: {
    url: string
    method: string
    data: Record<string, unknown> | undefined
    params: Record<string, unknown> | undefined
    headers: Record<string, string>
  }): Promise<{ data: unknown }>
}

/**
 * Request a modal from the server and return its payload (`props.modal`).
 * Throws when the response carries no modal payload (e.g. an auth redirect).
 */
export async function requestModal(
  client: HttpClientLike,
  params: BuildModalRequestParams
): Promise<ModalResponsePayload> {
  const response = await client.request(buildModalRequest(params))
  const payload = parseModalPayload(response.data)

  if (!payload) {
    throw new Error(
      'adonis-inertia-modal: the response did not contain a modal payload. This usually means the ' +
        'server returned a redirect (e.g. an expired session) or the route does not return ' +
        'inertia.modal(...).'
    )
  }

  return payload
}
