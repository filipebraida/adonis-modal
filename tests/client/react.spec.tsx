import { test } from '@japa/runner'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

import { ModalStackProvider } from '../../src/client/react/ModalStackProvider.tsx'
import { ModalRoot } from '../../src/client/react/ModalRoot.tsx'
import { ModalLink } from '../../src/client/react/ModalLink.tsx'
import { Modal } from '../../src/client/react/Modal.tsx'
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

function clientReturning(modal: unknown): HttpClientLike {
  return { request: () => Promise.resolve({ data: { props: { modal } } }) }
}

const basePage: PageInfo = { component: 'users/index', url: '/users', version: '1', props: {} }

function renderApp(options: {
  page?: PageInfo
  client?: HttpClientLike
  navigate?: (url: string) => void
  ui?: React.ReactNode
}) {
  const client =
    options.client ?? clientReturning({ component: 'users/show', props: {}, key: 'k1' })
  return render(
    <ModalStackProvider
      httpClient={client}
      resolveComponent={async () => ShowUser as never}
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
