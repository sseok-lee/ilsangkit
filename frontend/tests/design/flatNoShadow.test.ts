import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// 평면 요소는 그림자 대신 선으로 구획한다(스펙 2026-10-02 §3).
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const read = (p: string) => readFileSync(resolve(root, p), 'utf8')
const ANY_SHADOW = /(?:^|[\s"'`:])shadow(?:-[\w[\]().,/#%-]+)?(?=[\s"'`])/

// msw-demo.vue 는 .gitignore 대상(로컬 전용 개발 데모)이라 가드 대상에서 뺀다.
const FILES = [
  'pages/article/[slug].vue',
  'components/blog/BlogReviewCard.vue',
  'components/realEstate/map/RealEstateMapCanvas.vue',
  'components/realEstate/map/RealEstateMapExplorer.vue',
  'pages/admin/login.vue',
]

describe('평면 요소 그림자 0', () => {
  for (const file of FILES) {
    it(`${file}: 그림자 클래스 없음`, () => {
      const src = read(file).replace(/<!--[\s\S]*?-->/g, '')
      expect(src).not.toMatch(ANY_SHADOW)
    })
  }

  it('블로그 후기 카드는 관련 가이드 카드와 같은 테두리·호버', () => {
    const src = read('components/blog/BlogReviewCard.vue')
    expect(src).toMatch(/rounded-lg border border-line bg-white p-4 transition-colors hover:border-primary\/30/)
    expect(src).not.toMatch(/border-slate-200|rounded-xl|transition-shadow/)
  })

  it('지도/목록 토글 활성은 테두리로 표시', () => {
    const src = read('components/realEstate/map/RealEstateMapExplorer.vue')
    const tag = src.match(/<button\b[^>]*aria-current="page"[^>]*>/)?.[0] ?? ''
    expect(tag).not.toBe('')
    const classes = (tag.match(/\bclass="([^"]*)"/)?.[1] ?? '').split(/\s+/)
    expect(classes).toEqual(expect.arrayContaining(['border', 'border-line', 'bg-white', 'text-primary']))
    expect(classes.some((c) => /(^|:)!?shadow/.test(c))).toBe(false)
  })
})
