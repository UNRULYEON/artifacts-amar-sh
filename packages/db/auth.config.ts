import { cimd } from '@better-auth/cimd'
import { mcp } from '@better-auth/mcp'
import type { BetterAuthOptions } from 'better-auth'
import { jwt } from 'better-auth/plugins'

// Only for `bun run generate:auth`. The real instance lives in packages/api.
// Plain options, not betterAuth(): the plugins' init needs a live database.
export const options = {
  baseURL: 'https://artifacts.amar.sh',
  user: {
    additionalFields: {
      githubId: { type: 'string', required: true },
      defaultTtlSeconds: { type: 'number', required: false, input: false },
    },
  },
  plugins: [
    jwt(),
    mcp({
      loginPage: '/login',
      consentPage: '/consent',
      resource: 'https://artifacts.amar.sh/mcp',
    }),
    cimd({ fetchClientMetadataResource: fetch, metadataProfile: 'mcp-2026-07-28' }),
  ],
} satisfies BetterAuthOptions
