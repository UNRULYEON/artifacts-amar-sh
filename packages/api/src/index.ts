import { Hono } from 'hono'
import type { ApiEnv } from './env'
import { run } from './http'
import { health } from './routes/health'

export type { ApiEnv } from './env'
export { getRuntime, makeAppLayer, type AppServices } from './runtime'
export { Database } from './services/database'
export { Storage } from './services/storage'
export { Bindings } from './services/bindings'
export * from './errors'

export function createApi() {
  const app = new Hono<{ Bindings: ApiEnv }>()

  app.get('/api/health', (c) => run(c.env, health))

  return app
}
