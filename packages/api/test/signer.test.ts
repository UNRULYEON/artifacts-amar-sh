import { describe, expect, test } from 'bun:test'
import { fromBase64url, base64url } from '../src/encoding'
import { makeSigner } from '../src/services/signer'

const now = 1_800_000_000_000

describe('makeSigner', () => {
  test('round trips and expires after an hour', async () => {
    const signer = await makeSigner('test-secret')
    const token = await signer.sign('art_1', now)
    expect(token).toMatch(/^\d+\.[A-Za-z0-9_-]{43}$/)
    expect(await signer.verify('art_1', token, now)).toBe(true)
    expect(await signer.verify('art_1', token, now + 59 * 60_000)).toBe(true)
    expect(await signer.verify('art_1', token, now + 61 * 60_000)).toBe(false)
  })

  test('rejects another id, another secret, and a tampered token', async () => {
    const signer = await makeSigner('test-secret')
    const token = await signer.sign('art_1', now)
    expect(await signer.verify('art_2', token, now)).toBe(false)
    expect(await (await makeSigner('other')).verify('art_1', token, now)).toBe(false)
    const [exp, sig] = token.split('.') as [string, string]
    expect(await signer.verify('art_1', `${Number(exp) + 1}.${sig}`, now)).toBe(false)
    expect(await signer.verify('art_1', `${exp}.${sig.slice(1)}A`, now)).toBe(false)
    expect(await signer.verify('art_1', 'garbage', now)).toBe(false)
    expect(await signer.verify('art_1', `${exp}.***`, now)).toBe(false)
  })
})

describe('embed tokens', () => {
  test('live until the artifact expires and never past it', async () => {
    const signer = await makeSigner('test-secret')
    const expiresAt = new Date(now + 30 * 86_400_000)
    const token = await signer.signEmbed('art_1', expiresAt)
    expect(await signer.verify('art_1', token, now)).toBe(true)
    expect(await signer.verify('art_1', token, now + 29 * 86_400_000)).toBe(true)
    expect(await signer.verify('art_1', token, expiresAt.getTime() + 1)).toBe(false)
    expect(await signer.verify('art_2', token, now)).toBe(false)
  })

  test('a viewer token cannot be stretched and an embed token is not a viewer token', async () => {
    const signer = await makeSigner('test-secret')
    const view = await signer.sign('art_1', now)
    const [, viewSig] = view.split('.') as [string, string]
    const farExp = Math.floor(now / 1000) + 30 * 86_400
    expect(await signer.verify('art_1', `${farExp}.${viewSig}`, now)).toBe(false)
    const embed = await signer.signEmbed('art_1', new Date(now + 30 * 60_000))
    const [embedExp, embedSig] = embed.split('.') as [string, string]
    expect(await signer.verify('art_1', embed, now)).toBe(true)
    expect(embedExp).toBe(String(Math.floor((now + 30 * 60_000) / 1000)))
    expect(await signer.verify('art_1', `${embedExp}.${embedSig.slice(1)}A`, now)).toBe(false)
  })
})

describe('base64url', () => {
  test('round trips bytes of every length mod 3', () => {
    for (const length of [0, 1, 2, 3, 4, 31, 32]) {
      const bytes = Uint8Array.from({ length }, (_, i) => (i * 37) & 0xff)
      expect(fromBase64url(base64url(bytes))).toEqual(bytes)
    }
    expect(fromBase64url('not base64!')).toBeNull()
  })
})
