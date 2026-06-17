/*
 * adonis-inertia-modal — Vue client
 */

import { defineComponent, h, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import { useResolvedModal } from './use_modal.ts'

/**
 * Renders the modal using a native <dialog> element, which gives us focus
 * trapping, the top-layer/backdrop and Esc handling for free. Esc and
 * backdrop-clicks are gated by the `closeExplicitly` / `closeOnClickOutside`
 * config. Body scroll is locked while any modal is open.
 *
 * The default slot is a scoped slot receiving the modal instance:
 * `<Modal v-slot="{ props, close }">…</Modal>`.
 */
export const Modal = defineComponent({
  name: 'Modal',
  // Don't leak stray page props (passed through by the modal page component)
  // onto the <dialog> element as attributes.
  inheritAttrs: false,
  props: {
    /** When set, this is a local (client-only) modal opened via href="#name". */
    name: { type: String, required: false },
    closeButton: { type: Boolean, default: true },
  },
  emits: ['close'],
  setup(props, { slots, emit }) {
    const modal = useResolvedModal(props.name)
    const dialog = ref<HTMLDialogElement | null>(null)

    let closed = false
    let prevOverflow = ''
    let keydownHandler: ((event: KeyboardEvent) => void) | null = null

    const handleClose = () => {
      if (closed) return
      closed = true
      emit('close')
      modal.value?.close()
    }

    // Open / close the native dialog reacting to isOpen.
    watch(
      () => modal.value?.isOpen ?? false,
      (isOpen) => {
        const el = dialog.value
        if (!el) return
        if (isOpen && !el.open) {
          if (typeof el.showModal === 'function') {
            el.showModal()
            // Ensure focus lands inside the dialog.
            if (!el.contains(document.activeElement)) {
              el.querySelector<HTMLElement>(
                '[autofocus], button, [href], input, select, textarea'
              )?.focus()
            }
          } else {
            el.open = true // jsdom/happy-dom fallback
          }
        } else if (!isOpen && el.open) {
          if (typeof el.close === 'function') el.close()
          else el.open = false
        }
      },
      { immediate: true, flush: 'post' }
    )

    // Close on Esc for the top-most modal (unless closeExplicitly). Handled at
    // the document level so it works regardless of where focus currently is.
    watch(
      () => modal.value?.onTopOfStack ?? false,
      (isTop) => {
        if (typeof document === 'undefined') return
        if (keydownHandler) {
          document.removeEventListener('keydown', keydownHandler)
          keydownHandler = null
        }
        if (isTop) {
          keydownHandler = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && modal.value?.config.closeExplicitly !== true) {
              event.preventDefault()
              handleClose()
            }
          }
          document.addEventListener('keydown', keydownHandler)
        }
      },
      { immediate: true }
    )

    // Lock body scroll while open; restore on unmount.
    onMounted(() => {
      if (typeof document === 'undefined') return
      prevOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
    })

    onBeforeUnmount(() => {
      if (typeof document !== 'undefined') {
        document.body.style.overflow = prevOverflow
        if (keydownHandler) document.removeEventListener('keydown', keydownHandler)
      }
    })

    return () => {
      const m = modal.value
      if (!m) return null

      const isSlideover = m.config.slideover === true
      const position = typeof m.config.position === 'string' ? m.config.position : undefined
      const dialogClass = [
        'im-dialog',
        isSlideover ? 'im-slideover' : 'im-modal',
        position ? `im-position-${position}` : '',
      ]
        .filter(Boolean)
        .join(' ')

      const closeExplicitly = m.config.closeExplicitly === true
      const closeOnClickOutside = m.config.closeOnClickOutside !== false

      return h(
        'dialog',
        {
          'ref': dialog,
          'class': dialogClass,
          'data-modal-id': m.id,
          'data-modal-index': m.index,
          // Esc on a modal dialog fires `cancel`. Prevent the native auto-close
          // so we own the lifecycle, then close ourselves (unless closeExplicitly).
          'onCancel': (event: Event) => {
            event.preventDefault()
            if (!closeExplicitly) handleClose()
          },
          // Clicking the backdrop lands on the <dialog> element itself.
          'onClick': (event: MouseEvent) => {
            if (event.target === dialog.value && closeOnClickOutside && !closeExplicitly) {
              handleClose()
            }
          },
        },
        [
          h('div', { class: 'im-panel', onClick: (event: MouseEvent) => event.stopPropagation() }, [
            props.closeButton
              ? h(
                  'button',
                  {
                    'type': 'button',
                    'class': 'im-close-button',
                    'aria-label': 'Close',
                    'onClick': handleClose,
                  },
                  '×'
                )
              : null,
            slots.default?.(m),
          ]),
        ]
      )
    }
  },
})
