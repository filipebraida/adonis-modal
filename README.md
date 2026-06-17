# adonis-inertia-modal

Backend-driven modals for [Inertia.js](https://inertiajs.com) on
[AdonisJS](https://adonisjs.com). Open any route in a modal or slideover —
deep-linkable, validation-aware, with the backdrop page preserved — without
fighting client-side state.

> Status: beta. React and Vue 3 supported, both validated end-to-end in a real
> AdonisJS 7 + Inertia app. SSR-safe (deep-linked modals mount after hydration).

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
- React 18/19 + `@inertiajs/react` ^2, **or** Vue 3 + `@inertiajs/vue3` ^2

## Install

```sh
node ace add adonis-inertia-modal
```

`add` installs the package (with your detected package manager) and runs the
`configure` hook, which registers the provider and prints the wiring steps below.

> Prefer doing it manually? `npm i adonis-inertia-modal && node ace configure adonis-inertia-modal`.

### Wire the frontend (React)

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

### Wire the frontend (Vue 3)

```ts
// inertia/app.ts
import 'adonis-inertia-modal/styles.css'
import { createApp, h } from 'vue'
import { createInertiaApp } from '@inertiajs/vue3'
import { modal } from 'adonis-inertia-modal/vue'

createInertiaApp({
  resolve: (name) => resolvePageComponent(/* ... */),
  setup({ el, App, props, plugin }) {
    createApp({ render: () => h(App, props) })
      .use(plugin)
      // Pass Inertia's page resolver so modal pages resolve the same way.
      .use(modal, { resolveComponent: (name) => resolvePageComponent(/* ... */) })
      .mount(el)
  },
})
```

Render `<ModalRoot />` once **inside** the app (e.g. in a layout), where Inertia's
`usePage()` is available:

```vue
<script setup lang="ts">
import { ModalRoot } from 'adonis-inertia-modal/vue'
</script>

<template>
  <slot />
  <ModalRoot />
</template>
```

A page renders as a modal by wrapping itself in `<Modal>` (a scoped slot exposes
the modal instance), and `<ModalLink>` opens a route in a modal:

```vue
<script setup lang="ts">
import { Modal, ModalLink, useModal } from 'adonis-inertia-modal/vue'

defineProps<{ user: { name: string } }>()
</script>

<template>
  <Modal v-slot="{ close }">
    <h1>{{ user.name }}</h1>
    <button @click="close">Close</button>
  </Modal>
</template>
```

`useModal()` returns a reactive `ComputedRef` of the modal instance
(`modal.value.props`, `.errors`, `.close()`, `.reload()`, `.emit()`, …). Extra
`@event` listeners on `<ModalLink>` become event-bus listeners. The server API
and all features below are identical across React and Vue.

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
`prefetch` (`hover`/`click`/`mount`), `cacheFor`, `history`, `navigate`. Callbacks:
`onStart`, `onSuccess`, `onError`, `onClose`, `onAfterLeave`. Render-prop exposes
`{ loading }`. Extra `on<Event>` props become event-bus listeners.

With `history` (opt-in), opening the modal pushes a browser-history entry so the
**Back button closes it** (and closing via the UI rolls that entry back). Back-to-close
only — Forward does not re-open a closed modal.

With `navigate` (per-link, or `putConfig('navigate', true)` globally), the route opens
as a **full page** instead of a modal — useful as a responsive opt-out on small screens.

Opening a modal via link is a controlled partial request, **not** a page swap, so the
backdrop page's form state and scroll position are preserved automatically.

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

`useModal()` (inside a modal) returns `{ props, errors, config, isOpen, index,
onTopOfStack, close, reload, emit, on, getParentModal, getChildModal }`.
`getParentModal()` / `getChildModal()` return the modal directly below / above in
the stack (or null). A stacked modal also receives `blur` (another modal opened on
top) and `focus` (it became top again) on its event bus — `useModal().on('blur', …)`.

### Forms & validation

Use Inertia's `useForm` inside the modal. On a validation error the modal stays
open with the errors; close it yourself on success:

```tsx
import { useForm } from '@inertiajs/react'
import { Modal } from 'adonis-inertia-modal/react'

export default function CreateNote() {
  const form = useForm({ title: '', body: '' })
  return (
    <Modal>
      {({ close }) => (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            form.post('/notes', { onSuccess: () => close() })
          }}
        >
          <input value={form.data.title} onChange={(e) => form.setData('title', e.target.value)} />
          {form.errors.title && <span>{form.errors.title}</span>}
          <button disabled={form.processing}>Save</button>
        </form>
      )}
    </Modal>
  )
}
```

`useModal().errors` also exposes the shared errors, and `useModal().reload({ only })`
re-fetches specific (deferred) props.

### Error handling

Opening a modal via link expects the server to return `inertia.modal(...)`. If it
returns anything else — a `404` (e.g. `findOrFail` on a missing record), an auth
redirect, or any other non-modal response — the open fails: the modal doesn't
appear and, **by default, the error is logged to the console** so it isn't silent.

Pass `onError` to handle it your way (and silence the default log):

```tsx
<ModalLink href={`/institutos/${id}/edit`} onError={() => toast.error('Not found')}>
  Edit
</ModalLink>
```

In Vue, attach `@error`. To handle a missing record gracefully, prefer returning a
modal from the server (`return inertia.modal('institutos/not-found', { id }).baseRoute(...)`)
or use `navigate` so the route opens as a full page (showing your real 404).

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

const { visitModal, closeAll } = useModalStack()
visitModal('/users/create', { slideover: true })
closeAll() // close every open modal (top-most first)

// Local (client-only) modal — no server request:
visitModal('#confirm', { props: { message: 'Sure?' } })
<Modal name="confirm">{({ props, close }) => <p>{props.message}</p>}</Modal>
```

Per-modal presentation comes from `config` (on `<ModalLink>`) or `putConfig`:
`maxWidth` (`sm`…`7xl`/`full`) maps to an `im-max-w-*` class; `panelClasses` /
`paddingClasses` are appended to the panel so you can add your own.

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

### Styling

Default styles ship in `adonis-inertia-modal/styles.css`; everything is prefixed
with `im-` so you can restyle freely:

- `.im-dialog` — the native `<dialog>` (full-viewport flex container); `::backdrop`
  is the overlay (target with plain CSS: `.im-dialog::backdrop { … }`).
- `.im-modal` / `.im-slideover` and `.im-position-{center,top,bottom,left,right}`.
- `.im-panel` — the content panel; `.im-max-w-{sm…7xl,full}` (from `maxWidth`),
  plus any `paddingClasses` / `panelClasses` you pass.
- `.im-close-button`. Enter/leave use `@starting-style` / `[data-leaving]` and
  honor `prefers-reduced-motion`.

## How it works

The controller shares a `modal` envelope on a normal Inertia page. When opened
via a link, the client issues a controlled partial request so only the modal is
fetched and the current page stays as the backdrop. When opened directly by URL,
the server dispatches the base route to render the backdrop, then layers the
modal on top — keeping the modal route deep-linkable.

## SSR

The client is SSR-safe — it never touches `window`/`document` during render, so
server-side rendering won't crash. A deep-linked modal's backdrop is rendered on
the server; the modal itself mounts after client hydration (it is not yet part of
the initial server HTML). Rendering deep-linked modals during SSR is planned.

## Credits

Architecture inspired by [inertiaui/modal](https://github.com/inertiaui/modal),
[momentum-modal](https://github.com/lepikhinb/momentum-modal) and
[emargareten/inertia-modal](https://github.com/emargareten/inertia-modal),
adapted to the AdonisJS Inertia adapter.

## License

MIT
