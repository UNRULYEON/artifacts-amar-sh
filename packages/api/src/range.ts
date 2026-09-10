export interface ByteRange {
  offset: number
  length: number
}

// First range of a `bytes=` header against a known size.
// null: no usable header, serve everything. 'unsatisfiable': answer 416.
export function parseRange(
  header: string | null,
  size: number,
): ByteRange | null | 'unsatisfiable' {
  if (!header) return null
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim())
  if (!match) return null
  const [, startText, endText] = match
  if (startText === '' && endText === '') return null
  if (startText === '') {
    const suffix = Math.min(Number(endText), size)
    return suffix === 0 ? 'unsatisfiable' : { offset: size - suffix, length: suffix }
  }
  const start = Number(startText)
  if (start >= size) return 'unsatisfiable'
  const end = endText === '' ? size - 1 : Math.min(Number(endText), size - 1)
  if (end < start) return 'unsatisfiable'
  return { offset: start, length: end - start + 1 }
}

export function contentRange(range: ByteRange, size: number) {
  return `bytes ${range.offset}-${range.offset + range.length - 1}/${size}`
}
