/*
 * adonis-modal — React client
 */

import { useEffect, useState, type ComponentType } from 'react'

import { ModalIndexContext, useModalStack } from './context.ts'

/**
 * Resolves the component for one stack entry (by name) and renders it, exposing
 * its index so useModal() can find the entry. The resolved component is expected
 * to wrap its content in <Modal>.
 */
export function ModalRenderer({ index }: { index: number }) {
  const { stack, resolve } = useModalStack()
  const entry = stack[index]
  const [Component, setComponent] = useState<ComponentType | null>(null)

  useEffect(() => {
    let active = true
    resolve(entry.component).then((resolved) => {
      if (active) {
        setComponent(() => resolved)
      }
    })
    return () => {
      active = false
    }
  }, [entry.component, resolve])

  if (!Component) {
    return null
  }

  return (
    <ModalIndexContext.Provider value={index}>
      <Component {...entry.props} />
    </ModalIndexContext.Provider>
  )
}
