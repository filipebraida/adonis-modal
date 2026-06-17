import { test } from '@japa/runner'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import {
  defineComponent,
  h,
  nextTick,
  reactive,
  type Component as VueComponent,
  type VNode,
} from 'vue'

import { modal as modalPlugin } from '../../src/client/vue/plugin.ts'
import { ModalRoot } from '../../src/client/vue/modal_root.ts'
import { ModalLink } from '../../src/client/vue/modal_link.ts'
import { Modal } from '../../src/client/vue/modal.ts'
import { Deferred } from '../../src/client/vue/deferred.ts'
import { HeadlessModal } from '../../src/client/vue/headless_modal.ts'
import { useModalStack } from '../../src/client/vue/context.ts'
import useModal from '../../src/client/vue/use_modal.ts'
import type { HttpClientLike } from '../../src/client/core/open.ts'
import type { PageInfo } from '../../src/client/vue/types.ts'

/** A page component that renders as a modal and exposes a close button. */
const ShowUser = defineComponent({
  props: { name: { type: String, required: false } },
  setup(props) {
    return () =>
      h(Modal, null, {
        default: ({ close }: { close: () => void }) =>
          h('div', [
            h('span', `User: ${props.name}`),
            h('button', { type: 'button', onClick: close }, 'close-modal'),
          ]),
      })
  },
})

/** A modal page exposing reloadable props and validation errors via useModal(). */
const UserForm = defineComponent({
  setup() {
    const modal = useModal()
    return () =>
      h(Modal, null, {
        default: () =>
          h('div', [
            h('span', `count: ${String(modal.value?.props.count ?? 0)}`),
            modal.value?.errors.email ? h('span', `error: ${modal.value.errors.email}`) : null,
            h('button', { type: 'button', onClick: () => modal.value?.reload() }, 'reload'),
          ]),
      })
  },
})

function clientReturning(modalPayload: unknown): HttpClientLike {
  return { request: () => Promise.resolve({ data: { props: { modal: modalPayload } } }) }
}

const wrappers: VueWrapper[] = []

function mountApp(options: {
  page?: PageInfo
  client?: HttpClientLike
  navigate?: (url: string) => void
  ui?: () => VNode
  component?: VueComponent
  resolve?: (name: string) => Promise<VueComponent>
}): { wrapper: VueWrapper; page: PageInfo } {
  const client =
    options.client ?? clientReturning({ component: 'users/show', props: {}, key: 'k1' })
  const Component = options.component ?? ShowUser
  const resolve = options.resolve ?? (async () => Component)
  const page = reactive<PageInfo>(
    options.page ?? { component: 'users/index', url: '/users', version: '1', props: {} }
  )

  const Root = defineComponent({
    setup() {
      return () =>
        h('div', [options.ui ? options.ui() : null, h(ModalRoot, { usePageHook: () => page })])
    },
  })

  const wrapper = mount(Root, {
    attachTo: document.body,
    global: {
      plugins: [
        [
          modalPlugin,
          { httpClient: client, resolveComponent: resolve, navigate: options.navigate },
        ],
      ],
    },
  })
  wrappers.push(wrapper)
  return { wrapper, page }
}

async function tick(times = 6) {
  for (let i = 0; i < times; i++) {
    await flushPromises()
    await nextTick()
  }
}

function clickText(wrapper: VueWrapper, text: string) {
  const el = wrapper.findAll('a, button').find((w) => w.text().trim() === text)
  if (!el) throw new Error(`no clickable element with text "${text}"`)
  return el.trigger('click')
}

