# Changelog

All notable changes to this project are documented here.
This project adheres to [Semantic Versioning](https://semver.org).

## 0.1.0 — Unreleased

First usable release. React and Vue 3 support.

### Unreleased (since beta.1)

- `<Modal>` accepts presentation props so a page can declare its own appearance
  (`slideover`, `maxWidth`, `position`, `paddingClasses`, `panelClasses`,
  `closeButton`, `closeExplicitly`, `closeOnClickOutside`); the opener's config
  still wins, then these, then the global config.
- `useModal()` gains `getParentModal()` / `getChildModal()` to navigate the stack,
  and stacked modals receive `blur` / `focus` events on their event bus when
  another modal opens on top / closes (`useModal().on('blur', …)`).
- `<ModalLink>` emits `prefetching` / `prefetched` (`onPrefetching` / `onPrefetched`
  in React) around a prefetch.
- Array/nested values in GET `data` are now serialized properly (previously an
  array became `key=1,2`); `visit`/`visitModal` take `queryStringArrayFormat`
  (`'brackets'` default, or `'indices'`).

### beta.1

First beta. Feature-complete vs. the alpha line; React validated end-to-end in a
real AdonisJS + Inertia app and Vue validated the same way (open via link, deep-link
by URL with server props, history, focus, scroll-lock). Known limitation: deep-linked
modals render after client hydration, not in the initial SSR HTML.

- ModalRenderer unwraps ES module namespaces from the resolver (`{ default: Component }`),
  so custom `resolveComponent` using `resolvePageComponent` works (found validating the
  Vue client in a real Inertia + AdonisJS app).
- Graceful handling of non-modal responses when opening: an Inertia version
  mismatch (`409` + `X-Inertia-Location`) triggers a full reload, and a followed
  redirect (e.g. an expired session bounced to `/login`) navigates there — instead
  of just logging. The default HTTP client now exposes status/headers/redirect.

### alpha.6

- A failed modal open (non-modal response: 404, auth redirect, …) now logs to the
  console by default instead of failing silently; pass `onError` / `@error` to
  override (e.g. a toast).

### alpha.5

- Panel presentation config is now applied: `maxWidth` (token → `im-max-w-*`
  class, with a Tailwind-aligned scale in `styles.css`) and `paddingClasses` /
  `panelClasses` (appended to the panel), from the per-modal `config` or global
  `putConfig`. Dropped the dead `useNativeDialog` / `appElement` config fields.
- `useModalStack().closeAll()` closes every open modal (top-most first).
- Opt-in browser-history integration: `<ModalLink history>` / `visit(href, { history: true })`
  pushes a history entry so the **Back button closes the modal** (and a UI close rolls
  the entry back), coordinating with Inertia's own popstate so the page isn't reloaded.
  Back-to-close only (no Forward re-open).
- `navigate` mode: `<ModalLink navigate>` (or `putConfig('navigate', true)`) opens the
  route as a full page instead of a modal — a responsive opt-out.
- SSR-safe: no `window`/`document` access during render. Deep-linked modals mount
  after client hydration (full server-side modal rendering is planned).

### Server

- `inertia.modal(component, props?)` builder with `baseRoute()`, `baseUrl()`,
  `with()`, `refreshBackdrop()`, `forceBase()`; awaitable from a controller.
- Three render paths: open via link (partial), backdrop refresh, and direct-URL
  access (re-dispatches the base route so the modal is deep-linkable).
- Validation-aware: errors flow through Inertia's shared `errors`; the modal key
  is reused on validation responses so the form is not remounted.
- Resolves the adapter's prop wrappers (`defer`/`optional`/`merge`/`always`) and
  dot-notation **inside** `modal.props`; deferred props are listed for the client
  and computed on a sparse reload.
- Serializes `modal.props` like top-level Inertia props, so transformer outputs
  (`SomeTransformer.transform(...)`), Lucid models and dates resolve to plain JSON.

### React client (`adonis-inertia-modal/react`)

- `ModalStackProvider`, `ModalRoot`, `ModalLink`, `Modal`, `useModal`,
  `useModalStack` (`visit`/`visitModal`).
- Native `<dialog>`: top-layer, `::backdrop`, Esc and backdrop-click close
  (gated by `closeExplicitly` / `closeOnClickOutside`), body scroll-lock.
- Nested/stacked modals, slideover, positions, and an event bus
  (`emit` / `on<Event>` / `listeners`).
- Deferred props: `<Deferred>` and `<WhenVisible>`.
- Local (client-only) modals via `<Modal name>` + `#name` / `visitModal('#name')`.
- Headless mode: `HeadlessModal`.
- Prefetch on `hover` / `click` / `mount` with `cacheFor`.
- Configuration: `putConfig` / `getConfig` / `resetConfig`.

### Vue client (`adonis-inertia-modal/vue`)

- Vue 3 plugin (`app.use(modal, { resolveComponent })`) sharing the framework-agnostic
  core with React; same component surface: `ModalRoot`, `ModalLink`, `Modal`,
  `useModal`, `useModalStack` (`visit`/`visitModal`), `Deferred`, `WhenVisible`,
  `HeadlessModal`, and `putConfig`/`getConfig`/`resetConfig`.
- Scoped-slot API: `<Modal v-slot="{ props, close }">`; reactive `useModal()`
  returns a `ComputedRef`. Extra `@event` listeners on `<ModalLink>` become
  event-bus listeners.
- Same native `<dialog>` behavior (top-layer, `::backdrop`, Esc / backdrop-click
  close, scroll-lock) and deep-link / nested / slideover / prefetch support.

### Transitions

- Two-phase close on both clients: a modal marked closing plays its leave
  transition, then the native `dialog.close()` runs and the entry is removed
  (`onClose` → leave → `onAfterLeave`). Default enter (`@starting-style`) and
  leave (`[data-leaving]`) fade/slide ship in `styles.css`, with a
  `prefers-reduced-motion` opt-out; removal is immediate when no transition is set.

### Hardening (alpha.4)

- Ref-counted body scroll-lock so stacked modals can't leave the page locked.
- Open-redirect guard: the close-redirect target is reduced to a same-origin path.
- `ModalResponse.render()` is memoized and restores the request's routing state
  after dispatching the backdrop; `with()` no longer mutates the caller's props.
- Bounded prefetch cache (TTL + size cap); `EventEmitter` dispatch is mutation-safe.
- Close button honors per-modal and global (`putConfig`) config; lazy props stay
  lazy on `except` reloads. Browser-verified in Chromium.

### Tooling

- `node ace configure adonis-inertia-modal` registers the provider and prints wiring steps.
- Ships default styles via `import 'adonis-inertia-modal/styles.css'`.
