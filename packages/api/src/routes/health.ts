import { SqlClient } from '@effect/sql'
import { Config, Duration, Effect } from 'effect'
import type { Route } from '../http'
import { Storage } from '../services/storage'

type Check = { ok: true; ms: number } | { ok: false; error: string }

// A failed probe is data in the response, not a failure of the route.
function check<E, R>(
  name: string,
  probe: Effect.Effect<unknown, E, R>,
): Effect.Effect<Check, never, R> {
  return probe.pipe(
    Effect.timed,
    Effect.map(([elapsed]): Check => ({ ok: true, ms: Math.round(Duration.toMillis(elapsed)) })),
    Effect.timeoutFail({ duration: '3 seconds', onTimeout: () => new Error('timeout') }),
    Effect.catchAll((e) =>
      Effect.logWarning(`health check failed: ${name}`, e).pipe(
        Effect.as<Check>({ ok: false, error: e instanceof Error ? e.message : String(e) }),
      ),
    ),
    Effect.withSpan(`health.${name}`),
  )
}

const d1 = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient
  return yield* sql`select 1`
})

const r2 = Effect.gen(function* () {
  const storage = yield* Storage
  return yield* storage.head('.healthcheck')
})

export const health: Route = Effect.gen(function* () {
  const [version, checks] = yield* Effect.all([
    Config.string('GIT_SHA').pipe(Config.withDefault('dev')),
    Effect.all({ d1: check('d1', d1), r2: check('r2', r2) }, { concurrency: 'unbounded' }),
  ])
  const ok = Object.values(checks).every((c) => c.ok)
  return Response.json(
    { ok, version, time: new Date().toISOString(), checks },
    { status: ok ? 200 : 503, headers: { 'cache-control': 'no-store' } },
  )
}).pipe(Effect.withSpan('health'))
