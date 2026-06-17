import { test } from '@japa/runner'

import { requestModal, type HttpClientLike } from '../../src/client/core/open.ts'

function fakeClient(data: unknown, capture?: (config: any) => void): HttpClientLike {
  return {
    request(config) {
      capture?.(config)
      return Promise.resolve({ data })
    },
  }
}

test.group('core | requestModal', () => {
  test('issues the modal request and returns the payload', async ({ assert }) => {
    const modal = { component: 'users/show', props: { id: 1 } }
    let sent: any
    const client = fakeClient({ props: { modal } }, (c) => (sent = c))

    const payload = await requestModal(client, {
      href: '/users/1',
      currentComponent: 'users/index',
    })

    assert.deepEqual(payload, modal)
    assert.equal(sent.headers['X-Inertia-Partial-Data'], 'modal')
    assert.equal(sent.url, '/users/1')
  })

  test('throws when no modal payload is present', async ({ assert }) => {
    const client = fakeClient({ props: {} })
    await assert.rejects(
      () => requestModal(client, { href: '/x', currentComponent: 'home' }),
      /did not contain a modal payload/
    )
  })
})
