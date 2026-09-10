import { Effect } from 'effect'
import type { Route } from '../http'
import { CreateToken, Tokens } from '../services/tokens'
import { currentUserId, jsonBody } from './helpers'

export function listTokens(request: Request): Route {
  return Effect.gen(function* () {
    const userId = yield* currentUserId(request)
    const tokens = yield* Tokens
    return Response.json(yield* tokens.list(userId))
  })
}

export function createToken(request: Request): Route {
  return Effect.gen(function* () {
    const userId = yield* currentUserId(request)
    const input = yield* jsonBody(request, CreateToken)
    const tokens = yield* Tokens
    return Response.json(yield* tokens.create(userId, input), { status: 201 })
  })
}

export function revokeToken(request: Request, id: string): Route {
  return Effect.gen(function* () {
    const userId = yield* currentUserId(request)
    const tokens = yield* Tokens
    yield* tokens.revoke(userId, id)
    return new Response(null, { status: 204 })
  })
}
