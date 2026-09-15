import { describe, expect, test } from 'bun:test'
import { mcpGet, withGuide } from '../src/routes/mcp'

const origin = 'https://artifacts.amar.sh'

describe('mcpGet', () => {
  test('answers a plain GET with the guide', async () => {
    const res = mcpGet(new Request(`${origin}/mcp`))
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/markdown')
    const body = await res.text()
    expect(body).toContain(`"${origin}/api/upload?project=<project>&name=report.zip"`)
    expect(body).toContain('`upload_comparison`')
  })

  test('refuses an event stream', () => {
    const res = mcpGet(new Request(`${origin}/mcp`, { headers: { accept: 'text/event-stream' } }))
    expect(res.status).toBe(405)
  })
})

describe('withGuide', () => {
  test('adds the guide to a 401 and keeps the challenge header', async () => {
    const challenge = 'Bearer resource_metadata="https://artifacts.amar.sh/.well-known/x"'
    const res = await withGuide(
      Response.json(
        { jsonrpc: '2.0', error: { code: -32000, message: 'Unauthorized' }, id: null },
        { status: 401, headers: { 'www-authenticate': challenge } },
      ),
      origin,
    )
    expect(res.status).toBe(401)
    expect(res.headers.get('www-authenticate')).toBe(challenge)
    const body = (await res.json()) as { error: { code: number; data: { guide: string } } }
    expect(body.error.code).toBe(-32000)
    expect(body.error.data.guide).toContain('## Upload with an API token')
  })

  test('passes other responses through', async () => {
    const ok = new Response('fine')
    expect(await withGuide(ok, origin)).toBe(ok)
    const plain = new Response('Token has no subject.', { status: 401 })
    expect(await withGuide(plain, origin)).toBe(plain)
  })
})
