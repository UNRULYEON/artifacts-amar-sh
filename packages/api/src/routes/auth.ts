import { Effect } from 'effect'
import type { Route } from '../http'
import { Auth } from '../services/auth'

export function authHandler(request: Request): Route {
  return Effect.flatMap(Auth, (auth) => auth.handle(request))
}

export function me(request: Request): Route {
  return Effect.gen(function* () {
    const auth = yield* Auth
    const { user } = yield* auth.requireSession(request)
    return Response.json({ id: user.id, name: user.name, email: user.email, image: user.image })
  })
}
