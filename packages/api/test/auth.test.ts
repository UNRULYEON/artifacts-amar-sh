import { describe, expect, test } from 'bun:test'
import { assertOwner } from '../src/services/auth'

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
