import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd().endsWith('/frontend') ? process.cwd() : join(process.cwd(), 'frontend')
const src = () => readFileSync(resolve(root, 'plugins/adsense.client.ts'), 'utf8')

describe('adsense.client plugin', () => {
  it('canLoadAdScript() 게이트로 스크립트 주입을 차단한다', () => {
    expect(src()).toContain('canLoadAdScript')
    expect(src()).toMatch(/if\s*\(\s*!canLoadAdScript\(\)\s*\)\s*return/)
  })

  it('스크립트 로드 실패(onerror)를 애드블록으로 감지한다', () => {
    expect(src()).toContain('onerror')
    expect(src()).toContain('markAdsBlocked')
  })
  it('세션에 차단 기록이 있으면 주입을 스킵한다', () => {
    expect(src()).toContain("sessionStorage")
    expect(src()).toContain("ads:blocked")
  })
})
