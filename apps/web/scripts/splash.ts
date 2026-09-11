// Renders public/splash/*.png for every row in src/lib/ios-devices.ts.
// macOS only: qlmanage rasterises the icon tile, sips converts it to BMP,
// and the flat 4-bit greyscale PNGs are written here to keep them small.
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { crc32, deflateSync } from 'node:zlib'
import { iosDevices, splashFile, type SplashTheme } from '../src/lib/ios-devices'
import { themeColors } from '../src/lib/theme'

const root = join(import.meta.dirname, '..')
const out = join(root, 'public/splash')
const tilePoints = 112
const tmp = mkdtempSync(join(tmpdir(), 'splash-'))

const icon = readFileSync(join(root, 'public/icon.svg'), 'utf8')
const mark = icon.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '')

// 16 greys: the icon's own two greys at the ends, plus white for the light background.
const levels = [...Array.from({ length: 15 }, (_, i) => Math.round(10 + (i * 240) / 14)), 255]
const nearest = Uint8Array.from({ length: 256 }, (_, grey) =>
  levels.reduce(
    (best, level, i) => (Math.abs(level - grey) < Math.abs(levels[best] - grey) ? i : best),
    0,
  ),
)

function greyOf(hex: string) {
  return parseInt(hex.slice(1, 3), 16)
}

// The icon on a rounded tile, as palette indexes. The background is baked in
// so the corners outside the tile match the page.
function renderTile(theme: SplashTheme, dpr: number) {
  const size = tilePoints * dpr
  const svg = join(tmp, `${theme}-${dpr}x.svg`)
  writeFileSync(
    svg,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  <rect width="1024" height="1024" fill="${themeColors[theme]}"/>
  <clipPath id="tile"><rect width="1024" height="1024" rx="229"/></clipPath>
  <g clip-path="url(#tile)">${mark}</g>
</svg>`,
  )
  // qlmanage misrenders small sizes, so render at 1024 and scale down.
  execFileSync('qlmanage', ['-t', '-s', '1024', '-o', tmp, svg], { stdio: 'ignore' })
  const bmp = join(tmp, `${theme}-${dpr}x.bmp`)
  execFileSync(
    'sips',
    ['-z', String(size), String(size), '-s', 'format', 'bmp', `${svg}.png`, '--out', bmp],
    {
      stdio: 'ignore',
    },
  )
  const bytes = readFileSync(bmp)
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const offset = view.getUint32(10, true)
  const width = view.getInt32(18, true)
  const height = view.getInt32(22, true)
  const bytesPerPixel = view.getUint16(28, true) / 8
  const stride = Math.ceil((width * bytesPerPixel) / 4) * 4
  if (width !== size || Math.abs(height) !== size)
    throw new Error(`Tile is ${width}x${height}, expected ${size}`)
  const indexes = new Uint8Array(size * size)
  for (let y = 0; y < size; y++) {
    const row = height > 0 ? size - 1 - y : y
    for (let x = 0; x < size; x++) {
      indexes[y * size + x] = nearest[bytes[offset + row * stride + x * bytesPerPixel + 1]!]!
    }
  }
  const background = nearest[greyOf(themeColors[theme])]
  if (indexes[0] !== background || indexes[indexes.length - 1] !== background) {
    throw new Error(`Tile corners for ${theme} ${dpr}x are not the background colour`)
  }
  return { size, indexes }
}

function chunk(type: string, data: Uint8Array) {
  const bytes = new Uint8Array(12 + data.length)
  const view = new DataView(bytes.buffer)
  view.setUint32(0, data.length)
  bytes.set(new TextEncoder().encode(type), 4)
  bytes.set(data, 8)
  view.setUint32(8 + data.length, crc32(bytes.subarray(4, 8 + data.length)))
  return bytes
}

function setPixel(row: Uint8Array, x: number, index: number) {
  const i = x >> 1
  row[i] = x & 1 ? (row[i]! & 0xf0) | index : (row[i]! & 0x0f) | (index << 4)
}

// 4-bit palette PNG. Rows use the "Up" filter, so every row equal to the one
// above it is all zeros and deflates to almost nothing.
function encode(
  width: number,
  height: number,
  background: number,
  tile: { size: number; indexes: Uint8Array },
) {
  const rowBytes = Math.ceil(width / 2)
  const stride = 1 + rowBytes
  const raw = new Uint8Array(height * stride)
  const plain = new Uint8Array(rowBytes).fill((background << 4) | background)
  if (width & 1) plain[rowBytes - 1]! &= 0xf0
  raw.set(plain, 1)
  for (let y = 1; y < height; y++) raw[y * stride] = 2
  const x0 = (width - tile.size) >> 1
  const y0 = (height - tile.size) >> 1
  let previous = plain
  for (let ty = 0; ty <= tile.size; ty++) {
    const current = plain.slice()
    if (ty < tile.size) {
      for (let tx = 0; tx < tile.size; tx++)
        setPixel(current, x0 + tx, tile.indexes[ty * tile.size + tx]!)
    }
    const at = (y0 + ty) * stride + 1
    for (let i = 0; i < rowBytes; i++) raw[at + i] = (current[i]! - previous[i]!) & 0xff
    previous = current
  }
  const ihdr = new Uint8Array(13)
  const view = new DataView(ihdr.buffer)
  view.setUint32(0, width)
  view.setUint32(4, height)
  ihdr.set([4, 3, 0, 0, 0], 8)
  const plte = Uint8Array.from(levels.flatMap((level) => [level, level, level]))
  return Buffer.concat([
    Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('PLTE', plte),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', new Uint8Array(0)),
  ])
}

rmSync(out, { recursive: true, force: true })
mkdirSync(out, { recursive: true })
for (const theme of ['light', 'dark'] as const) {
  const background = nearest[greyOf(themeColors[theme])]!
  if (levels[background] !== greyOf(themeColors[theme]))
    throw new Error(`No exact palette entry for ${theme}`)
  for (const dpr of [2, 3]) {
    const tile = renderTile(theme, dpr)
    for (const [width, height, deviceDpr] of iosDevices) {
      if (deviceDpr !== dpr) continue
      for (const orientation of ['portrait', 'landscape'] as const) {
        const [w, h] = orientation === 'portrait' ? [width, height] : [height, width]
        const file = join(root, 'public', splashFile(width, height, dpr, orientation, theme))
        writeFileSync(file, encode(w * dpr, h * dpr, background, tile))
      }
    }
  }
}
rmSync(tmp, { recursive: true })
