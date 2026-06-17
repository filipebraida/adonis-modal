import { test } from '@japa/runner'
import { InertiaFactory } from '@adonisjs/inertia/factories'

import { resolveModalProps } from '../src/resolve_modal_props.ts'

// A real Inertia instance, only used to create real prop wrappers
// (defer/optional/always/merge) so we test against their actual shapes.
const inertia = new InertiaFactory().create() as any

test.group('resolveModalProps | standard visit', () => {
  test('omits deferred/optional, unwraps always, resolves functions and dot-props', async ({
    assert,
  }) => {
    const resolved = await resolveModalProps({
      'user': { id: 1 },
      'stats': inertia.defer(() => ({ visits: 10 })),
      'audit': inertia.optional(() => ['entry']),
      'perms': inertia.always(['read']),
      'lazy': () => 'computed',
      'nested.a': 1,
    })

    assert.deepEqual(resolved.props.user, { id: 1 })
    assert.notProperty(resolved.props, 'stats') // deferred omitted on standard visit
    assert.notProperty(resolved.props, 'audit') // optional omitted on standard visit
    assert.deepEqual(resolved.props.perms, ['read']) // always unwrapped
    assert.equal(resolved.props.lazy, 'computed') // function resolved
    assert.deepEqual(resolved.props.nested, { a: 1 }) // dot-notation nested
    assert.deepEqual(resolved.deferred, { default: ['stats'] })
  })

  test('marks merge props and unwraps their value', async ({ assert }) => {
    const resolved = await resolveModalProps({
      items: inertia.merge([1, 2]),
      settings: inertia.deepMerge({ a: 1 }),
    })

    assert.deepEqual(resolved.props.items, [1, 2])
    assert.deepEqual(resolved.props.settings, { a: 1 })
    assert.deepEqual(resolved.mergeProps, ['items'])
    assert.deepEqual(resolved.deepMergeProps, ['settings'])
  })
})

test.group('resolveModalProps | partial reload', () => {
  test('computes only the requested deferred/optional props', async ({ assert }) => {
    const resolved = await resolveModalProps(
      {
        user: { id: 1 },
        stats: inertia.defer(() => ({ visits: 10 })),
        audit: inertia.optional(() => ['entry']),
      },
      { partial: true, only: ['stats'] }
    )

    assert.deepEqual(resolved.props, { stats: { visits: 10 } })
    assert.notProperty(resolved.props, 'user')
    assert.notProperty(resolved.props, 'audit')
    assert.deepEqual(resolved.deferred, {})
  })
})
