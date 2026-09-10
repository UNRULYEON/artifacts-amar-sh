import { MAX_CENTRAL_DIRECTORY_BYTES, MAX_ZIP_ENTRIES } from './limits'

// Minimal reader for the zip central directory. Only stored (0) and deflate
// (8) entries, no Zip64, no encryption. Everything else throws ZipError.

export class ZipError extends Error {
  readonly _tag = 'ZipError'
}

export interface ZipEntry {
  path: string
  offset: number
  compressedSize: number
  size: number
  method: number
  crc32: number
}

export interface CentralDirectory {
  offset: number
  size: number
  entryCount: number
}

const EOCD_SIG = 0x06054b50
const ZIP64_LOCATOR_SIG = 0x07064b50
const CENTRAL_SIG = 0x02014b50
const LOCAL_SIG = 0x04034b50
const EOCD_MIN = 22
const CENTRAL_MIN = 46
export const LOCAL_HEADER_MIN = 30
export const EOCD_TAIL_BYTES = EOCD_MIN + 0xffff

const decoder = new TextDecoder()

function view(bytes: Uint8Array) {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
}

// `tail` is the last bytes of the file, `fileSize` the whole length.
export function findCentralDirectory(tail: Uint8Array, fileSize: number): CentralDirectory {
  const dv = view(tail)
  const tailStart = fileSize - tail.byteLength
  for (let pos = tail.byteLength - EOCD_MIN; pos >= 0; pos--) {
    if (dv.getUint32(pos, true) !== EOCD_SIG) continue
    const commentLength = dv.getUint16(pos + 20, true)
    if (pos + EOCD_MIN + commentLength !== tail.byteLength) continue
    if (pos >= 20 && dv.getUint32(pos - 20, true) === ZIP64_LOCATOR_SIG) {
      throw new ZipError('Zip64 archives are not supported.')
    }
    const entryCount = dv.getUint16(pos + 10, true)
    const size = dv.getUint32(pos + 12, true)
    const offset = dv.getUint32(pos + 16, true)
    if (entryCount === 0xffff || size === 0xffffffff || offset === 0xffffffff) {
      throw new ZipError('Zip64 archives are not supported.')
    }
    if (entryCount > MAX_ZIP_ENTRIES) {
      throw new ZipError(`Zip has more than ${MAX_ZIP_ENTRIES} entries.`)
    }
    if (size > MAX_CENTRAL_DIRECTORY_BYTES || offset + size > tailStart + pos) {
      throw new ZipError('Zip central directory is out of bounds.')
    }
    return { offset, size, entryCount }
  }
  throw new ZipError('Not a zip file.')
}

// Rejects anything that could escape the root. Returns null for directories.
export function normalizePath(raw: string): string | null {
  if (raw.includes('\\') || raw.includes('\0') || raw.startsWith('/')) {
    throw new ZipError(`Bad zip entry path: ${raw}`)
  }
  if (raw.endsWith('/')) return null
  const segments = raw.split('/')
  if (segments.some((s) => s === '' || s === '.' || s === '..')) {
    throw new ZipError(`Bad zip entry path: ${raw}`)
  }
  return raw
}

export function parseEntries(bytes: Uint8Array, entryCount: number): ZipEntry[] {
  const dv = view(bytes)
  const entries: ZipEntry[] = []
  const seen = new Set<string>()
  let pos = 0
  for (let i = 0; i < entryCount; i++) {
    if (pos + CENTRAL_MIN > bytes.byteLength || dv.getUint32(pos, true) !== CENTRAL_SIG) {
      throw new ZipError('Corrupt zip central directory.')
    }
    const flags = dv.getUint16(pos + 8, true)
    const method = dv.getUint16(pos + 10, true)
    const crc32 = dv.getUint32(pos + 16, true)
    const compressedSize = dv.getUint32(pos + 20, true)
    const size = dv.getUint32(pos + 24, true)
    const nameLength = dv.getUint16(pos + 28, true)
    const extraLength = dv.getUint16(pos + 30, true)
    const commentLength = dv.getUint16(pos + 32, true)
    const offset = dv.getUint32(pos + 42, true)
    const nameStart = pos + CENTRAL_MIN
    const name = decoder.decode(bytes.subarray(nameStart, nameStart + nameLength))
    pos = nameStart + nameLength + extraLength + commentLength

    if (flags & 0x1) throw new ZipError(`Encrypted zip entry: ${name}`)
    if (method !== 0 && method !== 8) {
      throw new ZipError(`Unsupported compression method ${method}: ${name}`)
    }
    if (compressedSize === 0xffffffff || size === 0xffffffff || offset === 0xffffffff) {
      throw new ZipError('Zip64 archives are not supported.')
    }
    const path = normalizePath(name)
    if (path === null) continue
    if (seen.has(path)) throw new ZipError(`Duplicate zip entry: ${path}`)
    seen.add(path)
    entries.push({ path, offset, compressedSize, size, method, crc32 })
  }
  return entries
}

// The folder that holds index.html when every entry lives under it, else ''.
export function detectRoot(entries: ZipEntry[]): string {
  if (entries.length === 0) return ''
  const first = entries[0]!.path
  const slash = first.indexOf('/')
  if (slash === -1) return ''
  const root = first.slice(0, slash)
  const prefix = `${root}/`
  const nested = entries.every((e) => e.path.startsWith(prefix))
  const hasIndex = entries.some((e) => e.path === `${prefix}index.html`)
  return nested && hasIndex ? root : ''
}

// Size of the local header in front of an entry's data.
export function localHeaderSize(header: Uint8Array): number {
  const dv = view(header)
  if (header.byteLength < LOCAL_HEADER_MIN || dv.getUint32(0, true) !== LOCAL_SIG) {
    throw new ZipError('Corrupt zip local header.')
  }
  return LOCAL_HEADER_MIN + dv.getUint16(26, true) + dv.getUint16(28, true)
}
