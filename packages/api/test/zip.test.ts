import { describe, expect, test } from 'bun:test'
import {
  ZipError,
  buildStoredZip,
  comparePairs,
  crc32Of,
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

describe('comparePairs', () => {
  test('accepts one pair at the root', () => {
    expect(comparePairs(stubEntries('before.png', 'after.png'))).toEqual([
      { label: '', before: 'before.png', after: 'after.png', media: 'image' },
    ])
    expect(comparePairs(stubEntries('after.webm', 'before.mp4'))?.[0]?.media).toBe('video')
    expect(comparePairs(stubEntries('before.jpg', 'after.webp'))?.[0]?.media).toBe('image')
  })

  test('accepts one folder per pair, mixed media, in natural order', () => {
    const pairs = comparePairs(
      stubEntries(
        '10-checkout/before.mp4',
        '2-login/after.png',
        '10-checkout/after.webm',
        '2-login/before.png',
      ),
    )
    expect(pairs?.map((p) => [p.label, p.media])).toEqual([
      ['2-login', 'image'],
      ['10-checkout', 'video'],
    ])
  })

  test('accepts an optional diff image on an image pair', () => {
    expect(comparePairs(stubEntries('diff.png', 'after.png', 'before.png'))).toEqual([
      { label: '', before: 'before.png', after: 'after.png', diff: 'diff.png', media: 'image' },
    ])
    const pairs = comparePairs(
      stubEntries('a/before.png', 'a/after.png', 'a/diff.webp', 'b/before.png', 'b/after.png'),
    )
    expect(pairs?.map((p) => p.diff)).toEqual(['a/diff.webp', undefined])
  })

  test('accepts an optional diff.txt snapshot diff on an image pair', () => {
    expect(comparePairs(stubEntries('before.png', 'after.png', 'diff.txt', 'diff.png'))).toEqual([
      {
        label: '',
        before: 'before.png',
        after: 'after.png',
        diff: 'diff.png',
        snapshot: 'diff.txt',
        media: 'image',
      },
    ])
    expect(
      comparePairs(stubEntries('a/before.png', 'a/after.png', 'a/diff.TXT'))?.[0],
    ).toMatchObject({ snapshot: 'a/diff.TXT' })
  })

  test.each([
    [[]],
    [['before.png', 'after.mp4']],
    [['before.mp4', 'after.mp4', 'diff.txt']],
    [['before.png', 'after.png', 'diff.txt', 'diff.md']],
    [['before.png', 'after.png', 'diff.mp4']],
    [['before.mp4', 'after.mp4', 'diff.png']],
    [['before.png', 'diff.png']],
    [['before.png', 'after.png', 'notes.txt']],
    [['before.png']],
    [['a/before.png', 'a/after.png', 'b/before.png']],
    [['x/y/before.png', 'x/y/after.png']],
    [['before.txt', 'after.txt']],
    [['old.png', 'new.png']],
    [['before', 'after']],
  ])('rejects %j', (paths) => {
    expect(comparePairs(stubEntries(...paths))).toBeNull()
  })
})

describe('buildStoredZip', () => {
  test('writes a zip the reader parses back with correct sizes and checksums', () => {
    const encoder = new TextEncoder()
    const zip = buildStoredZip([
      { name: 'before.png', bytes: encoder.encode('123456789') },
      { name: 'after.png', bytes: encoder.encode('') },
    ])
    const entries = parse(zip)
    expect(entries.map((e) => e.path)).toEqual(['before.png', 'after.png'])
    expect(entries[0]).toMatchObject({ size: 9, compressedSize: 9, method: 0, crc32: 0xcbf43926 })
    expect(entries[1]).toMatchObject({ size: 0, crc32: 0 })
    const dataStart = entries[0]!.offset + localHeaderSize(zip.subarray(entries[0]!.offset))
    expect(zip.subarray(dataStart, dataStart + 9)).toEqual(encoder.encode('123456789'))
    expect(comparePairs(entries)?.[0]?.media).toBe('image')
  })

  test('crc32 matches the reference vector', () => {
    expect(crc32Of(new TextEncoder().encode('123456789'))).toBe(0xcbf43926)
    expect(crc32Of(new Uint8Array())).toBe(0)
  })
})
