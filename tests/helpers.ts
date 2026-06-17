import { Edge } from 'edge.js'
import { HttpContext } from '@adonisjs/core/http'
import { IgnitorFactory } from '@adonisjs/core/factories'
import { defineConfig } from '@adonisjs/inertia'
import { defineConfig as defineViteConfig } from '@adonisjs/vite'
import type { ProviderNode } from '@adonisjs/core/types/app'

import ModalProvider from '../providers/modal_provider.ts'

export const BASE_URL = new URL('./tmp/', import.meta.url)

/**
 * Mock the `view` macro on HttpContext so `inertia.render` (HTML path, i.e. a
 * non-Inertia direct visit) returns a serializable `{ view, props }` object we
 * can assert on, instead of needing a real Edge template.
 * Ported from @adonisjs/inertia tests/helpers.ts.
 */
export function setupViewMacroMock() {
  const edge = Edge.create()
  const originalRenderer = edge.createRenderer.bind(edge)

  edge.createRenderer = function () {
    const renderer = originalRenderer()
    renderer.render = function (view: string, props: Record<string, any>): any {
      return { view, props: { ...this.getState(), ...props } }
    }
    return renderer
  }

  HttpContext.getter('view', () => edge.createRenderer(), true)
}

/**
 * Boot a real AdonisJS app for integration tests, registering the core, edge,
 * vite, inertia and adonis-inertia-modal providers.
 */
export async function setupApp(providers: ProviderNode[] = []) {
  const ignitor = new IgnitorFactory()
    .withCoreProviders()
    .withCoreConfig()
    .merge({
      config: {
        vite: defineViteConfig({}),
        inertia: defineConfig({}),
      },
      rcFileContents: {
        providers: providers.concat([
          {
            file: () => import('@adonisjs/core/providers/edge_provider'),
            environment: ['test', 'web'],
          },
          {
            file: () => import('@adonisjs/vite/vite_provider'),
            environment: ['test', 'web'],
          },
          {
            file: () => import('@adonisjs/inertia/inertia_provider'),
            environment: ['test', 'web'],
          },
          {
            file: async () => ({ default: ModalProvider }),
            environment: ['test', 'web'],
          },
        ]),
      },
    })
    .create(BASE_URL, {
      importer: (filePath) => {
        if (filePath.startsWith('./') || filePath.startsWith('../')) {
          return import(new URL(filePath, BASE_URL).href)
        }
        return import(filePath)
      },
    })

  const app = ignitor.createApp('web')
  await app.init()
  await app.boot()

  return { app }
}
