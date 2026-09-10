import { Artifacts, Auth, Projects, getRuntime } from '@artifacts/api'
import { env } from 'cloudflare:workers'
import { Effect } from 'effect'
import type { ProjectView } from './project'

export function readProject(
  headers: Headers,
  origin: string,
  id: string,
): Promise<ProjectView | null> {
  return getRuntime(env).runPromise(
    Effect.gen(function* () {
      const auth = yield* Auth
      const session = yield* auth.session(headers)
      if (!session) return null
      const projects = yield* Projects
      const row = yield* projects
        .get(session.user.id, id)
        .pipe(Effect.catchTag('NotFound', () => Effect.succeed(null)))
      if (!row) return null
      const artifacts = yield* Artifacts
      return {
        origin,
        project: {
          id: row.id,
          name: row.name,
          displayName: row.displayName,
          ttlSeconds: row.ttlSeconds,
          createdAt: row.createdAt.toISOString(),
        },
        artifacts: yield* artifacts.listByProject(row.id),
      }
    }),
  )
}
