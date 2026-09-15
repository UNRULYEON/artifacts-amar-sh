import { describe, expect, test } from 'bun:test'
import type { ApiEnv } from '../src/env'
import { createApi } from '../src/index'

const env = { APP_URL: 'https://app.test', CONTENT_URL: 'https://content.test' } as ApiEnv

describe('content origin gate', () => {
  test('the content origin answers 404 outside /r/', async () => {
    const app = createApi()
    for (const path of ['/', '/login', '/api/help', '/mcp', '/api/projects']) {
      const res = await app.request(`https://content.test${path}`, {}, env)
      expect(res.status).toBe(404)
      expect(await res.text()).toBe('Not found.')
    }
  })

  test('the app origin still serves the API', async () => {
    const res = await createApi().request('https://app.test/api/help', {}, env)
    expect(res.status).toBe(200)
  })

  test('without CONTENT_URL nothing is gated', async () => {
    const res = await createApi().request('https://content.test/api/help', {}, {
      APP_URL: 'https://app.test',
    } as ApiEnv)
    expect(res.status).toBe(200)
  })
})
