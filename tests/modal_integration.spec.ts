import { test } from '@japa/runner'
import { InertiaManager, InertiaHeaders } from '@adonisjs/inertia'
import { HttpContextFactory, RequestFactory } from '@adonisjs/core/factories/http'

import { setupApp, setupViewMacroMock } from './helpers.ts'

/**
 * Integration tests: exercise ModalResponse through a real booted AdonisJS app
 * (router with registered routes, InertiaManager, the modal provider patching
 * Inertia.prototype.modal). See docs/design/phases-detailed.md (Fase 0).
 */
test.group('ModalResponse | integration', (group) => {
  let app: Awaited<ReturnType<typeof setupApp>>['app']

  group.setup(async () => {
    ;({ app } = await setupApp())

    const router = await app.container.make('router')
    router
      .get('/users', async (ctx: any) => ctx.inertia.render('users/index', { users: ['a', 'b'] }))
      .as('users.index')
    router.commit()
  })

  /**
   * Create a context + Inertia instance for a modal URL, with optional headers.
   */
  async function modalContext(headers: Record<string, string> = {}, url = '/users/1') {
    const request = new RequestFactory().merge({ url, method: 'GET' }).create()
    const ctx = new HttpContextFactory().merge({ request }).create()
    for (const [key, value] of Object.entries(headers)) {
      ctx.request.request.headers[key] = value
    }
    const manager = await app.container.make(InertiaManager)
    const inertia = manager.createForRequest(ctx)
    ;(ctx as any).inertia = inertia
    return { ctx, inertia }
  }

  test('direct access re-dispatches the base route and renders the backdrop with the modal', async ({
    assert,
  }) => {
    setupViewMacroMock()
    const { inertia } = await modalContext() // no x-inertia header → direct access

    const result: any = await inertia
      .modal('users/show', { user: { id: 1 } })
      .baseRoute('users.index')

    // HTML path returns the mocked view { view, props: { page } }
    assert.equal(result.props.page.component, 'users/index')
    assert.deepEqual(result.props.page.props.users, ['a', 'b'])
    assert.equal(result.props.page.props.modal.component, 'users/show')
    assert.deepEqual(result.props.page.props.modal.props, { user: { id: 1 } })
    assert.equal(result.props.page.props.modal.baseUrl, '/users')
  })

  test('via link (partial reload of modal) returns the backdrop component with only the modal', async ({
    assert,
  }) => {
    const { ctx, inertia } = await modalContext({
      [InertiaHeaders.Inertia]: 'true',
      [InertiaHeaders.PartialComponent]: 'users/index',
      [InertiaHeaders.PartialOnly]: 'modal',
    })

    const page: any = await inertia
      .modal('users/show', { user: { id: 1 } })
      .baseRoute('users.index')

    assert.equal(page.component, 'users/index')
    assert.properties(page.props, ['modal'])
    assert.notProperty(page.props, 'users')
    assert.equal(page.props.modal.component, 'users/show')
    assert.equal(ctx.response.getHeader('x-inertia-modal'), 'true')
  })

  test('refreshBackdrop re-dispatches the base route even on an Inertia request', async ({
    assert,
  }) => {
    const { inertia } = await modalContext({ [InertiaHeaders.Inertia]: 'true' })

    const page: any = await inertia
      .modal('users/show', { user: { id: 1 } })
      .baseRoute('users.index')
      .refreshBackdrop()

    // Backdrop was re-rendered (its own props are present), with the modal alongside
    assert.equal(page.component, 'users/index')
    assert.deepEqual(page.props.users, ['a', 'b'])
    assert.equal(page.props.modal.component, 'users/show')
  })

  test('reuses the client modal key on a validation-error response', async ({ assert }) => {
    const { ctx, inertia } = await modalContext({
      [InertiaHeaders.Inertia]: 'true',
      [InertiaHeaders.PartialComponent]: 'users/index',
      [InertiaHeaders.PartialOnly]: 'modal',
      'x-inertia-modal-key': 'reused-key',
    })

    // Simulate a flashed validation error bag in the session.
    ;(ctx as any).session = {
      flashMessages: {
        get: (key: string) => (key === 'inputErrorsBag' ? { email: ['Required'] } : undefined),
      },
    }

    const page: any = await inertia.modal('users/show', {}).baseRoute('users.index')

    assert.equal(page.props.modal.key, 'reused-key')
  })

  test('mints a fresh key on a normal (non-validation) modal open', async ({ assert }) => {
    const { inertia } = await modalContext({
      [InertiaHeaders.Inertia]: 'true',
      [InertiaHeaders.PartialComponent]: 'users/index',
      [InertiaHeaders.PartialOnly]: 'modal',
      'x-inertia-modal-key': 'previous-key',
    })

    const page: any = await inertia.modal('users/show', {}).baseRoute('users.index')

    assert.notEqual(page.props.modal.key, 'previous-key')
  })
})
