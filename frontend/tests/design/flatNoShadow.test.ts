import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// 평면 요소는 그림자 대신 선으로 구획한다(스펙 2026-10-02 §3).
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const read = (p: string) => readFileSync(resolve(root, p), 'utf8')
const ANY_SHADOW = /(?:^|[\s"'`:])shadow(?:-[\w[\]().,/#%-]+)?(?=[\s"'`])/

// msw-demo.vue 는 .gitignore 대상(로컬 전용)이라 CI 체크아웃에는 없다.
const FILES = [
  'pages/article/[slug].vue',
  'components/blog/BlogReviewCard.vue',
  'components/realEstate/map/RealEstateMapCanvas.vue',
  'components/realEstate/map/RealEstateMapExplorer.vue',
  'pages/admin/login.vue',
  'pages/msw-demo.vue',
].filter((f) => existsSync(resolve(root, f)))

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
    expect(src).toMatch(/rounded-lg border border-line bg-white px-4 text-primary"\s+aria-current="page"/)
  })
})
