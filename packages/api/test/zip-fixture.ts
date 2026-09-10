// Builds small stored (method 0) zips for tests, with optional raw tweaks.

export interface FixtureEntry {
  name: string
  data?: string
  method?: number
  flags?: number
}

function u16(n: number) {
  return [n & 0xff, (n >> 8) & 0xff]
}

function u32(n: number) {
  return [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >>> 24) & 0xff]
}

export function buildZip(entries: FixtureEntry[], options: { comment?: string } = {}) {
  const encoder = new TextEncoder()
  const local: number[] = []
  const central: number[] = []
  for (const entry of entries) {
    const name = [...encoder.encode(entry.name)]
    const data = [...encoder.encode(entry.data ?? '')]
    const method = entry.method ?? 0
    const flags = entry.flags ?? 0
    const offset = local.length
    local.push(
      ...u32(0x04034b50),
      ...u16(20),
      ...u16(flags),
      ...u16(method),
      ...u16(0),
      ...u16(0),
      ...u32(0),
      ...u32(data.length),
      ...u32(data.length),
      ...u16(name.length),
      ...u16(0),
      ...name,
      ...data,
    )
    central.push(
      ...u32(0x02014b50),
      ...u16(20),
      ...u16(20),
      ...u16(flags),
      ...u16(method),
      ...u16(0),
      ...u16(0),
      ...u32(0),
      ...u32(data.length),
      ...u32(data.length),
      ...u16(name.length),
      ...u16(0),
      ...u16(0),
      ...u16(0),
      ...u16(0),
      ...u32(0),
      ...u32(offset),
      ...name,
    )
  }
  const comment = [...encoder.encode(options.comment ?? '')]
  const eocd = [
    ...u32(0x06054b50),
    ...u16(0),
    ...u16(0),
    ...u16(entries.length),
    ...u16(entries.length),
    ...u32(central.length),
    ...u32(local.length),
    ...u16(comment.length),
    ...comment,
  ]
  return new Uint8Array([...local, ...central, ...eocd])
}
