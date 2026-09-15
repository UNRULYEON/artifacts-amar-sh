import { Effect } from 'effect'
import { apiHelp } from '../guide'
import type { Route } from '../http'
import { Projects } from '../services/projects'
import { Tokens } from '../services/tokens'

// Open to everyone. A valid token adds its projects.
export function help(request: Request): Route {
  return Effect.gen(function* () {
    const origin = new URL(request.url).origin
    const token = request.headers.has('authorization')
      ? yield* Effect.flatMap(Tokens, (tokens) => tokens.requireBearer(request)).pipe(
          Effect.flatMap((identity) => Effect.flatMap(Projects, (p) => p.list(identity.userId))),
          Effect.map((projects) => ({
            projects: projects.map((p) => ({ id: p.id, name: p.name })),
          })),
          Effect.catchTag('Unauthorized', () => Effect.succeed('invalid' as const)),
        )
      : ('missing' as const)
    return new Response(apiHelp(origin, token), {
      headers: { 'content-type': 'text/markdown; charset=utf-8', 'cache-control': 'no-store' },
    })
  }).pipe(Effect.withSpan('help'))
}
