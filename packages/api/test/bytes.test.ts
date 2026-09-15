import { describe, expect, test } from 'bun:test'
import { withStorageShim } from '../src/routes/bytes'

function html(body: string, init: ResponseInit = {}) {
  return new Response(body, {
    status: 200,
    ...init,
    headers: { 'content-type': 'text/html; charset=utf-8', 'content-length': '1', ...init.headers },
  })
}

describe('withStorageShim', () => {
  test('adds the storage shim at the start of head and drops the length', async () => {
    const res = withStorageShim(html('<!doctype html><html><head><title>r</title></head></html>'))
    expect(res.headers.get('content-length')).toBeNull()
    const body = await res.text()
    expect(body.startsWith('<!doctype html><html><head><script>')).toBe(true)
    expect(body).toContain('localStorage')
    expect(body).toContain('</script><title>r</title>')
  })

  test('adds it once', async () => {
    const body = await withStorageShim(html('<head></head><svg><head></head></svg>')).text()
    expect(body.split('<script>').length).toBe(2)
  })

  test('leaves other responses alone', async () => {
    const png = new Response('x', { headers: { 'content-type': 'image/png' } })
    expect(withStorageShim(png)).toBe(png)
    const download = html('<head></head>', { headers: { 'content-disposition': 'attachment' } })
    expect(withStorageShim(download)).toBe(download)
    const partial = html('<head></head>', { status: 206 })
    expect(withStorageShim(partial)).toBe(partial)
  })
})
