import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'

// Only for `auth generate`. The real instance lives in packages/api.
export const auth = betterAuth({
  database: drizzleAdapter({} as never, { provider: 'sqlite' }),
  user: {
    additionalFields: {
      githubId: { type: 'string', required: true },
    },
  },
})
