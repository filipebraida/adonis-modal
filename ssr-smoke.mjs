// SSR safety smoke: render the clients with the real server renderers in plain
// Node (no DOM — the true SSR condition). Confirms the lib doesn't touch
// window/document during render and that a deep-linked modal's backdrop renders
// (the modal itself mounts after hydration). Run: node ssr-smoke.mjs
import React from 'react'
import { renderToString } from 'react-dom/server'
import { createSSRApp, h } from 'vue'
import { renderToString as vueRenderToString } from 'vue/server-renderer'

import * as ReactClient from './build/src/client/react/index.js'
import * as VueClient from './build/src/client/vue/index.js'

const deepLinkPage = {
  component: 'notes/index',
  url: '/notes/5/edit',
  version: '1',
  props: {
    modal: { component: 'notes/edit', props: { title: 'x' }, key: 'k1', baseUrl: '/notes' },
  },
}

console.log('env → document:', typeof document, '| window:', typeof window)

// React
const reactHtml = renderToString(
  React.createElement(
    ReactClient.ModalStackProvider,
    null,
    React.createElement('main', null, 'Backdrop: Notes'),
    React.createElement(ReactClient.ModalRoot, { usePageHook: () => deepLinkPage })
  )
)
console.log(
  'REACT  → rendered:',
  reactHtml.includes('Backdrop: Notes'),
  '| modal in HTML:',
  reactHtml.includes('im-dialog'),
  '| len:',
  reactHtml.length
)

// Vue
const app = createSSRApp({
  render: () =>
    h('div', [
      h('main', 'Backdrop: Notes'),
      h(VueClient.ModalRoot, { usePageHook: () => deepLinkPage }),
    ]),
})
app.use(VueClient.modal, {
  resolveComponent: async () => ({ render: () => h('span', 'modal') }),
  httpClient: { request: () => Promise.resolve({ data: {} }) },
})
const vueHtml = await vueRenderToString(app)
console.log(
  'VUE    → rendered:',
  vueHtml.includes('Backdrop: Notes'),
  '| modal in HTML:',
  vueHtml.includes('im-dialog'),
  '| len:',
  vueHtml.length
)

function assert(condition, message) {
  if (!condition) {
    console.error('SSR_SMOKE_FAILED:', message)
    process.exit(1)
  }
}

assert(typeof document === 'undefined' && typeof window === 'undefined', 'not a no-DOM env')
assert(reactHtml.includes('Backdrop: Notes'), 'React backdrop did not render')
assert(vueHtml.includes('Backdrop: Notes'), 'Vue backdrop did not render')

console.log('SSR_SMOKE_PASSED')