test.group('vue | ModalLink + ModalRoot', (group) => {
  group.each.teardown(() => {
    wrappers.splice(0).forEach((w) => w.unmount())
  })

  test('opens a modal when the link is clicked', async ({ assert }) => {
    const { wrapper } = mountApp({
      client: clientReturning({ component: 'users/show', props: { name: 'Jane' }, key: 'k1' }),
      ui: () => h(ModalLink, { href: '/users/1' }, { default: () => 'Open' }),
    })

    await clickText(wrapper, 'Open')
    await tick()

    assert.include(wrapper.text(), 'User: Jane')
  })

  test('opens the native <dialog> after mount (open=true)', async ({ assert }) => {
    // Regression: the initial open must run after the dialog ref is attached
    // (onMounted), not from an immediate watcher that fires pre-mount and is
    // skipped — which left the dialog rendered but never shown (open=false).
    const { wrapper } = mountApp({
      client: clientReturning({ component: 'users/show', props: { name: 'Jane' }, key: 'k1' }),
      ui: () => h(ModalLink, { href: '/users/1' }, { default: () => 'Open' }),
    })

    await clickText(wrapper, 'Open')
    await tick()

    const dialog = document.querySelector('dialog.im-dialog') as HTMLDialogElement | null
    assert.isNotNull(dialog)
    assert.isTrue(dialog!.open)
  })

  test('useModal().close() removes the modal from the stack', async ({ assert }) => {
    const { wrapper } = mountApp({
      client: clientReturning({ component: 'users/show', props: { name: 'Jane' }, key: 'k1' }),
      ui: () => h(ModalLink, { href: '/users/1' }, { default: () => 'Open' }),
    })

    await clickText(wrapper, 'Open')
    await tick()
    assert.include(wrapper.text(), 'User: Jane')

    await clickText(wrapper, 'close-modal')
    await tick()
    assert.notInclude(wrapper.text(), 'User: Jane')
  })

  test('closes on Escape', async ({ assert }) => {
    const { wrapper } = mountApp({
      client: clientReturning({ component: 'users/show', props: { name: 'Jane' }, key: 'k1' }),
      ui: () => h(ModalLink, { href: '/users/1' }, { default: () => 'Open' }),
    })

    await clickText(wrapper, 'Open')
    await tick()

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await tick()
    assert.notInclude(wrapper.text(), 'User: Jane')
  })
})

