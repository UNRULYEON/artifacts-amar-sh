import { describe, expect, test } from 'bun:test'
import { Effect, Schema } from 'effect'
import { clampTtl } from '../src/limits'
import { UploadQuery, contentLength } from '../src/routes/upload'
import { CreateTicket } from '../src/services/tickets'

const decode = Schema.decodeUnknownSync(UploadQuery)

function withLength(value?: string) {
  return new Request('https://x.test/api/upload', {
    method: 'POST',
    headers: value === undefined ? {} : { 'content-length': value },
  })
}

function outcome(request: Request) {
  return Effect.runSync(Effect.either(contentLength(request)))
}

describe('UploadQuery', () => {
  test('parses project, name, and ttl', () => {
    expect(decode({ project: 'web', name: 'shot.png', ttl: '3600' })).toEqual({
      project: 'web',
      name: 'shot.png',
      ttl: 3600,
    })
  })

  test('rejects a path as name and a bad ttl', () => {
    expect(() => decode({ project: 'web', name: 'a/b.png' })).toThrow()
    expect(() => decode({ project: 'web', name: '' })).toThrow()
    expect(() => decode({ project: 'web', name: 'a.png', ttl: 'soon' })).toThrow()
    expect(() => decode({ name: 'a.png' })).toThrow()
  })
})

describe('contentLength', () => {
  test('maps missing, bad, empty, and oversized lengths', () => {
    expect(outcome(withLength())).toMatchObject({ left: { _tag: 'LengthRequired' } })
    expect(outcome(withLength('abc'))).toMatchObject({ left: { _tag: 'BadRequest' } })
    expect(outcome(withLength('0'))).toMatchObject({ left: { _tag: 'BadRequest' } })
    expect(outcome(withLength(String(100 * 1024 * 1024 + 1)))).toMatchObject({
      left: { _tag: 'PayloadTooLarge' },
    })
    expect(outcome(withLength('42'))).toMatchObject({ right: 42 })
  })
})

describe('clampTtl', () => {
  test('keeps the ttl between one minute and ninety days', () => {
    expect(clampTtl(1)).toBe(60)
    expect(clampTtl(3600)).toBe(3600)
    expect(clampTtl(365 * 86400)).toBe(90 * 86400)
  })
})

describe('CreateTicket', () => {
  const decodeTicket = Schema.decodeUnknownSync(CreateTicket)

  test('parses a ticket body and rejects a path name', () => {
    expect(decodeTicket({ project: 'web', name: 'shot.png', ttl: 60 })).toEqual({
      project: 'web',
      name: 'shot.png',
      ttl: 60,
    })
    expect(() => decodeTicket({ project: 'web', name: '../x' })).toThrow()
    expect(() => decodeTicket({ project: 'web', name: 'a.png', ttl: '60' })).toThrow()
  })
})
