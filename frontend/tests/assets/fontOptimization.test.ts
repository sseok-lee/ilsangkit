import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

describe('Font Optimization', () => {
  it('main.css should reference Pretendard Variable font family', () => {
    const cssPath = resolve(__dirname, '../../assets/css/main.css')
    const cssContent = readFileSync(cssPath, 'utf-8')
    expect(cssContent).toContain('Pretendard Variable')
  })

  it('nuxt.config.ts should load Pretendard font via CDN or local', () => {
    const nuxtConfigPath = resolve(__dirname, '../../nuxt.config.ts')
    const nuxtConfigContent = readFileSync(nuxtConfigPath, 'utf-8')
    // Font is loaded via CDN link in nuxt.config.ts or self-hosted in public/fonts
    const hasCdn = nuxtConfigContent.includes('Pretendard') || nuxtConfigContent.includes('pretendard')
    const hasSelfHosted = existsSync(resolve(__dirname, '../../public/fonts/PretendardVariable.woff2'))
    expect(hasCdn || hasSelfHosted).toBe(true)
  })
})
