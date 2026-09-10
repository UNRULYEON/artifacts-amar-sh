import { Auth, Projects, getRuntime } from '@artifacts/api'
import { env } from 'cloudflare:workers'
import { Effect } from 'effect'

export function readProjects(headers: Headers) {
  return getRuntime(env).runPromise(
    Effect.gen(function* () {
      const auth = yield* Auth
      const session = yield* auth.session(headers)
      if (!session) return []
      const projects = yield* Projects
      return yield* projects.list(session.user.id)
    }),
  )
}
