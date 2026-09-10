import { describe, expect, test } from 'bun:test'
import { Schema } from 'effect'
import { CreateToken, bearer, hashSecret, isSecretShape, newSecret } from '../src/services/tokens'

describe('newSecret', () => {
  test('has the art_ prefix, 43 url safe chars, and is unique', () => {
    const secret = newSecret()
    expect(isSecretShape(secret)).toBe(true)
    expect(newSecret()).not.toBe(secret)
  })
})

describe('isSecretShape', () => {
  test.each(['', 'art_', 'art_short', 'prj_' + 'a'.repeat(43), 'art_' + 'a'.repeat(44)])(
    'rejects %j',
    (value) => {
      expect(isSecretShape(value)).toBe(false)
    },
  )
})

describe('hashSecret', () => {
  test('is sha256 hex and stable', async () => {
    const hash = await hashSecret('art_test')
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
    expect(await hashSecret('art_test')).toBe(hash)
    expect(await hashSecret('art_other')).not.toBe(hash)
  })
})

function withAuth(value?: string) {
  return new Request('https://x.test', { headers: value ? { authorization: value } : {} })
}

describe('bearer', () => {
  test('reads the bearer value', () => {
    expect(bearer(withAuth('Bearer art_abc'))).toBe('art_abc')
    expect(bearer(withAuth('Bearer  art_abc '))).toBe('art_abc')
  })

  test('ignores other schemes and a missing header', () => {
    expect(bearer(withAuth('Basic abc'))).toBeNull()
    expect(bearer(withAuth())).toBeNull()
  })
})

describe('CreateToken', () => {
  const decode = Schema.decodeUnknownSync(CreateToken)

  test('trims the name', () => {
    expect(decode({ name: '  github-ci ' })).toEqual({ name: 'github-ci' })
  })

  test('rejects a blank or long name', () => {
    expect(() => decode({ name: '   ' })).toThrow()
    expect(() => decode({ name: 'a'.repeat(65) })).toThrow()
  })
})
