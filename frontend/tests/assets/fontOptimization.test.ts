import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)

describe('Font Optimization', () => {
  it('main.css should import Pretendard from npm package', () => {
    const cssPath = resolve(__dirname, '../../assets/css/main.css')
    const cssContent = readFileSync(cssPath, 'utf-8')
    expect(cssContent).toContain("@import 'pretendard/dist/web/variable/pretendardvariable.css'")
  })

  it('Pretendard npm package CSS should contain font-display: swap', () => {
    const pkgCssPath = require.resolve('pretendard/dist/web/variable/pretendardvariable.css')
    const cssContent = readFileSync(pkgCssPath, 'utf-8')
    expect(cssContent).toContain('font-display: swap')
  })
})
