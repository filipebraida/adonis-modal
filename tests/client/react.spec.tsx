import { test } from '@japa/runner'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

import { ModalStackProvider } from '../../src/client/react/modal_stack_provider.tsx'
import { ModalRoot } from '../../src/client/react/modal_root.tsx'
import { ModalLink } from '../../src/client/react/modal_link.tsx'
import { Modal } from '../../src/client/react/modal.tsx'
import { Deferred } from '../../src/client/react/deferred.tsx'
import { HeadlessModal } from '../../src/client/react/headless_modal.tsx'
import { useModalStack } from '../../src/client/react/context.ts'
import useModal from '../../src/client/react/use_modal.ts'
import type { HttpClientLike } from '../../src/client/core/open.ts'
import type { PageInfo } from '../../src/client/react/types.ts'

/** A page component that renders as a modal and exposes a close button. */
function ShowUser(props: { name?: string }) {
  return (
    <Modal>
      {({ close }) => (
        <div>
          <span>User: {props.name}</span>
          <button type="button" onClick={close}>
            close-modal
          </button>
        </div>
      )}
    </Modal>
  )
}

/** A modal page exposing reloadable props and validation errors via useModal(). */
function UserForm() {
  const modal = useModal()!
  return (
    <Modal>
      <div>
        <span>count: {String(modal.props.count ?? 0)}</span>
        {modal.errors.email ? <span>error: {modal.errors.email}</span> : null}
        <button type="button" onClick={() => modal.reload()}>
          reload
        </button>
      </div>
    </Modal>
  )
}

function clientReturning(modal: unknown): HttpClientLike {
  return { request: () => Promise.resolve({ data: { props: { modal } } }) }
}

const basePage: PageInfo = { component: 'users/index', url: '/users', version: '1', props: {} }

function renderApp(options: {
  page?: PageInfo
  client?: HttpClientLike
  navigate?: (url: string) => void
  ui?: React.ReactNode
  component?: React.ComponentType<any>
  resolve?: (name: string) => Promise<React.ComponentType<any>>
}) {
  const client =
    options.client ?? clientReturning({ component: 'users/show', props: {}, key: 'k1' })
  const Component = options.component ?? ShowUser
  const resolve = options.resolve ?? (async () => Component)
  return render(
    <ModalStackProvider
      httpClient={client}
      resolveComponent={resolve as never}
      navigate={options.navigate}
    >
      {options.ui}
      <ModalRoot usePageHook={() => options.page ?? basePage} />
    </ModalStackProvider>
  )
}

test.group('react | ModalLink + ModalRoot', (group) => {
  group.each.teardown(() => cleanup())

  test('opens a modal when the link is clicked', async ({ assert }) => {
    renderApp({
      client: clientReturning({ component: 'users/show', props: { name: 'Jane' }, key: 'k1' }),
      ui: <ModalLink href="/users/1">Open</ModalLink>,
    })

    fireEvent.click(screen.getByText('Open'))

    assert.isNotNull(await screen.findByText('User: Jane'))
  })

  test('useModal().close() removes the modal from the stack', async ({ assert }) => {
    renderApp({
      client: clientReturning({ component: 'users/show', props: { name: 'Jane' }, key: 'k1' }),
      ui: <ModalLink href="/users/1">Open</ModalLink>,
    })

    fireEvent.click(screen.getByText('Open'))
    await screen.findByText('User: Jane')

    fireEvent.click(screen.getByText('close-modal'))
    await waitFor(() => assert.isNull(screen.queryByText('User: Jane')))
  })

  test('closes on Escape', async ({ assert }) => {
    renderApp({
      client: clientReturning({ component: 'users/show', props: { name: 'Jane' }, key: 'k1' }),
      ui: <ModalLink href="/users/1">Open</ModalLink>,
    })

    fireEvent.click(screen.getByText('Open'))
    await screen.findByText('User: Jane')

    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => assert.isNull(screen.queryByText('User: Jane')))
  })
})

