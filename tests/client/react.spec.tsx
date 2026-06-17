import { test } from '@japa/runner'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

import { ModalStackProvider } from '../../src/client/react/ModalStackProvider.tsx'
import { ModalRoot } from '../../src/client/react/ModalRoot.tsx'
import { ModalLink } from '../../src/client/react/ModalLink.tsx'
import { Modal } from '../../src/client/react/Modal.tsx'
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
}) {
  const client =
    options.client ?? clientReturning({ component: 'users/show', props: {}, key: 'k1' })
  const Component = options.component ?? ShowUser
  return render(
    <ModalStackProvider
      httpClient={client}
      resolveComponent={async () => Component as never}
      usePageHook={() => options.page ?? basePage}
      navigate={options.navigate}
    >
      {options.ui}
      <ModalRoot />
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
