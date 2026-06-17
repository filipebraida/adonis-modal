/*
 * adonis-inertia-modal — React client
 */

import { useEffect, useRef, type ReactNode } from 'react'

import useModal from './use_modal.ts'

export interface DeferredProps {
  /** Modal prop name(s) this block depends on. */
  data: string | string[]
  /** Shown until the deferred prop(s) have loaded. */
  fallback: ReactNode
  children: ReactNode
}

/**
 * Renders `children` once the named deferred modal prop(s) have been loaded,
 * triggering the load (a sparse modal reload) on mount. Until then it shows
 * `fallback`. Pairs with `inertia.modal('...', { stats: inertia.defer(...) })`.
 */
export function Deferred({ data, fallback, children }: DeferredProps) {
  const modal = useModal()
  const requested = useRef(false)
  const keys = Array.isArray(data) ? data : [data]
  const loaded = modal ? keys.every((key) => modal.props[key] !== undefined) : false

  useEffect(() => {
    if (modal && !loaded && !requested.current) {
      requested.current = true
      modal.reload({ only: keys })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded])

  if (!modal) {
    return null
  }
  return <>{loaded ? children : fallback}</>
}

export default Deferred
