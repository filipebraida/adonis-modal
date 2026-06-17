import { test } from '@japa/runner'

import {
  ModalLocationError,
  requestModal,
  type HttpClientLike,
  type HttpResponseLike,
} from '../../src/client/core/open.ts'

function fakeClient(data: unknown, capture?: (config: any) => void): HttpClientLike {
  return {
    request(config) {
      capture?.(config)
      return Promise.resolve({ data })
    },
  }
}

function fakeClientResponse(response: HttpResponseLike): HttpClientLike {
  return { request: () => Promise.resolve(response) }
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

  test('throws a hard ModalLocationError on a version mismatch (X-Inertia-Location)', async ({
    assert,
  }) => {
    const client = fakeClientResponse({
      data: {},
      status: 409,
      headers: { 'x-inertia-location': '/dashboard' },
    })

    try {
      await requestModal(client, { href: '/x', currentComponent: 'home' })
      assert.fail('should have thrown')
    } catch (error) {
      assert.instanceOf(error, ModalLocationError)
      assert.equal((error as ModalLocationError).location, '/dashboard')
      assert.isTrue((error as ModalLocationError).hard)
    }
  })

  test('throws a soft ModalLocationError on a followed redirect', async ({ assert }) => {
    const client = fakeClientResponse({
      data: { props: {} },
      redirected: true,
      url: 'https://app.test/login',
    })

    try {
      await requestModal(client, { href: '/x', currentComponent: 'home' })
      assert.fail('should have thrown')
    } catch (error) {
      assert.instanceOf(error, ModalLocationError)
      assert.equal((error as ModalLocationError).location, 'https://app.test/login')
      assert.isFalse((error as ModalLocationError).hard)
    }
  })
})
