import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// 청약 탭(SubscriptionNav)은 자체 아래 선이 있다. 바로 위 PageHead 의 선을 끄지 않으면 이중선이 된다.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const read = (p: string) => readFileSync(resolve(root, p), 'utf8')

const PAGES = [
  'pages/subscription/index.vue',
  'pages/subscription/sale/index.vue',
  'pages/subscription/sale/[type].vue',
  'pages/subscription/rent/index.vue',
  'pages/subscription/rent/[type].vue',
]
const LIST_PAGES = PAGES.slice(1)

describe('청약 머리 × 탭 이중선', () => {
  for (const file of PAGES) {
    it(`${file}: PageHead 의 아래 선을 끈다`, () => {
      expect(read(file)).toMatch(/<PageHead\b[^>]*:border="false"/)
    })
  }

  for (const file of LIST_PAGES) {
    it(`${file}: 목록 컨테이너는 위 여백 없이 탭이 머리 여백에 붙는다`, () => {
      const src = read(file)
      expect(src).toContain('<div class="page-container pb-5 md:pb-6">')
      expect(src).not.toContain('<div class="page-container py-5 md:py-6">')
    })
  }

  it('flush 규칙은 아래 선만 끈다(여백 유지)', () => {
    const css = read('assets/css/main.css')
    expect(css).toMatch(/\.page-head--flush\s*\{\s*border-bottom:\s*0;\s*\}/)
  })
})
