import { Effect, Schema } from 'effect'
import { BadRequest } from '../errors'
import { Auth } from '../services/auth'

export function jsonBody<A, I>(request: Request, schema: Schema.Schema<A, I>) {
  return Effect.tryPromise({
    try: () => request.json(),
    catch: () => new BadRequest({ message: 'Body must be JSON.' }),
  }).pipe(Effect.flatMap(Schema.decodeUnknown(schema)))
}

export function currentUserId(request: Request) {
  return Effect.flatMap(Auth, (auth) => auth.requireSession(request)).pipe(
    Effect.map((session) => session.user.id),
  )
}
