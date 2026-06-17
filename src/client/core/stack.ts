/*
 * adonis-inertia-modal — framework-agnostic core
 *
 * The modal stack. A small observable store (push/close/remove) designed to be
 * consumed by React's useSyncExternalStore (and a Vue equivalent later). Each
 * mutation produces a new array reference so subscribers re-render.
 */

import { EventEmitter } from './event_emitter.ts'
import type { ModalEntry, ModalResponsePayload, PushOptions } from './types.ts'

export function generateId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID()
  }
  return `modal-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`
}

export class ModalStack {
  #entries: ModalEntry[] = []
  #subscribers: Set<() => void> = new Set()

  subscribe = (callback: () => void): (() => void) => {
    this.#subscribers.add(callback)
    return () => this.#subscribers.delete(callback)
  }

  getSnapshot = (): ModalEntry[] => this.#entries

  #notify(): void {
    this.#subscribers.forEach((callback) => callback())
  }

  #reindex(): void {
    const last = this.#entries.length - 1
    const transitions: Array<{ emitter: EventEmitter; focused: boolean }> = []
    this.#entries = this.#entries.map((entry, index) => {
      const onTopOfStack = index === last
      if (entry.onTopOfStack !== onTopOfStack) {
        transitions.push({ emitter: entry.emitter, focused: onTopOfStack })
      }
      return { ...entry, index, onTopOfStack }
    })
    // A modal loses focus when another stacks on top (`blur`) and regains it
    // when the one above closes (`focus`). Fired after the array is rebuilt.
    for (const { emitter, focused } of transitions) {
      emitter.emit(focused ? 'focus' : 'blur')
    }
  }

  push(payload: ModalResponsePayload, options: PushOptions = {}): ModalEntry {
    const entry: ModalEntry = {
      id: payload.key ?? generateId(),
      name: options.name,
      component: payload.component,
      props: { ...payload.props },
      url: options.url,
      baseUrl: payload.baseUrl,
      redirectUrl: payload.redirectUrl,
      config: options.config ?? {},
      local: options.local ?? false,
      isOpen: true,
      index: this.#entries.length,
      onTopOfStack: true,
      emitter: new EventEmitter(),
      onClose: options.onClose,
      onAfterLeave: options.onAfterLeave,
    }

    this.#entries = [...this.#entries, entry]
    this.#reindex()
    this.#notify()
    return this.get(entry.id)!
  }

  /**
   * Mark a modal as closing (isOpen=false) and fire its onClose. Removal happens
   * later via remove() (after the leave transition in the UI layer).
   */
  close(id: string): void {
    const entry = this.#rawGet(id)
    if (!entry || !entry.isOpen) {
      return
    }
    this.#replace(id, { isOpen: false })
    entry.onClose?.()
    this.#notify()
  }

  remove(id: string): void {
    const entry = this.#rawGet(id)
    if (!entry) {
      return
    }
    this.#entries = this.#entries.filter((item) => item.id !== id)
    this.#reindex()
    entry.onAfterLeave?.()
    this.#notify()
  }

  closeAll(): void {
    ;[...this.#entries].reverse().forEach((entry) => this.close(entry.id))
  }

  /**
   * Clear the whole stack (e.g. on a real navigation). Fires `onAfterLeave` for
   * teardown, but deliberately NOT `onClose`: a deep-linked modal's `onClose`
   * navigates to its redirect URL, which would loop with the navigation that
   * triggered the reset.
   */
  reset(): void {
    const entries = this.#entries
    this.#entries = []
    for (const entry of entries) {
      entry.onAfterLeave?.()
    }
    this.#notify()
  }

  updateProps(id: string, props: Record<string, unknown>): void {
    const entry = this.#rawGet(id)
    if (!entry) {
      return
    }
    this.#replace(id, { props: { ...entry.props, ...props } })
    this.#notify()
  }

  get(id: string): ModalEntry | undefined {
    return this.#rawGet(id)
  }

  get top(): ModalEntry | undefined {
    return this.#entries[this.#entries.length - 1]
  }

  get length(): number {
    return this.#entries.length
  }

  #rawGet(id: string): ModalEntry | undefined {
    return this.#entries.find((entry) => entry.id === id)
  }

  /**
   * Replace one entry with a shallow-merged copy (new reference) and a fresh
   * array, preserving the per-entry emitter.
   */
  #replace(id: string, patch: Partial<ModalEntry>): void {
    this.#entries = this.#entries.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry))
  }
}
