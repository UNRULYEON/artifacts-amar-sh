import { describe, expect, test } from 'bun:test'
import { contentTypeFor, extensionOf, kindFor } from '../src/mime'

describe('kindFor', () => {
  test.each([
    ['shot.PNG', 'image'],
    ['a/b/movie.webm', 'video'],
    ['playwright-report.zip', 'bundle'],
    ['index.html', 'page'],
    ['trace.log', 'file'],
    ['noext', 'file'],
    ['.hidden', 'file'],
  ])('%s is %s', (name, kind) => {
    expect(kindFor(name)).toBe(kind)
  })
})

describe('contentTypeFor', () => {
  test('knows common web types and returns null otherwise', () => {
    expect(contentTypeFor('a.css')).toBe('text/css; charset=utf-8')
    expect(contentTypeFor('a.bin')).toBeNull()
    expect(extensionOf('archive.tar.gz')).toBe('gz')
  })
})
