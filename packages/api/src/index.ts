import { Hono } from 'hono'
import type { ApiEnv } from './env'
import { run } from './http'
import { authHandler, me } from './routes/auth'
import { serveBytes } from './routes/bytes'
import { health } from './routes/health'
import { createProject, deleteProject, listProjects, updateProject } from './routes/projects'
import { createToken, listTokens, revokeToken } from './routes/tokens'
import { upload } from './routes/upload'

export type { ApiEnv } from './env'
export { getRuntime, makeAppLayer, type AppServices } from './runtime'
export { Database } from './services/database'
export { Storage } from './services/storage'
export { Auth, type Session } from './services/auth'
export { Projects, type Project } from './services/projects'
export { Tokens, type Token } from './services/tokens'
export { Artifacts } from './services/artifacts'
export { Signer } from './services/signer'
export { Bindings } from './services/bindings'
export * from './errors'

export function createApi() {
  const app = new Hono<{ Bindings: ApiEnv }>()

  app.get('/api/health', (c) => run(c.env, health))
  app.on(['GET', 'POST'], '/api/auth/*', (c) => run(c.env, authHandler(c.req.raw)))
  app.get('/api/me', (c) => run(c.env, me(c.req.raw)))
  app.get('/api/projects', (c) => run(c.env, listProjects(c.req.raw)))
  app.post('/api/projects', (c) => run(c.env, createProject(c.req.raw)))
  app.patch('/api/projects/:id', (c) => run(c.env, updateProject(c.req.raw, c.req.param('id'))))
  app.delete('/api/projects/:id', (c) => run(c.env, deleteProject(c.req.raw, c.req.param('id'))))
  app.post('/api/upload', (c) => run(c.env, upload(c.req.raw)))
  app.get('/r/:id/:token/*', (c) => {
    const { id, token } = c.req.param()
    const prefix = `/r/${id}/${token}/`
    const path = new URL(c.req.url).pathname.slice(prefix.length)
    return run(c.env, serveBytes(c.req.raw, id, token, path))
  })
  app.get('/api/tokens', (c) => run(c.env, listTokens(c.req.raw)))
  app.post('/api/tokens', (c) => run(c.env, createToken(c.req.raw)))
  app.delete('/api/tokens/:id', (c) => run(c.env, revokeToken(c.req.raw, c.req.param('id'))))

  return app
}
