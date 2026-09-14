import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { readStaticOgFallbackPng } from '../../server/utils/ogMapFallback'

(globalThis as any).useStorage = () => ({
  getItemRaw: async () => readFileSync(resolve(process.cwd(), 'public/og-image.png')),
})

function pngDimensions(buffer: Buffer) {
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  }
}

describe('ogMapFallback', () => {
  it('bundles a meaningful branded PNG fallback for Nitro output deployments', async () => {
    const png = await readStaticOgFallbackPng()

    expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
    expect(png.byteLength).toBeGreaterThan(100_000)
    expect(pngDimensions(png)).toEqual({ width: 1200, height: 630 })
  })
})
