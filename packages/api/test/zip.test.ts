import { describe, expect, test } from 'bun:test'
import {
  ZipError,
  detectRoot,
  findCentralDirectory,
  localHeaderSize,
  normalizePath,
  parseEntries,
} from '../src/zip'
import { buildZip } from './zip-fixture'

function parse(bytes: Uint8Array) {
  const cd = findCentralDirectory(bytes, bytes.byteLength)
  return parseEntries(bytes.subarray(cd.offset, cd.offset + cd.size), cd.entryCount)
}

describe('findCentralDirectory', () => {
  test('finds the EOCD with and without a comment', () => {
    const plain = buildZip([{ name: 'a.txt', data: 'hi' }])
    expect(findCentralDirectory(plain, plain.byteLength).entryCount).toBe(1)
    const commented = buildZip([{ name: 'a.txt' }], { comment: 'PK\x05\x06 looks like a sig' })
    expect(findCentralDirectory(commented, commented.byteLength).entryCount).toBe(1)
  })

  test('works when only the tail is given', () => {
    const zip = buildZip([{ name: 'a.txt', data: 'x'.repeat(1000) }])
    const tail = zip.subarray(zip.byteLength - 100)
    const cd = findCentralDirectory(tail, zip.byteLength)
    expect(cd.offset).toBe(30 + 5 + 1000)
  })

  test('rejects non-zip bytes', () => {
    expect(() => findCentralDirectory(new TextEncoder().encode('hello'), 5)).toThrow(ZipError)
  })
})

describe('parseEntries', () => {
  test('lists files and skips directories', () => {
    const entries = parse(
      buildZip([{ name: 'report/' }, { name: 'report/index.html', data: '<p>' }]),
    )
    expect(entries).toEqual([
      {
        path: 'report/index.html',
        offset: 30 + 7,
        compressedSize: 3,
        size: 3,
        method: 0,
        crc32: 0,
      },
    ])
  })

  test.each([
    [{ name: '../x', data: '' }, 'Bad zip entry path'],
    [{ name: '/abs', data: '' }, 'Bad zip entry path'],
    [{ name: 'a\\b', data: '' }, 'Bad zip entry path'],
    [{ name: 'a/./b', data: '' }, 'Bad zip entry path'],
    [{ name: 'a', method: 12 }, 'Unsupported compression'],
    [{ name: 'a', flags: 1 }, 'Encrypted'],
  ])('rejects %j', (entry, message) => {
    expect(() => parse(buildZip([entry]))).toThrow(message)
  })

  test('rejects duplicate paths', () => {
    expect(() => parse(buildZip([{ name: 'a' }, { name: 'a' }]))).toThrow('Duplicate')
  })
})

describe('normalizePath', () => {
  test('returns null for directories', () => {
    expect(normalizePath('a/b/')).toBeNull()
    expect(normalizePath('a/b.txt')).toBe('a/b.txt')
  })
})

function stubEntries(...paths: string[]) {
  return paths.map((path) => ({ path, offset: 0, compressedSize: 0, size: 0, method: 0, crc32: 0 }))
}

describe('detectRoot', () => {
  test('finds a single folder that holds index.html', () => {
    expect(detectRoot(stubEntries('report/index.html', 'report/data/a.png'))).toBe('report')
  })

  test('falls back to the zip root', () => {
    expect(detectRoot(stubEntries('index.html', 'a.png'))).toBe('')
    expect(detectRoot(stubEntries('report/index.html', 'other/x'))).toBe('')
    expect(detectRoot(stubEntries('report/a.png'))).toBe('')
    expect(detectRoot(stubEntries())).toBe('')
  })
})

describe('localHeaderSize', () => {
  test('adds the name and extra lengths', () => {
    const zip = buildZip([{ name: 'abc.txt', data: 'data' }])
    expect(localHeaderSize(zip.subarray(0, 30))).toBe(37)
    expect(zip.subarray(37, 41)).toEqual(new TextEncoder().encode('data'))
  })
})
