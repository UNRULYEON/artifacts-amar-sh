import { schema } from '@artifacts/db'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { APIError } from 'better-auth/api'
import { Config, Effect, Redacted } from 'effect'
import { Forbidden, Unauthorized } from '../errors'
import { Database } from './database'

interface AuthOptions {
  db: Database['Type']
  appUrl: string
  secret: string
  github: { clientId: string; clientSecret: string }
  ownerGithubId: string
}

// CSRF guard for cookie-authenticated mutations. Browsers always send Origin on
// these, and the origin must be the host that served the page.
export function isSameOrigin(request: Request) {
  return request.headers.get('origin') === new URL(request.url).origin
}

export function assertOwner(githubId: unknown, ownerGithubId: string) {
  if (githubId !== ownerGithubId) {
    throw new APIError('FORBIDDEN', { message: 'Sign up is closed.' })
  }
}

function makeInstance({ db, appUrl, secret, github, ownerGithubId }: AuthOptions) {
  return betterAuth({
    baseURL: appUrl,
    secret,
    trustedOrigins: [appUrl],
    database: drizzleAdapter(db, { provider: 'sqlite', schema }),
    user: {
      // input:false would drop the value that mapProfileToUser sets.
      additionalFields: {
        githubId: { type: 'string', required: true },
        defaultTtlSeconds: { type: 'number', required: false, input: false },
      },
    },
    socialProviders: {
      github: {
        clientId: github.clientId,
        clientSecret: github.clientSecret,
        mapProfileToUser(profile) {
          return { githubId: String(profile.id) }
        },
      },
    },
    databaseHooks: {
      user: {
        create: {
          async before(user) {
            assertOwner(user.githubId, ownerGithubId)
          },
        },
        update: {
          async before(data) {
            if ('githubId' in data) {
              throw new APIError('FORBIDDEN', { message: 'githubId cannot change.' })
            }
          },
        },
      },
    },
    onAPIError: { errorURL: '/login' },
  })
}

type Instance = ReturnType<typeof makeInstance>
export type Session = NonNullable<Awaited<ReturnType<Instance['api']['getSession']>>>

const readConfig = Config.all({
  appUrl: Config.string('APP_URL'),
  secret: Config.redacted('BETTER_AUTH_SECRET'),
  github: Config.all({
    clientId: Config.string('GITHUB_CLIENT_ID'),
    clientSecret: Config.redacted('GITHUB_CLIENT_SECRET'),
  }),
  ownerGithubId: Config.string('OWNER_GITHUB_ID'),
})

export class Auth extends Effect.Service<Auth>()('@artifacts/api/Auth', {
  effect: Effect.gen(function* () {
    const db = yield* Database
    // Config is read on first use so a missing secret only breaks auth routes.
    const instance = yield* Effect.cached(
      Effect.map(readConfig, (c) =>
        makeInstance({
          db,
          appUrl: c.appUrl,
          secret: Redacted.value(c.secret),
          github: {
            clientId: c.github.clientId,
            clientSecret: Redacted.value(c.github.clientSecret),
          },
          ownerGithubId: c.ownerGithubId,
        }),
      ),
    )

    function handle(request: Request) {
      return instance.pipe(
        Effect.flatMap((auth) => Effect.promise(() => auth.handler(request))),
        Effect.withSpan('Auth.handle'),
      )
    }

    function session(headers: Headers) {
      return instance.pipe(
        Effect.flatMap((auth) => Effect.promise(() => auth.api.getSession({ headers }))),
        Effect.withSpan('Auth.session'),
      )
    }

    function requireSession(request: Request) {
      return Effect.gen(function* () {
        const current = yield* session(request.headers)
        if (!current) return yield* new Unauthorized({ message: 'Sign in required.' })
        if (request.method !== 'GET' && request.method !== 'HEAD' && !isSameOrigin(request)) {
          return yield* new Forbidden({ message: 'Bad origin.' })
        }
        return current
      })
    }

    return { handle, session, requireSession }
  }),
}) {}
