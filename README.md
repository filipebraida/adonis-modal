# adonis-inertia-modal

Backend-driven modals for [Inertia.js](https://inertiajs.com) on
[AdonisJS](https://adonisjs.com). Open any route in a modal or slideover —
deep-linkable, validation-aware, with the backdrop page preserved — without
fighting client-side state.

> Status: early development (React supported; Vue planned). Validated end-to-end
> in a real AdonisJS 7 + React 19 app.

## Why

A controller decides a response is a modal:

```ts
// app/controllers/users_controller.ts
export default class UsersController {
  async show({ inertia, params }: HttpContext) {
    const user = await User.findOrFail(params.id)

    return inertia.modal('users/show', { user }).baseRoute('users.index')
  }
}
```

The modal is delivered as a shared `modal` prop on a normal Inertia page, so:

- **Opened via a link** — the current page stays as the backdrop, the modal stacks on top.
- **Opened directly via URL** — the base route renders the backdrop and the modal appears
  on top (deep-linkable, SEO-friendly, browser URL stays on the modal route).
- **Validation errors** — flow through Inertia's shared `errors` without reloading or
  remounting the modal.

## Requirements

- `@adonisjs/core` ^7
- `@adonisjs/inertia` ^4 (Inertia v2 client) — forward-compatible with ^5 (v3)
- React 18/19 + `@inertiajs/react` ^2

## Install

```sh
npm i adonis-inertia-modal
node ace configure adonis-inertia-modal
```

`configure` registers the provider and prints the wiring steps below.

### Wire the frontend

```tsx
// inertia/app.tsx
import 'adonis-inertia-modal/styles.css'
import { ModalStackProvider } from 'adonis-inertia-modal/react'

createInertiaApp({
  resolve: (name) => resolvePageComponent(/* ... */),
  setup({ el, App, props }) {
    createRoot(el).render(
      <ModalStackProvider>
        <App {...props} />
      </ModalStackProvider>
    )
  },
})
```

Render `<ModalRoot />` once **inside** the app (e.g. in a layout or persistent
layout), where Inertia's `usePage()` is available:

```tsx
import { ModalRoot } from 'adonis-inertia-modal/react'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <ModalRoot />
    </>
  )
}
```

## Server API

`inertia.modal(component, props?)` returns a chainable, awaitable builder — just
`return` it from a controller.

| Method                               | Description                                            |
| ------------------------------------ | ------------------------------------------------------ |
| `.baseRoute(name, params?)`          | Backdrop URL from a route name.                        |
| `.baseUrl(url)`                      | Backdrop URL directly.                                 |
| `.with(props)` / `.with(key, value)` | Merge extra props.                                     |
| `.refreshBackdrop(refresh?)`         | Re-render the backdrop with fresh data.                |
| `.forceBase(force?)`                 | Ignore referer/redirect header; close to the base URL. |

Modal props support dot-notation keys (`'stats.today'`) and the adapter's prop
wrappers **inside** the modal:

```ts
return inertia
  .modal('invoices/show', {
    invoice,
    lines: inertia.defer(() => invoice.related('lines').query()), // <Deferred>
    customer: inertia.optional(() => invoice.related('customer').query()), // <WhenVisible>
  })
  .baseRoute('invoices.index')
```

## Client API (React)

### `<ModalLink>`

Opens a route in a modal (like Inertia's `<Link>`).

```tsx
<ModalLink href="/users/1" /* method, data, headers, as */>Open</ModalLink>
<ModalLink href="/users/create" slideover>New user</ModalLink>
<ModalLink href="/users/1" prefetch="hover">Open</ModalLink>
```

Props: `href`, `method`, `data`, `headers`, `as`, `config`, `slideover`,
`prefetch` (`hover`/`click`/`mount`), `cacheFor`. Callbacks: `onStart`,
`onSuccess`, `onError`, `onClose`, `onAfterLeave`. Render-prop exposes
`{ loading }`. Extra `on<Event>` props become event-bus listeners.

### `<Modal>` and `useModal()`

The page that should render as a modal wraps itself in `<Modal>`:

```tsx
import { Modal, useModal } from 'adonis-inertia-modal/react'

export default function ShowUser({ user }) {
  return (
    <Modal>
      {({ close }) => (
        <>
          <h1>{user.name}</h1>
          <button onClick={close}>Close</button>
        </>
      )}
    </Modal>
  )
}
```

`useModal()` (inside a modal) returns `{ props, errors, config, isOpen,
onTopOfStack, close, reload, emit, on }`.

### Forms & validation

```tsx
const modal = useModal()!
// modal.errors.email is populated after a failed submit — the modal stays open.
// modal.reload({ only: ['stats'] }) re-fetches specific (deferred) props.
```

### Deferred / lazy props

```tsx
import { Deferred, WhenVisible } from 'adonis-inertia-modal/react'

<Deferred data="lines" fallback={<p>Loading…</p>}>
  <Lines />
</Deferred>

<WhenVisible data="customer" fallback={<p>Loading…</p>}>
  <Customer />
</WhenVisible>
```

### Nested, slideover & event bus

```tsx
// Open a modal from within a modal — it stacks automatically.
<Modal>
  <ModalLink href="/users/1/edit">Edit</ModalLink>
</Modal>

// Emit up to the opener:
<ModalLink href="/users/create" onCreated={(user) => /* ... */}>New</ModalLink>
// inside the modal: useModal()!.emit('created', user)
```

### Programmatic & local modals

```tsx
import { useModalStack, Modal } from 'adonis-inertia-modal/react'

const { visitModal } = useModalStack()
visitModal('/users/create', { slideover: true })

// Local (client-only) modal — no server request:
visitModal('#confirm', { props: { message: 'Sure?' } })
<Modal name="confirm">{({ props, close }) => <p>{props.message}</p>}</Modal>
```

### Headless mode

```tsx
import { HeadlessModal } from 'adonis-inertia-modal/react'

<HeadlessModal>{(modal) => /* your own dialog UI */}</HeadlessModal>
```

### Configuration

```ts
import { putConfig } from 'adonis-inertia-modal/react'

putConfig({ modal: { maxWidth: 'lg', closeButton: false } })
putConfig('slideover.position', 'left')
```

## How it works

The controller shares a `modal` envelope on a normal Inertia page. When opened
via a link, the client issues a controlled partial request so only the modal is
fetched and the current page stays as the backdrop. When opened directly by URL,
the server dispatches the base route to render the backdrop, then layers the
modal on top — keeping the modal route deep-linkable.

## Credits

Architecture inspired by [inertiaui/modal](https://github.com/inertiaui/modal),
[momentum-modal](https://github.com/lepikhinb/momentum-modal) and
[emargareten/inertia-modal](https://github.com/emargareten/inertia-modal),
adapted to the AdonisJS Inertia adapter.

## License

MIT
