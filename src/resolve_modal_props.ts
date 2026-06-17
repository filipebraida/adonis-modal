/*
 * adonis-modal
 *
 * Resolves the adapter's prop wrappers (defer/optional/always/merge) *inside*
 * `modal.props`. The AdonisJS Inertia adapter only processes these symbol-tagged
 * wrappers at the top level of the page props, and treats our `modal` prop as a
 * plain object — so deferred/optional/merge props nested under `modal.props`
 * would otherwise be serialized as raw wrapper objects. We re-implement the same
 * categorization here (the symbols are global `Symbol.for(...)`, so no adapter
 * import is needed). Resolved values stay as plain data / models; the adapter
 * serializes the whole `modal` object afterwards.
 */

const ALWAYS_PROP = Symbol.for('ALWAYS_PROP')
const OPTIONAL_PROP = Symbol.for('OPTIONAL_PROP')
const DEFERRED_PROP = Symbol.for('DEFERRED_PROP')
const TO_BE_MERGED = Symbol.for('TO_BE_MERGED')
const DEEP_MERGE = Symbol.for('DEEP_MERGE')

function isObject(value: unknown): value is Record<PropertyKey, any> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export interface ResolveModalPropsOptions {
  /** True for a partial reload of specific modal props (cherry-pick). */
  partial?: boolean
  /** Modal prop names to include (relative to modal.props). */
  only?: string[]
  /** Modal prop names to exclude. */
  except?: string[]
}

export interface ResolvedModalProps {
  props: Record<string, unknown>
  /** group -> deferred prop names (for the client's <Deferred>). */
  deferred: Record<string, string[]>
  mergeProps: string[]
  deepMergeProps: string[]
}

/**
 * Expand dot-notation keys (e.g. `'stats.today'`) into nested objects.
 */
function nestDotProps(flat: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(flat)) {
    if (!key.includes('.')) {
      result[key] = value
      continue
    }
    const segments = key.split('.')
    const last = segments.pop()!
    let cursor = result
    for (const segment of segments) {
      if (typeof cursor[segment] !== 'object' || cursor[segment] === null) {
        cursor[segment] = {}
      }
      cursor = cursor[segment] as Record<string, unknown>
    }
    cursor[last] = value
  }
  return result
}

export async function resolveModalProps(
  input: Record<string, unknown>,
  options: ResolveModalPropsOptions = {}
): Promise<ResolvedModalProps> {
  const { partial = false, only, except } = options
  const deferred: Record<string, string[]> = {}
  const mergeProps: string[] = []
  const deepMergeProps: string[] = []
  const pending: Array<{ key: string; value: unknown | (() => unknown) }> = []

  const isCherryPicked = (key: string): boolean => {
    if (only) return only.includes(key)
    if (except) return !except.includes(key)
    return true
  }

  for (const [key, value] of Object.entries(input)) {
    if (isObject(value)) {
      /**
       * Always props are included regardless of cherry-picking.
       */
      if (ALWAYS_PROP in value) {
        pending.push({ key, value: value.value })
        continue
      }

      /**
       * On a partial reload, skip props that weren't requested.
       */
      if (partial && !isCherryPicked(key)) {
        continue
      }

      if (DEFERRED_PROP in value) {
        if (partial) {
          pending.push({ key, value: value.compute })
        } else {
          const group = value.group ?? 'default'
          deferred[group] = deferred[group] ?? []
          deferred[group].push(key)
        }
        continue
      }

      if (OPTIONAL_PROP in value) {
        // Only loaded on demand (partial reload).
        if (partial) {
          pending.push({ key, value: value.compute })
        }
        continue
      }

      if (TO_BE_MERGED in value) {
        if (value[DEEP_MERGE]) {
          deepMergeProps.push(key)
        } else {
          mergeProps.push(key)
        }

        const inner = value.value
        if (isObject(inner) && DEFERRED_PROP in inner) {
          if (partial) {
            pending.push({ key, value: inner.compute })
          } else {
            const group = inner.group ?? 'default'
            deferred[group] = deferred[group] ?? []
            deferred[group].push(key)
          }
        } else {
          pending.push({ key, value: inner })
        }
        continue
      }

      pending.push({ key, value })
    } else {
      if (partial && !isCherryPicked(key)) {
        continue
      }
      pending.push({ key, value })
    }
  }

  const flat: Record<string, unknown> = {}
  await Promise.all(
    pending.map(async ({ key, value }) => {
      flat[key] = typeof value === 'function' ? await (value as () => unknown)() : value
    })
  )

  return { props: nestDotProps(flat), deferred, mergeProps, deepMergeProps }
}
