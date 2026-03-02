import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

describe('Font Optimization', () => {
  it('main.css should declare Pretendard Variable @font-face with swap', () => {
    const cssPath = resolve(__dirname, '../../assets/css/main.css')
    const cssContent = readFileSync(cssPath, 'utf-8')
    expect(cssContent).toContain('@font-face')
    expect(cssContent).toContain("font-family: 'Pretendard Variable'")
    expect(cssContent).toContain('font-display: swap')
  })

  it('self-hosted PretendardVariable.woff2 should exist in public/fonts', () => {
    const fontPath = resolve(__dirname, '../../public/fonts/PretendardVariable.woff2')
    expect(existsSync(fontPath)).toBe(true)
  })
})
