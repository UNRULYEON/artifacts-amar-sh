import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import type { Token } from '@artifacts/api'

export const getTokens = createServerFn({ method: 'GET' }).handler(async (): Promise<Token[]> => {
  const { readTokens } = await import('./tokens.server')
  return readTokens(getRequest().headers)
})
