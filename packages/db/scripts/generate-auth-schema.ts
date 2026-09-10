import { generateDrizzleSchema } from '@better-auth/cli/api'
import { options } from '../auth.config'

// Same output as `better-auth generate`, without booting the plugins.
const result = await generateDrizzleSchema({
  options,
  file: 'src/auth-schema.ts',
  adapter: { id: 'drizzle', options: { provider: 'sqlite' } } as never,
})
if (!result.code) throw new Error('No schema generated.')
await Bun.write('src/auth-schema.ts', result.code)
process.stdout.write(`wrote src/auth-schema.ts (${result.code.split('\n').length} lines)\n`)
