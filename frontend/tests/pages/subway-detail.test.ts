import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// ─── noindex 회귀 가드 ─────────────────────────────────────────────────
// /subway/[slug].vue는 정식 인덱싱 대상이므로 noindex 디렉티브가 추가되어서는 안 된다.
// 과거 'noindex, nofollow' 상태였으나 그룹핑된 sitemap distinct 보장과 함께 해제됨.

describe('subway/[slug].vue noindex regression', () => {
  const filePath = resolve(__dirname, '../../pages/subway/[slug].vue')
  const content = readFileSync(filePath, 'utf-8')

  it("useSeoMeta 호출 영역에 'noindex' 키워드가 없다", () => {
    // <script> 안에 noindex가 절대 들어가면 안 됨. 템플릿 텍스트도 마찬가지.
    expect(content).not.toMatch(/noindex/i)
  })

  it("'nofollow' 디렉티브가 없다", () => {
    expect(content).not.toMatch(/nofollow/i)
  })

  it('setMeta 호출이 여전히 존재한다 (메타태그 누락 방지)', () => {
    expect(content).toMatch(/setMeta\(/)
  })

  it('title과 description 등 기본 SEO 항목이 보존된다', () => {
    expect(content).toMatch(/buildSubwayTitle/)
    expect(content).toMatch(/buildSubwayDescription/)
  })
})
