import { Auth, getRuntime } from '@artifacts/api'
import { env } from 'cloudflare:workers'
import { Effect } from 'effect'

// A broken auth setup (missing secret) reads as "no session" so pages still render.
export function readSession(headers: Headers) {
  return getRuntime(env).runPromise(
    Effect.flatMap(Auth, (auth) => auth.session(headers)).pipe(
      Effect.catchAll((e) => Effect.logError('session lookup failed', e).pipe(Effect.as(null))),
    ),
  )
}