test.group('react | deep-link (page props modal)', (group) => {
  group.each.teardown(() => cleanup())

  test('renders a modal present in the page props and navigates on close', async ({ assert }) => {
    let navigatedTo: string | null = null
    renderApp({
      page: {
        ...basePage,
        url: '/users/1',
        props: {
          modal: {
            component: 'users/show',
            props: { name: 'Deep' },
            key: 'deep1',
            redirectUrl: '/users',
          },
        },
      },
      navigate: (url) => (navigatedTo = url),
    })

    assert.isNotNull(await screen.findByText('User: Deep'))

    fireEvent.click(screen.getByText('close-modal'))
    await waitFor(() => assert.isNull(screen.queryByText('User: Deep')))
    assert.equal(navigatedTo, '/users')
  })

  test('a re-rendered deep-link modal updates in place (no duplicate)', async ({ assert }) => {
    function Harness({ getPage }: { getPage: () => PageInfo }) {
      return (
        <ModalStackProvider
          httpClient={clientReturning({ component: 'users/show', props: {}, key: 'x' })}
          resolveComponent={async () => ShowUser as never}
        >
          <ModalRoot usePageHook={getPage} />
        </ModalStackProvider>
      )
    }

    let page: PageInfo = {
      component: 'users/index',
      url: '/m/new',
      props: { modal: { component: 'users/show', props: { name: 'A' }, key: 'k1', baseUrl: '/m' } },
    }
    const { rerender } = render(<Harness getPage={() => page} />)
    await screen.findByText('User: A')

    // Validation redirect-back: same component + baseUrl, NEW key + errors.
    page = {
      component: 'users/index',
      url: '/m/new',
      props: {
        modal: { component: 'users/show', props: { name: 'A' }, key: 'k2', baseUrl: '/m' },
        errors: { name: 'Required' },
      },
    }
    rerender(<Harness getPage={() => page} />)

    await waitFor(() =>
      assert.equal((document.querySelectorAll('.im-dialog') as ArrayLike<unknown>).length, 1)
    )
  })

  test('navigating to a page without a modal closes the open modal', async ({ assert }) => {
    function Harness({ getPage }: { getPage: () => PageInfo }) {
      return (
        <ModalStackProvider
          httpClient={clientReturning({ component: 'users/show', props: {}, key: 'x' })}
          resolveComponent={async () => ShowUser as never}
        >
          <ModalRoot usePageHook={getPage} />
        </ModalStackProvider>
      )
    }

    let page: PageInfo = {
      component: 'modal_demo',
      url: '/m/new',
      props: { modal: { component: 'users/show', props: { name: 'A' }, key: 'k1', baseUrl: '/m' } },
    }
    const { rerender } = render(<Harness getPage={() => page} />)
    await screen.findByText('User: A')

    // Navigate to a page without a modal (e.g. a successful submit redirect).
    page = { component: 'modal_demo', url: '/m', props: {} }
    rerender(<Harness getPage={() => page} />)

    await waitFor(() =>
      assert.equal((document.querySelectorAll('.im-dialog') as ArrayLike<unknown>).length, 0)
    )
  })
})

test.group('react | forms & reload', (group) => {
  group.each.teardown(() => cleanup())

  test('exposes validation errors via useModal().errors', async ({ assert }) => {
    renderApp({
      component: UserForm,
      page: {
        ...basePage,
        props: {
          modal: { component: 'users/form', props: {}, key: 'k1' },
          errors: { email: 'Required' },
        },
      },
    })

    assert.isNotNull(await screen.findByText('error: Required'))
  })

  test('useModal().reload() re-fetches and updates the modal props', async ({ assert }) => {
    let calls = 0
    const client: HttpClientLike = {
      request: () => {
        calls += 1
        return Promise.resolve({
          data: {
            props: { modal: { component: 'users/form', props: { count: calls }, key: 'k1' } },
          },
        })
      },
    }

    renderApp({
      component: UserForm,
      client,
      ui: <ModalLink href="/users/1/form">Open</ModalLink>,
    })

    fireEvent.click(screen.getByText('Open'))
    assert.isNotNull(await screen.findByText('count: 1'))

    fireEvent.click(screen.getByText('reload'))
    assert.isNotNull(await screen.findByText('count: 2'))
  })
})

