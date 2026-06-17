/*
 * adonis-inertia-modal — framework-agnostic core
 *
 * Default, dependency-free HTTP client (uses the browser fetch API). Apps that
 * need Inertia's axios interceptors / XSRF handling can inject their own client.
 */

import type { HttpClientLike } from './open.ts'

/** Serialize a (possibly nested/array) value into URLSearchParams. */
function appendParam(
  search: URLSearchParams,
  key: string,
  value: unknown,
  arrayFormat: 'brackets' | 'indices'
): void {
  if (value === undefined || value === null) {
    return
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      const itemKey = arrayFormat === 'indices' ? `${key}[${index}]` : `${key}[]`
      appendParam(search, itemKey, item, arrayFormat)
    })
  } else if (typeof value === 'object') {
    for (const [nestedKey, nestedValue] of Object.entries(value as Record<string, unknown>)) {
      appendParam(search, `${key}[${nestedKey}]`, nestedValue, arrayFormat)
    }
  } else {
    search.append(key, String(value))
  }
}

/** Serialize a params object into a query string, handling arrays/nested objects. */
export function serializeParams(
  params: Record<string, unknown>,
  arrayFormat: 'brackets' | 'indices' = 'brackets'
): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    appendParam(search, key, value, arrayFormat)
  }
  return search.toString()
}

export function createFetchClient(): HttpClientLike {
  return {
    async request({ url, method, data, params, headers, queryStringArrayFormat }) {
      let finalUrl = url

      if (params && Object.keys(params).length > 0) {
        const query = serializeParams(params, queryStringArrayFormat ?? 'brackets')
        if (query) {
          finalUrl += (finalUrl.includes('?') ? '&' : '?') + query
        }
      }

      const response = await fetch(finalUrl, {
        method: method.toUpperCase(),
        credentials: 'same-origin',
        headers: {
          ...(data ? { 'Content-Type': 'application/json' } : {}),
          ...headers,
        },
        body: data ? JSON.stringify(data) : undefined,
      })

      const text = await response.text()
      let parsed: unknown = text
      try {
        parsed = JSON.parse(text)
      } catch {
        // leave as text; parseModalPayload will reject it
      }
      return {
        data: parsed,
        status: response.status,
        headers: Object.fromEntries(response.headers.entries()),
        redirected: response.redirected,
        url: response.url,
      }
    },
  }
}
