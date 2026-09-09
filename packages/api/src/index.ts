import { Hono } from 'hono'
import type { ApiEnv } from './env'
import { run } from './http'
import { health } from './routes/health'

export type { ApiEnv } from './env'
export { getRuntime, makeAppLayer, type AppServices } from './runtime'
export { Database } from './services/Database'
export { Storage } from './services/Storage'
export { Bindings } from './services/Bindings'
export * from './errors'

// Hono does routing only. Each handler runs an Effect through `run`, which
// provides the app services and closes the error channel.
export function createApi() {
  const app = new Hono<{ Bindings: ApiEnv }>()

  app.get('/api/health', (c) => run(c.env, health))

  return app
}