test.group('react | nested, slideover & event bus', (group) => {
  group.each.teardown(() => cleanup())

  test('opens a modal from within a modal (stacked)', async ({ assert }) => {
    function ModalA() {
      return (
        <Modal>
          <ModalLink href="/b">open-b</ModalLink>
        </Modal>
      )
    }
    function ModalB() {
      return (
        <Modal>
          <span>Modal B</span>
        </Modal>
      )
    }

    const client: HttpClientLike = {
      request: ({ url }) =>
        Promise.resolve({
          data: {
            props: {
              modal: url.includes('/b')
                ? { component: 'mod/b', props: {}, key: 'kb' }
                : { component: 'mod/a', props: {}, key: 'ka' },
            },
          },
        }),
    }

    renderApp({
      client,
      resolve: async (name) => (name === 'mod/b' ? ModalB : ModalA),
      ui: <ModalLink href="/a">open-a</ModalLink>,
    })

    fireEvent.click(screen.getByText('open-a'))
    fireEvent.click(await screen.findByText('open-b'))

    assert.isNotNull(await screen.findByText('Modal B'))
    assert.isNotNull(screen.queryByText('open-b')) // parent modal still mounted
  })

  test('opens as a slideover when slideover is set', async ({ assert }) => {
    const { container } = renderApp({
      client: clientReturning({ component: 'users/show', props: { name: 'S' }, key: 'k1' }),
      ui: (
        <ModalLink href="/users/1" slideover>
          open
        </ModalLink>
      ),
    })

    fireEvent.click(screen.getByText('open'))
    await screen.findByText('User: S')
    assert.isNotNull(
      (container as { querySelector(s: string): unknown }).querySelector('.im-slideover')
    )
  })

  test('emits events from a modal to a ModalLink listener (event bus)', async ({ assert }) => {
    let received: unknown = null
    function Emitter() {
      const modal = useModal()!
      return (
        <Modal>
          <button type="button" onClick={() => modal.emit('saved', 'hi')}>
            do-save
          </button>
        </Modal>
      )
    }

    renderApp({
      component: Emitter,
      client: clientReturning({ component: 'm', props: {}, key: 'k1' }),
      ui: (
        <ModalLink href="/m" onSaved={(value: unknown) => (received = value)}>
          open
        </ModalLink>
      ),
    })

    fireEvent.click(screen.getByText('open'))
    fireEvent.click(await screen.findByText('do-save'))

    assert.equal(received, 'hi')
  })
})

test.group('react | local modals', (group) => {
  group.each.teardown(() => cleanup())

  test('opens a local modal with props, without a server request', async ({ assert }) => {
    let requested = false
    const client: HttpClientLike = {
      request: () => {
        requested = true
        return Promise.resolve({ data: { props: {} } })
      },
    }

    function LocalPage() {
      const { visitModal } = useModalStack()
      return (
        <div>
          <button
            type="button"
            onClick={() => visitModal('#confirm', { props: { message: 'Sure?' } })}
          >
            open-local
          </button>
          <Modal name="confirm">
            {({ props, close }) => (
              <div>
                <span>msg: {String(props.message)}</span>
                <button type="button" onClick={close}>
                  x
                </button>
              </div>
            )}
          </Modal>
        </div>
      )
    }

    renderApp({ client, ui: <LocalPage /> })

    fireEvent.click(screen.getByText('open-local'))
    assert.isNotNull(await screen.findByText('msg: Sure?'))
    assert.isFalse(requested)

    fireEvent.click(screen.getByText('x'))
    await waitFor(() => assert.isNull(screen.queryByText('msg: Sure?')))
  })
})

test.group('react | deferred props', (group) => {
  group.each.teardown(() => cleanup())

  test('<Deferred> shows fallback, then loads the prop via a sparse reload', async ({ assert }) => {
    function Stats() {
      const modal = useModal()!
      return <span>visits: {String((modal.props.stats as any)?.visits)}</span>
    }
    function WithDeferred() {
      return (
        <Modal>
          <Deferred data="stats" fallback={<span>loading-stats</span>}>
            <Stats />
          </Deferred>
        </Modal>
      )
    }

    // The open returns the modal without `stats` (deferred); the reload that
    // targets modal.props.stats returns it.
    const client: HttpClientLike = {
      request: ({ headers }) => {
        const partial = headers['X-Inertia-Partial-Data'] ?? ''
        const modal = partial.includes('modal.props.stats')
          ? { component: 'm', props: { stats: { visits: 5 } }, key: 'k1' }
          : {
              component: 'm',
              props: { user: { id: 1 } },
              key: 'k1',
              deferred: { default: ['stats'] },
            }
        return Promise.resolve({ data: { props: { modal } } })
      },
    }

    renderApp({
      component: WithDeferred,
      client,
      ui: <ModalLink href="/m">Open</ModalLink>,
    })

    fireEvent.click(screen.getByText('Open'))
    // The deferred prop is absent on open, then loaded via the sparse reload.
    assert.isNotNull(await screen.findByText('visits: 5'))
  })
})

