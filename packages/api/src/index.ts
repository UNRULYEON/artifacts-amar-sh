import { Cause, Effect } from 'effect'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { ApiEnv } from './env'
import { isContentOrigin } from './content'
import { run } from './http'
import { getRuntime } from './runtime'
import { Retention, type SweepResult } from './services/retention'
import { authHandler, me } from './routes/auth'
import { deleteArtifact, listArtifacts } from './routes/artifacts'
import { serveBytes } from './routes/bytes'
import { health } from './routes/health'
import { help } from './routes/help'
import { createProject, deleteProject, listProjects, updateProject } from './routes/projects'
import { mcpGet, mcpRoute } from './routes/mcp'
import { getSettings, updateSettings } from './routes/settings'
import { createToken, listTokens, revokeToken } from './routes/tokens'
import { createUploadTicket, upload, uploadWithTicket } from './routes/upload'

export type { ApiEnv } from './env'
export { getRuntime, makeAppLayer, type AppServices } from './runtime'
export { Database } from './services/database'
export { Storage } from './services/storage'
export { Auth, type Session } from './services/auth'
export { Projects, type Project } from './services/projects'
export { Tokens, type Token } from './services/tokens'
export { Artifacts, type ArtifactSummary } from './services/artifacts'
export { Signer } from './services/signer'
export { SettingsService, type Settings } from './services/settings'
export { Retention, type SweepResult } from './services/retention'
export { Tickets } from './services/tickets'
export { Bindings } from './services/bindings'
export { comparePairs, type ComparePair } from './zip'
export { embedUrl } from './embed'
export { contentOrigin } from './content'
export * from './errors'

// Cron entry. Errors are logged, never thrown, so the trigger stays healthy.
export function sweep(env: ApiEnv): Promise<SweepResult | null> {
  return getRuntime(env).runPromise(
    Effect.flatMap(Retention, (r) => r.sweep()).pipe(
      Effect.catchAllCause((cause) =>
        Effect.logError('sweep failed', Cause.pretty(cause)).pipe(Effect.as(null)),
      ),
    ),
  )
}

export function createApi() {
  const app = new Hono<{ Bindings: ApiEnv }>()

  // The content origin serves artifact bytes and nothing else.
  app.use('*', async (c, next) => {
    if (isContentOrigin(c.req.raw, c.env.CONTENT_URL) && !c.req.path.startsWith('/r/')) {
      return c.text('Not found.', 404)
    }
    await next()
  })

  // Browser-based MCP clients need CORS on discovery, the OAuth endpoints, and the MCP route.
  const open = cors({
    origin: '*',
    allowMethods: ['GET', 'HEAD', 'POST', 'OPTIONS'],
    allowHeaders: [
      'Authorization',
      'Content-Type',
      'Mcp-Protocol-Version',
      'Mcp-Session-Id',
      'DPoP',
    ],
    exposeHeaders: ['WWW-Authenticate', 'Mcp-Session-Id'],
  })
  app.use('/mcp', open)
  app.use('/.well-known/*', open)
  app.use('/api/auth/oauth2/*', open)
  app.use('/api/auth/jwks', open)

  app.get('/api/health', (c) => run(c.env, health))
  app.get('/api/help', (c) => run(c.env, help(c.req.raw)))
  app.on(['GET', 'POST'], '/api/auth/*', (c) => run(c.env, authHandler(c.req.raw)))
  app.on(['GET', 'HEAD'], '/.well-known/*', (c) => run(c.env, authHandler(c.req.raw)))
  app.post('/mcp', (c) => mcpRoute(c.env, c.req.raw))
  app.get('/mcp', (c) => mcpGet(c.req.raw))
  app.delete(
    '/mcp',
    () => new Response('Method not allowed.', { status: 405, headers: { allow: 'POST' } }),
  )
  app.get('/api/me', (c) => run(c.env, me(c.req.raw)))
  app.get('/api/projects', (c) => run(c.env, listProjects(c.req.raw)))
  app.post('/api/projects', (c) => run(c.env, createProject(c.req.raw)))
  app.patch('/api/projects/:id', (c) => run(c.env, updateProject(c.req.raw, c.req.param('id'))))
  app.delete('/api/projects/:id', (c) => run(c.env, deleteProject(c.req.raw, c.req.param('id'))))
  app.get('/api/projects/:id/artifacts', (c) =>
    run(c.env, listArtifacts(c.req.raw, c.req.param('id'))),
  )
  app.delete('/api/artifacts/:id', (c) => run(c.env, deleteArtifact(c.req.raw, c.req.param('id'))))
  app.post('/api/upload', (c) => run(c.env, upload(c.req.raw)))
  app.post('/api/upload-tickets', (c) => run(c.env, createUploadTicket(c.req.raw)))
  app.put('/u/:ticket', (c) => run(c.env, uploadWithTicket(c.req.raw, c.req.param('ticket'))))
  app.get('/r/:id/:token/*', (c) => {
    const { id, token } = c.req.param()
    const prefix = `/r/${id}/${token}/`
    const path = new URL(c.req.url).pathname.slice(prefix.length)
    return run(c.env, serveBytes(c.req.raw, id, token, path))
  })
  app.get('/api/settings', (c) => run(c.env, getSettings(c.req.raw)))
  app.patch('/api/settings', (c) => run(c.env, updateSettings(c.req.raw)))
  app.get('/api/tokens', (c) => run(c.env, listTokens(c.req.raw)))
  app.post('/api/tokens', (c) => run(c.env, createToken(c.req.raw)))
  app.delete('/api/tokens/:id', (c) => run(c.env, revokeToken(c.req.raw, c.req.param('id'))))

  return app
}
