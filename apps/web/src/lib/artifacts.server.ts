import {
  Artifacts,
  Auth,
  Projects,
  Signer,
  comparePairs,
  embedUrl,
  getRuntime,
} from '@artifacts/api'
import { env } from 'cloudflare:workers'
import { Effect } from 'effect'
import type { ArtifactView } from './artifacts'

// The viewer gate: a session is required, ownership is not checked.
export function readArtifact(request: Request, id: string): Promise<ArtifactView | null> {
  return getRuntime(env).runPromise(
    Effect.gen(function* () {
      const auth = yield* Auth
      if (!(yield* auth.session(request.headers))) return null
      const artifacts = yield* Artifacts
      const artifact = yield* artifacts
        .get(id)
        .pipe(Effect.catchTag('NotFound', () => Effect.succeed(null)))
      if (!artifact) return null

      const projects = yield* Projects
      const project = yield* projects
        .get(artifact.userId, artifact.projectId)
        .pipe(Effect.catchTag('NotFound', () => Effect.succeed(null)))
      const signer = yield* Signer
      const token = yield* signer.sign(id)
      const entries =
        artifact.kind === 'bundle' || artifact.kind === 'compare' ? yield* artifacts.files(id) : []
      const prefix = artifact.rootPath === '' ? '' : `${artifact.rootPath}/`
      const files = entries
        .filter((e) => e.path.startsWith(prefix))
        .map((e) => ({ path: e.path.slice(prefix.length), size: e.size }))

      return {
        id,
        name: artifact.name,
        kind: artifact.kind,
        size: artifact.size,
        createdAt: artifact.createdAt.toISOString(),
        expiresAt: artifact.expiresAt.toISOString(),
        project: project && {
          id: project.id,
          name: project.name,
          displayName: project.displayName,
        },
        base: `/r/${id}/${token}`,
        files,
        hasIndex: files.some((f) => f.path === 'index.html'),
        compare: artifact.kind === 'compare' ? comparePairs(entries) : null,
        embedUrl: yield* embedUrl(new URL(request.url).origin, artifact),
      }
    }),
  )
}