test.group('vue | deep-link (page props modal)', (group) => {
  group.each.teardown(() => {
    wrappers.splice(0).forEach((w) => w.unmount())
  })

  test('renders a modal present in the page props and navigates on close', async ({ assert }) => {
    let navigatedTo: string | null = null
    const { wrapper } = mountApp({
      page: {
        component: 'users/index',
        url: '/users/1',
        version: '1',
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

    await tick()
    assert.include(wrapper.text(), 'User: Deep')

    await clickText(wrapper, 'close-modal')
    await tick()
    assert.notInclude(wrapper.text(), 'User: Deep')
    assert.equal(navigatedTo, '/users')
  })

  test('a re-rendered deep-link modal updates in place (no duplicate)', async ({ assert }) => {
    const { wrapper, page } = mountApp({
      page: {
        component: 'users/index',
        url: '/m/new',
        version: '1',
        props: {
          modal: { component: 'users/show', props: { name: 'A' }, key: 'k1', baseUrl: '/m' },
        },
      },
    })

    await tick()
    assert.include(wrapper.text(), 'User: A')

    // Validation redirect-back: same component + baseUrl, NEW key + errors.
    page.props = {
      modal: { component: 'users/show', props: { name: 'A' }, key: 'k2', baseUrl: '/m' },
      errors: { name: 'Required' },
    }
    await tick()

    assert.equal(document.querySelectorAll('.im-dialog').length, 1)
  })

  test('navigating to a page without a modal closes the open modal', async ({ assert }) => {
    const { page } = mountApp({
      page: {
        component: 'modal_demo',
        url: '/m/new',
        version: '1',
        props: {
          modal: { component: 'users/show', props: { name: 'A' }, key: 'k1', baseUrl: '/m' },
        },
      },
    })

    await tick()
    assert.equal(document.querySelectorAll('.im-dialog').length, 1)

    // Navigate to a page without a modal (e.g. a successful submit redirect).
    page.component = 'modal_demo'
    page.url = '/m'
    page.props = {}
    await tick()

    assert.equal(document.querySelectorAll('.im-dialog').length, 0)
  })
})

test.group('vue | forms & reload', (group) => {
  group.each.teardown(() => {
    wrappers.splice(0).forEach((w) => w.unmount())
  })

  test('exposes validation errors via useModal().errors', async ({ assert }) => {
    const { wrapper } = mountApp({
      component: UserForm,
      page: {
        component: 'users/index',
        url: '/users',
        version: '1',
        props: {
          modal: { component: 'users/form', props: {}, key: 'k1' },
          errors: { email: 'Required' },
        },
      },
    })

    await tick()
    assert.include(wrapper.text(), 'error: Required')
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

    const { wrapper } = mountApp({
      component: UserForm,
      client,
      ui: () => h(ModalLink, { href: '/users/1/form' }, { default: () => 'Open' }),
    })

    await clickText(wrapper, 'Open')
    await tick()
    assert.include(wrapper.text(), 'count: 1')

    await clickText(wrapper, 'reload')
    await tick()
    assert.include(wrapper.text(), 'count: 2')
  })
})

test.group('vue | nested, slideover & event bus', (group) => {
  group.each.teardown(() => {
    wrappers.splice(0).forEach((w) => w.unmount())
  })

  test('opens a modal from within a modal (stacked)', async ({ assert }) => {
    const ModalA = defineComponent({
      setup() {
        return () =>
          h(Modal, null, {
            default: () => h(ModalLink, { href: '/b' }, { default: () => 'open-b' }),
          })
      },
    })
    const ModalB = defineComponent({
      setup() {
        return () => h(Modal, null, { default: () => h('span', 'Modal B') })
      },
    })

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

    const { wrapper } = mountApp({
      client,
      resolve: async (name) => (name === 'mod/b' ? ModalB : ModalA),
      ui: () => h(ModalLink, { href: '/a' }, { default: () => 'open-a' }),
    })

    await clickText(wrapper, 'open-a')
    await tick()
    await clickText(wrapper, 'open-b')
    await tick()

    assert.include(wrapper.text(), 'Modal B')
    assert.include(wrapper.text(), 'open-b') // parent modal still mounted
  })

  test('opens as a slideover when slideover is set', async ({ assert }) => {
    const { wrapper } = mountApp({
      client: clientReturning({ component: 'users/show', props: { name: 'S' }, key: 'k1' }),
      ui: () => h(ModalLink, { href: '/users/1', slideover: true }, { default: () => 'open' }),
    })

    await clickText(wrapper, 'open')
    await tick()

    assert.isNotNull(document.querySelector('.im-slideover'))
  })

  test('emits events from a modal to a ModalLink listener (event bus)', async ({ assert }) => {
    let received: unknown = null
    const Emitter = defineComponent({
      setup() {
        const modal = useModal()
        return () =>
          h(Modal, null, {
            default: () =>
              h(
                'button',
                { type: 'button', onClick: () => modal.value?.emit('saved', 'hi') },
                'do-save'
              ),
          })
      },
    })

    const { wrapper } = mountApp({
      component: Emitter,
      client: clientReturning({ component: 'm', props: {}, key: 'k1' }),
      ui: () =>
        h(
          ModalLink,
          { href: '/m', onSaved: (value: unknown) => (received = value) },
          { default: () => 'open' }
        ),
    })

    await clickText(wrapper, 'open')
    await tick()
    await clickText(wrapper, 'do-save')
    await tick()

    assert.equal(received, 'hi')
  })
})

test.group('vue | local modals', (group) => {
  group.each.teardown(() => {
    wrappers.splice(0).forEach((w) => w.unmount())
  })

  test('opens a local modal with props, without a server request', async ({ assert }) => {
    let requested = false
    const client: HttpClientLike = {
      request: () => {
        requested = true
        return Promise.resolve({ data: { props: {} } })
      },
    }

    const LocalPage = defineComponent({
      setup() {
        const { visitModal } = useModalStack()
        return () =>
          h('div', [
            h(
              'button',
              {
                type: 'button',
                onClick: () => visitModal('#confirm', { props: { message: 'Sure?' } }),
              },
              'open-local'
            ),
            h(
              Modal,
              { name: 'confirm' },
              {
                default: ({
                  props,
                  close,
                }: {
                  props: Record<string, unknown>
                  close: () => void
                }) =>
                  h('div', [
                    h('span', `msg: ${String(props.message)}`),
                    h('button', { type: 'button', onClick: close }, 'x'),
                  ]),
              }
            ),
          ])
      },
    })

    const { wrapper } = mountApp({ client, component: LocalPage, ui: () => h(LocalPage) })

    await clickText(wrapper, 'open-local')
    await tick()
    assert.include(wrapper.text(), 'msg: Sure?')
    assert.isFalse(requested)

    await clickText(wrapper, 'x')
    await tick()
    assert.notInclude(wrapper.text(), 'msg: Sure?')
  })
})

test.group('vue | deferred props', (group) => {
  group.each.teardown(() => {
    wrappers.splice(0).forEach((w) => w.unmount())
  })

  test('<Deferred> shows fallback, then loads the prop via a sparse reload', async ({ assert }) => {
    const WithDeferred = defineComponent({
      setup() {
        const modal = useModal()
        return () =>
          h(Modal, null, {
            default: () =>
              h(
                Deferred,
                { data: 'stats' },
                {
                  default: () =>
                    h('span', `visits: ${String((modal.value?.props.stats as any)?.visits)}`),
                  fallback: () => h('span', 'loading-stats'),
                }
              ),
          })
      },
    })

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

    const { wrapper } = mountApp({
      component: WithDeferred,
      client,
      ui: () => h(ModalLink, { href: '/m' }, { default: () => 'Open' }),
    })

    await clickText(wrapper, 'Open')
    await tick(10)

    assert.include(wrapper.text(), 'visits: 5')
  })
})

test.group('vue | headless', (group) => {
  group.each.teardown(() => {
    wrappers.splice(0).forEach((w) => w.unmount())
  })

  test('<HeadlessModal> renders custom UI with the modal instance and closes', async ({
    assert,
  }) => {
    // A real modal page declares the props it receives, so the server prop
    // `name` is consumed here and not passed through to <HeadlessModal>.
    const Custom = defineComponent({
      props: { name: { type: String, required: false } },
      setup() {
        return () =>
          h(HeadlessModal, null, {
            default: (modal: { props: Record<string, unknown>; close: () => void }) =>
              h('div', [
                h('span', `custom: ${String(modal.props.name)}`),
                h('button', { type: 'button', onClick: modal.close }, 'x'),
              ]),
          })
      },
    })

    const { wrapper } = mountApp({
      component: Custom,
      client: clientReturning({ component: 'm', props: { name: 'Grace' }, key: 'k1' }),
      ui: () => h(ModalLink, { href: '/m' }, { default: () => 'Open' }),
    })

    await clickText(wrapper, 'Open')
    await tick()
    assert.include(wrapper.text(), 'custom: Grace')

    await clickText(wrapper, 'x')
    await tick()
    assert.notInclude(wrapper.text(), 'custom: Grace')
  })
})

test.group('vue | prefetch & close behaviors', (group) => {
  group.each.teardown(() => {
    wrappers.splice(0).forEach((w) => w.unmount())
  })

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

    const { wrapper } = mountApp({
      client,
      ui: () => h(ModalLink, { href: '/m', prefetch: 'mount' }, { default: () => 'Open' }),
    })

    await tick()
    assert.equal(calls, 1)

    await clickText(wrapper, 'Open')
    await tick()
    assert.include(wrapper.text(), 'User: Pre')
    assert.equal(calls, 1) // open reused the prefetched response
  })

  test('clicking the backdrop closes the modal by default', async ({ assert }) => {
    const { wrapper } = mountApp({
      client: clientReturning({ component: 'users/show', props: { name: 'B' }, key: 'k1' }),
      ui: () => h(ModalLink, { href: '/m' }, { default: () => 'Open' }),
    })

    await clickText(wrapper, 'Open')
    await tick()
    assert.include(wrapper.text(), 'User: B')

    await wrapper.find('.im-dialog').trigger('click')
    await tick()
    assert.notInclude(wrapper.text(), 'User: B')
  })

  test('closeExplicitly blocks Esc and backdrop, but the close button still closes', async ({
    assert,
  }) => {
    const { wrapper } = mountApp({
      client: clientReturning({ component: 'users/show', props: { name: 'B' }, key: 'k1' }),
      ui: () =>
        h(ModalLink, { href: '/m', config: { closeExplicitly: true } }, { default: () => 'Open' }),
    })

    await clickText(wrapper, 'Open')
    await tick()
    assert.include(wrapper.text(), 'User: B')

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await wrapper.find('.im-dialog').trigger('click')
    await tick()
    assert.include(wrapper.text(), 'User: B') // still open

    await clickText(wrapper, 'close-modal')
    await tick()
    assert.notInclude(wrapper.text(), 'User: B')
  })
})
