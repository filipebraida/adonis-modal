/*
 * adonis-modal — React client
 */

import { useModalStack } from './context.ts'
import { ModalRenderer } from './ModalRenderer.tsx'

/**
 * Renders every modal currently on the stack. Place it once in your layout,
 * after the page content.
 */
export function ModalRoot() {
  const { stack } = useModalStack()

  return (
    <>
      {stack.map((entry, index) => (
        <ModalRenderer key={entry.id} index={index} />
      ))}
    </>
  )
}
