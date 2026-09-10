import { Auth, Tokens, getRuntime } from '@artifacts/api'
import { env } from 'cloudflare:workers'
import { Effect } from 'effect'

export function readTokens(headers: Headers) {
  return getRuntime(env).runPromise(
    Effect.gen(function* () {
      const auth = yield* Auth
      const session = yield* auth.session(headers)
      if (!session) return []
      const tokens = yield* Tokens
      return yield* tokens.list(session.user.id)
    }),
  )
}