test.group('react | headless', (group) => {
  group.each.teardown(() => cleanup())

  test('<HeadlessModal> renders custom UI with the modal instance and closes', async ({
    assert,
  }) => {
    function Custom() {
      return (
        <HeadlessModal>
          {(modal) => (
            <div data-custom>
              <span>custom: {String(modal.props.name)}</span>
              <button type="button" onClick={modal.close}>
                x
              </button>
            </div>
          )}
        </HeadlessModal>
      )
    }

    renderApp({
      component: Custom,
      client: clientReturning({ component: 'm', props: { name: 'Grace' }, key: 'k1' }),
      ui: <ModalLink href="/m">Open</ModalLink>,
    })

    fireEvent.click(screen.getByText('Open'))
    assert.isNotNull(await screen.findByText('custom: Grace'))

    fireEvent.click(screen.getByText('x'))
    await waitFor(() => assert.isNull(screen.queryByText('custom: Grace')))
  })
})

test.group('react | prefetch', (group) => {
  group.each.teardown(() => cleanup())

  test('prefetch on mount serves the open from cache (single request)', async ({ assert }) => {
    let calls = 0
    const client: HttpClientLike = {
      request: () => {
        calls += 1
        return Promise.resolve({
          data: { props: { modal: { component: 'm', props: { name: 'Pre' }, key: 'k1' } } },
        })
      },
    }

    renderApp({
      client,
      ui: (
        <ModalLink href="/m" prefetch="mount">
          Open
        </ModalLink>
      ),
    })

    // Wait for the mount prefetch to populate the cache.
    await waitFor(() => assert.equal(calls, 1))

    fireEvent.click(screen.getByText('Open'))
    assert.isNotNull(await screen.findByText('User: Pre'))
    assert.equal(calls, 1) // open reused the prefetched response
  })
})

test.group('react | close behaviors', (group) => {
  group.each.teardown(() => cleanup())

  test('closeButton={false} hides the close button', async ({ assert }) => {
    function NoButton() {
      return <Modal closeButton={false}>body</Modal>
    }
    const { container } = renderApp({
      component: NoButton,
      client: clientReturning({ component: 'm', props: {}, key: 'k1' }),
      ui: <ModalLink href="/m">Open</ModalLink>,
    })

    fireEvent.click(screen.getByText('Open'))
    await screen.findByText('body')
    assert.isNull(container.querySelector('.im-close-button'))
  })

  test('clicking the backdrop closes the modal by default', async ({ assert }) => {
    const { container } = renderApp({
      client: clientReturning({ component: 'users/show', props: { name: 'B' }, key: 'k1' }),
      ui: <ModalLink href="/m">Open</ModalLink>,
    })

    fireEvent.click(screen.getByText('Open'))
    await screen.findByText('User: B')

    fireEvent.click(container.querySelector('.im-dialog')!)
    await waitFor(() => assert.isNull(screen.queryByText('User: B')))
  })

  test('closeExplicitly blocks Esc and backdrop, but the close button still closes', async ({
    assert,
  }) => {
    const { container } = renderApp({
      client: clientReturning({ component: 'users/show', props: { name: 'B' }, key: 'k1' }),
      ui: (
        <ModalLink href="/m" config={{ closeExplicitly: true }}>
          Open
        </ModalLink>
      ),
    })

    fireEvent.click(screen.getByText('Open'))
    await screen.findByText('User: B')

    fireEvent.keyDown(document, { key: 'Escape' })
    fireEvent.click(container.querySelector('.im-dialog')!)
    assert.isNotNull(screen.queryByText('User: B')) // still open

    fireEvent.click(screen.getByText('close-modal'))
    await waitFor(() => assert.isNull(screen.queryByText('User: B')))
  })

  test('Esc closes only the top modal in a stack', async ({ assert }) => {
    function ModalA() {
      return (
        <Modal>
          <ModalLink href="/b">open-b</ModalLink>
        </Modal>
      )
    }
    function ModalB() {
      return (
        <Modal>
          <span>Modal B</span>
        </Modal>
      )
    }
    const client: HttpClientLike = {
      request: ({ url }) =>
        Promise.resolve({
          data: {
            props: {
              modal: url.includes('/b')
                ? { component: 'mod/b', props: {}, key: 'kb' }
                : { component: 'mod/a', props: {}, key: 'ka' },
            },
          },
        }),
    }

    renderApp({
      client,
      resolve: async (name) => (name === 'mod/b' ? ModalB : ModalA),
      ui: <ModalLink href="/a">open-a</ModalLink>,
    })

    fireEvent.click(screen.getByText('open-a'))
    fireEvent.click(await screen.findByText('open-b'))
    await screen.findByText('Modal B')

    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => assert.isNull(screen.queryByText('Modal B'))) // top closed
    assert.isNotNull(screen.queryByText('open-b')) // parent still open

    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => assert.isNull(screen.queryByText('open-b'))) // parent closed
  })
})
