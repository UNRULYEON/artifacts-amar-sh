import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'

export const getSession = createServerFn({ method: 'GET' }).handler(async () => {
  const { readSession } = await import('./session.server')
  const session = await readSession(getRequest().headers)
  if (!session) return null
  const { id, name, email, image } = session.user
  return { user: { id, name, email, image: image ?? null } }
})
