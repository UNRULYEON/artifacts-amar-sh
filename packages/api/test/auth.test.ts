import { describe, expect, test } from 'bun:test'
import { assertOwner, isSameOrigin } from '../src/services/auth'

describe('assertOwner', () => {
  test('lets the owner through', () => {
    expect(() => assertOwner('29234113', '29234113')).not.toThrow()
  })

  test('rejects any other GitHub id', () => {
    expect(() => assertOwner('1', '29234113')).toThrow('Sign up is closed.')
  })

  test('rejects a missing id', () => {
    expect(() => assertOwner(undefined, '29234113')).toThrow('Sign up is closed.')
  })
})

function post(url: string, origin?: string) {
  return new Request(url, { method: 'POST', headers: origin ? { origin } : {} })
}

describe('isSameOrigin', () => {
  test('accepts the origin the request was served from', () => {
    expect(isSameOrigin(post('http://localhost:3001/api/projects', 'http://localhost:3001'))).toBe(
      true,
    )
    expect(
      isSameOrigin(post('https://artifacts.amar.sh/api/projects', 'https://artifacts.amar.sh')),
    ).toBe(true)
  })

  test('rejects another port, host, scheme, or a missing header', () => {
    expect(isSameOrigin(post('http://localhost:3001/api/projects', 'http://localhost:3000'))).toBe(
      false,
    )
    expect(
      isSameOrigin(post('https://artifacts.amar.sh/api/projects', 'https://evil.example')),
    ).toBe(false)
    expect(
      isSameOrigin(post('https://artifacts.amar.sh/api/projects', 'http://artifacts.amar.sh')),
    ).toBe(false)
    expect(isSameOrigin(post('https://artifacts.amar.sh/api/projects'))).toBe(false)
  })
})
