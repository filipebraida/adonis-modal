/*
 * adonis-inertia-modal — React client
 */

import { useEffect, useRef, type ReactNode } from 'react'

import useModal from './use_modal.ts'

export interface WhenVisibleProps {
  /** Modal prop name(s) to load when this block scrolls into view. */
  data: string | string[]
  fallback: ReactNode
  children: ReactNode
}

/**
 * Like <Deferred>, but defers the load until the block is scrolled into view
 * (via IntersectionObserver). Falls back to loading immediately when
 * IntersectionObserver is unavailable (e.g. SSR / tests).
 */
export function WhenVisible({ data, fallback, children }: WhenVisibleProps) {
  const modal = useModal()
  const requested = useRef(false)
  const ref = useRef<HTMLDivElement | null>(null)
  const keys = Array.isArray(data) ? data : [data]
  const loaded = modal ? keys.every((key) => modal.props[key] !== undefined) : false

  useEffect(() => {
    if (!modal || loaded || requested.current) {
      return
    }

    const trigger = () => {
      if (!requested.current) {
        requested.current = true
        modal.reload({ only: keys })
      }
    }

    if (typeof IntersectionObserver === 'undefined') {
      trigger()
      return
    }

    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        trigger()
        observer.disconnect()
      }
    })
    if (ref.current) {
      observer.observe(ref.current)
    }
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded])

  if (!modal || loaded) {
    return modal && loaded ? <>{children}</> : null
  }
  return <div ref={ref}>{fallback}</div>
}

export default WhenVisible
