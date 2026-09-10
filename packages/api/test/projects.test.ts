import { describe, expect, test } from 'bun:test'
import { Schema } from 'effect'
import { newId } from '../src/id'
import { CreateProject, Slug, UpdateProject } from '../src/services/projects'

const decodeSlug = Schema.decodeUnknownSync(Slug)
const decodeCreate = Schema.decodeUnknownSync(CreateProject)
const decodeUpdate = Schema.decodeUnknownSync(UpdateProject)

describe('Slug', () => {
  test('accepts lowercase words with single dashes', () => {
    expect(decodeSlug('web')).toBe('web')
    expect(decodeSlug('my-app-2')).toBe('my-app-2')
  })

  test.each(['', 'Web', 'my app', '-web', 'web-', 'a--b', 'a_b', 'a'.repeat(65)])(
    'rejects %j',
    (value) => {
      expect(() => decodeSlug(value)).toThrow()
    },
  )
})

describe('CreateProject', () => {
  test('trims the display name and keeps the ttl', () => {
    expect(decodeCreate({ name: 'web', displayName: '  Web  ', ttlSeconds: 3600 })).toEqual({
      name: 'web',
      displayName: 'Web',
      ttlSeconds: 3600,
    })
  })

  test('allows null to clear optional fields', () => {
    expect(decodeCreate({ name: 'web', displayName: null, ttlSeconds: null })).toEqual({
      name: 'web',
      displayName: null,
      ttlSeconds: null,
    })
  })

  test('rejects a blank display name and a ttl over the max', () => {
    expect(() => decodeCreate({ name: 'web', displayName: '   ' })).toThrow()
    expect(() => decodeCreate({ name: 'web', ttlSeconds: 90 * 86400 + 1 })).toThrow()
    expect(() => decodeCreate({ name: 'web', ttlSeconds: 1.5 })).toThrow()
  })

  test('requires a name', () => {
    expect(() => decodeCreate({})).toThrow()
    expect(decodeUpdate({})).toEqual({})
  })
})

describe('newId', () => {
  test('is prefixed, url safe, and unique', () => {
    const id = newId('prj')
    expect(id).toMatch(/^prj_[A-Za-z0-9_-]{22}$/)
    expect(newId('prj')).not.toBe(id)
  })
})
