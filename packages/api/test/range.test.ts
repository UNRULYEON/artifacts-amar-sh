import { describe, expect, test } from 'bun:test'
import { contentRange, parseRange } from '../src/range'
import { bundlePath } from '../src/routes/bytes'

describe('parseRange', () => {
  test.each([
    [null, null],
    ['bytes=0-99', { offset: 0, length: 100 }],
    ['bytes=100-', { offset: 100, length: 900 }],
    ['bytes=-100', { offset: 900, length: 100 }],
    ['bytes=0-5000', { offset: 0, length: 1000 }],
    ['bytes=-5000', { offset: 0, length: 1000 }],
    ['bytes=1000-', 'unsatisfiable'],
    ['bytes=50-10', 'unsatisfiable'],
    ['bytes=-0', 'unsatisfiable'],
    ['bytes=0-1,5-9', null],
    ['items=0-1', null],
  ])('%s', (header, expected) => {
    expect(parseRange(header, 1000)).toEqual(expected)
  })

  test('contentRange formats the header', () => {
    expect(contentRange({ offset: 100, length: 50 }, 1000)).toBe('bytes 100-149/1000')
  })
})

describe('bundlePath', () => {
  test('prefixes the root folder when there is one', () => {
    expect(bundlePath('', 'index.html')).toBe('index.html')
    expect(bundlePath('report', 'data/a.png')).toBe('report/data/a.png')
  })
})
