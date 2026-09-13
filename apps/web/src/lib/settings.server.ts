import { Auth, SettingsService, Tokens, getRuntime } from '@artifacts/api'
import { env } from 'cloudflare:workers'
import { Effect } from 'effect'
import type { SettingsView } from './settings'

export function readSettingsView(headers: Headers): Promise<Omit<SettingsView, 'origin'> | null> {
  return getRuntime(env).runPromise(
    Effect.gen(function* () {
      const auth = yield* Auth
      const session = yield* auth.session(headers)
      if (!session) return null
      const settings = yield* SettingsService
      const tokens = yield* Tokens
      return yield* Effect.all({
        settings: settings.get(session.user.id),
        tokens: tokens.list(session.user.id),
      })
    }),
  )
}
