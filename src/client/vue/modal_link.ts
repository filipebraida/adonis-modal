/*
 * adonis-inertia-modal — Vue client
 */

import {
  computed,
  defineComponent,
  getCurrentInstance,
  h,
  onBeforeUnmount,
  onMounted,
  ref,
  type PropType,
} from 'vue'

import { getConfig } from '../core/config.ts'
import type { HttpMethod, ModalOptions } from '../core/types.ts'
import { useModalStack } from './context.ts'
import type { PrefetchMode, PrefetchOption } from './types.ts'

const LIFECYCLE_EVENTS = ['start', 'success', 'error', 'close', 'afterLeave']

/**
 * Opens a route in a modal. Like Inertia's <Link>, but the response is rendered
 * as a stacked modal over the current page.
 *
 * Any extra `@event` listeners (other than the lifecycle events emitted below)
 * are registered as event-bus listeners on the opened modal.
 */
export const ModalLink = defineComponent({
  name: 'ModalLink',
  inheritAttrs: false,
  props: {
    href: { type: String, required: true },
    method: { type: String as PropType<HttpMethod>, default: 'get' },
    data: { type: Object as PropType<Record<string, unknown>>, required: false },
    headers: { type: Object as PropType<Record<string, string>>, required: false },
    as: { type: [String, Object, Function] as PropType<unknown>, default: 'a' },
    /** Per-modal presentation overrides (maxWidth, position, panelClasses, ...). */
    config: { type: Object as PropType<ModalOptions>, required: false },
    /** Open as a slideover instead of a centered modal. */
    slideover: { type: Boolean, default: undefined },
    /** Prefetch the modal on hover/click/mount (true = hover). */
    prefetch: { type: [Boolean, String, Array] as PropType<PrefetchOption>, default: false },
    /** Prefetch cache lifetime in ms (default 30000). */
    cacheFor: { type: Number, default: 30000 },
    /** Push a browser-history entry so the Back button closes this modal. */
    history: { type: Boolean, default: undefined },
    /** Navigate to the route as a full page instead of opening a modal. */
    navigate: { type: Boolean, default: undefined },
  },
  emits: ['start', 'success', 'error', 'close', 'afterLeave', 'prefetching', 'prefetched'],
  setup(props, { slots, emit, attrs }) {
    const { visit, prefetch: prefetchModal, navigate: doNavigate } = useModalStack()
    const loading = ref(false)
    // Only forward onError when the parent actually listens to @error; otherwise
    // leave it undefined so the context's default (console.error) kicks in.
    const instance = getCurrentInstance()
    const hasErrorListener = () => !!instance?.vnode.props?.onError
    let hoverTimeout: ReturnType<typeof setTimeout> | null = null

    const prefetchModes = computed<PrefetchMode[]>(() => {
      if (props.prefetch === true) return ['hover']
      if (props.prefetch === false) return []
      return Array.isArray(props.prefetch) ? props.prefetch : [props.prefetch as PrefetchMode]
    })

    const doPrefetch = () => {
      emit('prefetching')
      prefetchModal(props.href, {
        method: props.method,
        data: props.data,
        headers: props.headers,
        cacheFor: props.cacheFor,
      })
        .then(() => emit('prefetched'))
        .catch(() => {})
    }

    onMounted(() => {
      if (prefetchModes.value.includes('mount')) doPrefetch()
    })

    onBeforeUnmount(() => {
      if (hoverTimeout) clearTimeout(hoverTimeout)
    })

    const handle = async (event?: MouseEvent) => {
      event?.preventDefault()
      if (loading.value) return

      // `navigate` mode: open the route as a full page instead of a modal.
      const navigateMode = props.navigate ?? (getConfig('navigate') as boolean | undefined) ?? false
      if (navigateMode && !props.href.startsWith('#')) {
        doNavigate(props.href)
        return
      }

      loading.value = true

      // Declared emits are consumed by Vue and not present in attrs; any
      // remaining on* function attrs are event-bus listeners.
      const listeners: Record<string, (...args: unknown[]) => void> = {}
      for (const [key, value] of Object.entries(attrs)) {
        if (key.startsWith('on') && typeof value === 'function') {
          const name = key.charAt(2).toLowerCase() + key.slice(3)
          if (!LIFECYCLE_EVENTS.includes(name)) {
            listeners[name] = value as (...args: unknown[]) => void
          }
        }
      }

      try {
        await visit(props.href, {
          method: props.method,
          data: props.data,
          headers: props.headers,
          config: {
            ...props.config,
            ...(props.slideover !== undefined ? { slideover: props.slideover } : {}),
          },
          history: props.history,
          onStart: () => emit('start'),
          onSuccess: () => emit('success'),
          onError: hasErrorListener() ? (error) => emit('error', error) : undefined,
          onClose: () => emit('close'),
          onAfterLeave: () => emit('afterLeave'),
          listeners,
        })
      } catch {
        // onError already emitted inside visit()
      } finally {
        loading.value = false
      }
    }

    const handleMouseEnter = () => {
      if (prefetchModes.value.includes('hover')) hoverTimeout = setTimeout(doPrefetch, 75)
    }
    const handleMouseLeave = () => {
      if (hoverTimeout) {
        clearTimeout(hoverTimeout)
        hoverTimeout = null
      }
    }
    const handleMouseDown = () => {
      if (prefetchModes.value.includes('click')) doPrefetch()
    }

    return () => {
      const domAttrs: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(attrs)) {
        if (!(key.startsWith('on') && typeof value === 'function')) domAttrs[key] = value
      }

      return h(
        props.as as never,
        {
          ...domAttrs,
          href: props.href,
          onClick: handle,
          onMouseenter: handleMouseEnter,
          onMouseleave: handleMouseLeave,
          onMousedown: handleMouseDown,
        },
        slots.default ? slots.default({ loading: loading.value }) : undefined
      )
    }
  },
})
