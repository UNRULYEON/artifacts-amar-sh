import { Effect } from 'effect'
import type { Route } from '../http'
import { CreateProject, Projects, UpdateProject } from '../services/projects'
import { currentUserId, jsonBody } from './helpers'

export function listProjects(request: Request): Route {
  return Effect.gen(function* () {
    const userId = yield* currentUserId(request)
    const projects = yield* Projects
    return Response.json(yield* projects.list(userId))
  })
}

export function createProject(request: Request): Route {
  return Effect.gen(function* () {
    const userId = yield* currentUserId(request)
    const input = yield* jsonBody(request, CreateProject)
    const projects = yield* Projects
    return Response.json(yield* projects.create(userId, input), { status: 201 })
  })
}

export function updateProject(request: Request, id: string): Route {
  return Effect.gen(function* () {
    const userId = yield* currentUserId(request)
    const patch = yield* jsonBody(request, UpdateProject)
    const projects = yield* Projects
    return Response.json(yield* projects.update(userId, id, patch))
  })
}

export function deleteProject(request: Request, id: string): Route {
  return Effect.gen(function* () {
    const userId = yield* currentUserId(request)
    const projects = yield* Projects
    yield* projects.remove(userId, id)
    return new Response(null, { status: 204 })
  })
}
