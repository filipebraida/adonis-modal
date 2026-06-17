/*
 * adonis-modal — framework-agnostic core
 *
 * Default, dependency-free HTTP client (uses the browser fetch API). Apps that
 * need Inertia's axios interceptors / XSRF handling can inject their own client.
 */

import type { HttpClientLike } from './open.ts'

export function createFetchClient(): HttpClientLike {
  return {
    async request({ url, method, data, params, headers }) {
      let finalUrl = url

      if (params && Object.keys(params).length > 0) {
        const search = new URLSearchParams()
        for (const [key, value] of Object.entries(params)) {
          search.append(key, String(value))
        }
        finalUrl += (finalUrl.includes('?') ? '&' : '?') + search.toString()
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
      return { data: parsed }
    },
  }
}
