import { Config, Effect } from 'effect'
import type { Route } from '../http'

export const health: Route = Effect.gen(function* () {
  const version = yield* Config.string('GIT_SHA').pipe(Config.withDefault('dev'))
  return Response.json(
    { ok: true, version, time: new Date().toISOString() },
    { headers: { 'cache-control': 'no-store' } },
  )
}).pipe(Effect.withSpan('health'))
