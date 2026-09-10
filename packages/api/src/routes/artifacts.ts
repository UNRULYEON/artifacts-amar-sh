import { Effect } from 'effect'
import type { Route } from '../http'
import { Artifacts } from '../services/artifacts'
import { Projects } from '../services/projects'
import { currentUserId } from './helpers'

export function listArtifacts(request: Request, projectId: string): Route {
  return Effect.gen(function* () {
    const userId = yield* currentUserId(request)
    const projects = yield* Projects
    yield* projects.get(userId, projectId)
    const artifacts = yield* Artifacts
    return Response.json(yield* artifacts.listByProject(projectId))
  })
}

export function deleteArtifact(request: Request, id: string): Route {
  return Effect.gen(function* () {
    const userId = yield* currentUserId(request)
    const artifacts = yield* Artifacts
    yield* artifacts.remove(userId, id)
    return new Response(null, { status: 204 })
  })
}
