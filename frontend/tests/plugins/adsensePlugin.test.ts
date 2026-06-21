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
})
