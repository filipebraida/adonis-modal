/*
|--------------------------------------------------------------------------
| Configure hook
|--------------------------------------------------------------------------
|
| The configure hook is called when someone runs "node ace configure <package>"
| command. You are free to perform any operations inside this function to
| configure the package.
|
*/

import type Configure from '@adonisjs/core/commands/configure'

export async function configure(command: Configure) {
  const codemods = await command.createCodemods()

  /**
   * Register the provider that extends `ctx.inertia` with `modal()`.
   */
  await codemods.updateRcFile((rcFile) => {
    rcFile.addProvider('adonis-modal/modal_provider')
  })

  /**
   * Manual frontend wiring can't be safely codemodded, so we print the steps.
   */
  command.logger.info('adonis-modal is configured. Finish the frontend wiring:')
  command.logger.log('')
  command.logger.log('  1. Wrap your app with <ModalStackProvider> in your Inertia entrypoint:')
  command.logger.log("       import { ModalStackProvider } from 'adonis-modal/react'")
  command.logger.log('       // <ModalStackProvider><App {...props} /></ModalStackProvider>')
  command.logger.log('')
  command.logger.log('  2. Render <ModalRoot /> once inside your app (e.g. in a layout):')
  command.logger.log("       import { ModalRoot } from 'adonis-modal/react'")
  command.logger.log('')
  command.logger.log('  3. Import the styles once (e.g. in your app entrypoint):')
  command.logger.log("       import 'adonis-modal/styles.css'")
}
