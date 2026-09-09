import { describe, expect, test } from 'bun:test'
import { Effect, Schema } from 'effect'
import type { ApiEnv } from '../src/env'
import { NotFound } from '../src/errors'
import { run } from '../src/http'

// The failing routes never touch D1 or R2, and layers build lazily, so an
// empty env is enough to exercise the error mapping.
const env = {} as ApiEnv

describe('run', () => {
  test('success passes the Response through', async () => {
    const res = await run(env, Effect.succeed(Response.json({ hi: 1 })))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ hi: 1 })
  })

  test('tagged failure maps to its status', async () => {
    const res = await run(env, new NotFound({ message: 'no such artifact' }))
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'no such artifact' })
  })

  test('ParseError maps to 400 with a readable message', async () => {
    const Body = Schema.Struct({ name: Schema.String })
    const res = await run(
      env,
      Schema.decodeUnknown(Body)({ name: 1 }).pipe(Effect.map(() => Response.json({}))),
    )
    expect(res.status).toBe(400)
    const body = (await res.json()) as { error: string }
    expect(body.error).toContain('name')
  })

  test('defect maps to 500 without leaking details', async () => {
    const res = await run(env, Effect.die(new Error('secret internals')))
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'internal error' })
  })
})
