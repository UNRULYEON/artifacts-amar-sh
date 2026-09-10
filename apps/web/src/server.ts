import handler from '@tanstack/react-start/server-entry'
import { createApi, sweep } from '@artifacts/api'

const api = createApi()
api.notFound((c) => handler.fetch(c.req.raw))

export default {
  fetch(request, env, ctx) {
    return api.fetch(request, env, ctx)
  },
  scheduled(_controller, env, ctx) {
    ctx.waitUntil(sweep(env))
  },
} satisfies ExportedHandler<Env>
