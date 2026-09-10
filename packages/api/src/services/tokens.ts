import { schema } from '@artifacts/db'
import { and, desc, eq } from 'drizzle-orm'
import { Effect, Schema } from 'effect'
import { NotFound, Unauthorized } from '../errors'
import { newId } from '../id'
import { Database } from './database'

export const TokenName = Schema.Trim.pipe(Schema.minLength(1), Schema.maxLength(64))

export const CreateToken = Schema.Struct({ name: TokenName })
export type CreateToken = typeof CreateToken.Type

export interface Token {
  id: string
  name: string
  createdAt: string
  lastUsedAt: string | null
}

export interface TokenIdentity {
  userId: string
  tokenId: string
}

const { token } = schema

// art_ + 32 random bytes. The prefix is for secret scanners.
export function newSecret() {
  return newId('art', 32)
}

export function isSecretShape(value: string) {
  return /^art_[A-Za-z0-9_-]{43}$/.test(value)
}

export async function hashSecret(secret: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret))
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

export function bearer(request: Request) {
  const value = request.headers.get('authorization') ?? ''
  return value.startsWith('Bearer ') ? value.slice(7).trim() : null
}

function toToken(row: typeof token.$inferSelect): Token {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.createdAt.toISOString(),
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
  }
}

export class Tokens extends Effect.Service<Tokens>()('@artifacts/api/Tokens', {
  effect: Effect.gen(function* () {
    const db = yield* Database

    function list(userId: string) {
      return db
        .select()
        .from(token)
        .where(eq(token.userId, userId))
        .orderBy(desc(token.createdAt))
        .pipe(
          Effect.map((rows) => rows.map(toToken)),
          Effect.withSpan('Tokens.list'),
        )
    }

    function create(userId: string, input: CreateToken) {
      return Effect.gen(function* () {
        const secret = newSecret()
        const hash = yield* Effect.promise(() => hashSecret(secret))
        const rows = yield* db
          .insert(token)
          .values({ id: newId('tok'), userId, name: input.name, hash, createdAt: new Date() })
          .returning()
        return { ...toToken(rows[0]!), token: secret }
      }).pipe(Effect.withSpan('Tokens.create'))
    }

    function revoke(userId: string, id: string) {
      return db
        .delete(token)
        .where(and(eq(token.userId, userId), eq(token.id, id)))
        .returning({ id: token.id })
        .pipe(
          Effect.flatMap((rows) =>
            rows.length === 0 ? new NotFound({ message: 'Token not found.' }) : Effect.void,
          ),
          Effect.withSpan('Tokens.revoke'),
        )
    }

    // Resolves a bearer secret to its owner and records the use.
    function requireBearer(request: Request) {
      return Effect.gen(function* () {
        const secret = bearer(request)
        if (!secret || !isSecretShape(secret)) {
          return yield* new Unauthorized({ message: 'A bearer token is required.' })
        }
        const hash = yield* Effect.promise(() => hashSecret(secret))
        const rows = yield* db.select().from(token).where(eq(token.hash, hash)).limit(1)
        const row = rows[0]
        if (!row) return yield* new Unauthorized({ message: 'Invalid token.' })
        yield* db.update(token).set({ lastUsedAt: new Date() }).where(eq(token.id, row.id))
        return { userId: row.userId, tokenId: row.id } satisfies TokenIdentity
      }).pipe(Effect.withSpan('Tokens.requireBearer'))
    }

    return { list, create, revoke, requireBearer }
  }),
}) {}
