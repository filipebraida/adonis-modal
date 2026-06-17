import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { assert } from '@japa/assert'
import { configure, processCLIArgs, run } from '@japa/runner'

// Register a DOM so React component tests can run under Node.
GlobalRegistrator.register()

processCLIArgs(process.argv.splice(2))

configure({
  files: ['tests/**/*.spec.ts', 'tests/**/*.spec.tsx'],
  plugins: [assert()],
})

run()
