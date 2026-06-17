/*
 * adonis-inertia-modal — React client
 */

import { useEffect } from 'react'
import { usePage as inertiaUsePage } from '@inertiajs/react'

import { useModalStack } from './context.ts'
import { ModalRenderer } from './modal_renderer.tsx'
import type { PageInfo } from './types.ts'

export interface ModalRootProps {
  /** Reads the current Inertia page. Defaults to Inertia's usePage(). */
  usePageHook?: () => PageInfo
}

/**
 * Renders every modal currently on the stack and feeds the current Inertia page
 * into the provider. Place it once inside your app/layout (after page content),
 * where Inertia's usePage() is available.
 */
export function ModalRoot({ usePageHook }: ModalRootProps = {}) {
  const { stack, syncPage } = useModalStack()
  const page = (usePageHook ?? (inertiaUsePage as unknown as () => PageInfo))()

  useEffect(() => {
    syncPage(page)
  }, [page, syncPage])

  return (
    <>
      {stack.map((entry, index) =>
        // Local modals render their own inline content via <Modal name>.
        entry.local ? null : <ModalRenderer key={entry.id} index={index} />
      )}
    </>
  )
}
