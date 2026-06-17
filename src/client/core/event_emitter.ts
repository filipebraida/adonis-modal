/*
 * adonis-inertia-modal — framework-agnostic core
 */

export type EventCallback = (...args: unknown[]) => void

/**
 * Tiny event emitter used for modal ↔ modal communication (event bus).
 */
export class EventEmitter {
  #listeners: Map<string, Set<EventCallback>> = new Map()

  on(event: string, callback: EventCallback): () => void {
    if (!this.#listeners.has(event)) {
      this.#listeners.set(event, new Set())
    }
    this.#listeners.get(event)!.add(callback)
    return () => this.off(event, callback)
  }

  off(event: string, callback?: EventCallback): void {
    if (!callback) {
      this.#listeners.delete(event)
      return
    }
    this.#listeners.get(event)?.delete(callback)
  }

  emit(event: string, ...args: unknown[]): void {
    this.#listeners.get(event)?.forEach((callback) => callback(...args))
  }

  /**
   * Register many listeners at once from an object like `{ onSaved: fn }` →
   * listens to the `saved` event. Returns a disposer.
   */
  registerFromProps(props: Record<string, unknown>): () => void {
    const disposers: Array<() => void> = []
    for (const [key, value] of Object.entries(props)) {
      if (key.startsWith('on') && typeof value === 'function') {
        const event = key.charAt(2).toLowerCase() + key.slice(3)
        disposers.push(this.on(event, value as EventCallback))
      }
    }
    return () => disposers.forEach((dispose) => dispose())
  }
}
