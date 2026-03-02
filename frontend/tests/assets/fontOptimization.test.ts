import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

describe('Font Optimization', () => {
  it('main.css should contain font-display: swap for FOIT prevention', () => {
    const cssPath = resolve(__dirname, '../../assets/css/main.css')
    const cssContent = readFileSync(cssPath, 'utf-8')
    expect(cssContent).toContain('font-display: swap')
  })

  it('main.css should define Pretendard Variable font-face with swap', () => {
    const cssPath = resolve(__dirname, '../../assets/css/main.css')
    const cssContent = readFileSync(cssPath, 'utf-8')
    expect(cssContent).toContain('@font-face')
    expect(cssContent).toContain("font-family: 'Pretendard Variable'")
  })
})
