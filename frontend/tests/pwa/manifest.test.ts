import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

describe('PWA Manifest', () => {
  const manifestPath = resolve(__dirname, '../../public/site.webmanifest')
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'))

  it('display === standalone', () => {
    expect(manifest.display).toBe('standalone')
  })

  it('icons에 192x192 크기 포함', () => {
    const sizes = (manifest.icons as Array<{ sizes: string }>).map((i) => i.sizes)
    expect(sizes).toContain('192x192')
  })

  it('icons에 512x512 크기 포함', () => {
    const sizes = (manifest.icons as Array<{ sizes: string }>).map((i) => i.sizes)
    expect(sizes).toContain('512x512')
  })

  it('name 존재', () => {
    expect(manifest.name).toBeTruthy()
  })

  it('short_name 존재', () => {
    expect(manifest.short_name).toBeTruthy()
  })

  it('start_url 존재', () => {
    expect(manifest.start_url).toBeTruthy()
  })

  it('theme_color 존재', () => {
    expect(manifest.theme_color).toBeTruthy()
  })

  it('background_color 존재', () => {
    expect(manifest.background_color).toBeTruthy()
  })
})
