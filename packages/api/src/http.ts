import type { SqlError } from '@effect/sql/SqlError'
import { Cause, Effect, Match, ParseResult } from 'effect'
import type { ConfigError } from 'effect/ConfigError'
import type { ParseError } from 'effect/ParseResult'
import type { ApiEnv } from './env'
import type { HttpFailure, StorageError } from './errors'
import { getRuntime, type AppServices } from './runtime'

// A route handler is an Effect that produces a Response. Its failure channel
// is closed here: known failures become status codes, everything else is 500.
export type RouteFailure = HttpFailure | ParseError | SqlError | StorageError | ConfigError
export type Route<R = AppServices> = Effect.Effect<Response, RouteFailure, R>

const json = (body: unknown, status: number) => Response.json(body, { status })

const failureToResponse = Match.type<RouteFailure>().pipe(
  Match.tag('BadRequest', (e) => Effect.succeed(json({ error: e.message }, 400))),
  Match.tag('Unauthorized', (e) => Effect.succeed(json({ error: e.message }, 401))),
  Match.tag('Forbidden', (e) => Effect.succeed(json({ error: e.message }, 403))),
  Match.tag('NotFound', (e) => Effect.succeed(json({ error: e.message }, 404))),
  Match.tag('Conflict', (e) => Effect.succeed(json({ error: e.message }, 409))),
  Match.tag('PayloadTooLarge', (e) => Effect.succeed(json({ error: e.message }, 413))),
  Match.tag('ParseError', (e) =>
    Effect.succeed(json({ error: ParseResult.TreeFormatter.formatErrorSync(e) }, 400)),
  ),
  Match.tag('SqlError', 'StorageError', 'ConfigError', (e) =>
    Effect.logError('request failed', e).pipe(Effect.as(json({ error: 'internal error' }, 500))),
  ),
  Match.exhaustive,
)

export const run = (env: ApiEnv, route: Route): Promise<Response> =>
  getRuntime(env).runPromise(
    route.pipe(
      Effect.catchAll(failureToResponse),
      Effect.catchAllCause((cause) =>
        Effect.logError('request crashed', Cause.pretty(cause)).pipe(
          Effect.as(json({ error: 'internal error' }, 500)),
        ),
      ),
    ),
  )
