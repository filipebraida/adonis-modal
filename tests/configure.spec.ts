import { test } from '@japa/runner'

import { configure } from '../configure.ts'

/**
 * Lightweight test of the configure hook: a fake Configure command records the
 * codemods calls, so we verify the provider registration without booting a full
 * app.
 */
function fakeCommand() {
  const providers: string[] = []
  const codemods = {
    async updateRcFile(callback: (rc: { addProvider: (provider: string) => void }) => void) {
      callback({ addProvider: (provider) => providers.push(provider) })
    },
  }
  const command = {
    createCodemods: async () => codemods,
    logger: { info: () => {}, log: () => {} },
  }
  return { command, providers }
}

test.group('configure', () => {
  test('registers the modal provider', async ({ assert }) => {
    const { command, providers } = fakeCommand()

    await configure(command as never)

    assert.include(providers, 'adonis-inertia-modal/modal_provider')
  })
})
