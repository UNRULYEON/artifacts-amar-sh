import handler from '@tanstack/react-start/server-entry'
import { createApi } from '@artifacts/api'

const api = createApi()
api.notFound((c) => handler.fetch(c.req.raw))

export default {
  fetch(request, env, ctx) {
    return api.fetch(request, env, ctx)
  },
  async scheduled() {},
} satisfies ExportedHandler<Env>
