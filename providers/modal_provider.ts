/*
 * adonis-inertia-modal
 *
 * Backend-driven modals for Inertia.js on AdonisJS.
 */

import type { ApplicationService } from '@adonisjs/core/types'
import type { HttpContext } from '@adonisjs/core/http'
import { Inertia } from '@adonisjs/inertia'

import { ModalResponse } from '../src/modal_response.ts'
import type { ModalProps } from '../src/types.ts'

/**
 * Extend the Inertia instance with a `modal()` method so controllers can do:
 *
 * ```ts
 * return inertia.modal('users/show', { user }).baseRoute('users.index')
 * ```
 */
declare module '@adonisjs/inertia' {
  interface Inertia<Pages> {
    modal(component: string, props?: ModalProps): ModalResponse
  }
}

export default class ModalProvider {
  constructor(protected app: ApplicationService) {}

  async boot() {
    const router = await this.app.container.make('router')

    /**
     * The `Inertia` class is not Macroable, but it is exported. We patch its
     * prototype once at boot. `ctx` is a (runtime-accessible) protected field on
     * every instance — this is the single coupling point with the adapter
     * internals (see docs/design/spike-server-dispatch.md §4).
     */
    Inertia.prototype.modal = function (
      this: Inertia<any>,
      component: string,
      props: ModalProps = {}
    ) {
      const ctx = (this as unknown as { ctx: HttpContext }).ctx
      return new ModalResponse(this as unknown as any, ctx, component, props, router)
    }
  }
}
