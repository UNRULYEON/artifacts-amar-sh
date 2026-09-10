import { Effect, Schema } from 'effect'
import { BadRequest } from '../errors'
import type { Route } from '../http'
import { Auth } from '../services/auth'
import { CreateProject, Projects, UpdateProject } from '../services/projects'

function jsonBody<A, I>(request: Request, schema: Schema.Schema<A, I>) {
  return Effect.tryPromise({
    try: () => request.json(),
    catch: () => new BadRequest({ message: 'Body must be JSON.' }),
  }).pipe(Effect.flatMap(Schema.decodeUnknown(schema)))
}

function currentUserId(request: Request) {
  return Effect.flatMap(Auth, (auth) => auth.requireSession(request)).pipe(
    Effect.map((session) => session.user.id),
  )
}

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
