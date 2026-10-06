import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// 장식 아이콘은 읽기 도구에서 숨기고("close"·"info" 를 읽지 않게), 아이콘만 있는 버튼·링크에는 이름을 준다.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const template = (p: string) => readFileSync(resolve(root, p), 'utf8').split('<script')[0]

const PAGES = ['pages/subscription/[id].vue', 'pages/[category]/[id].vue', 'pages/subway/[slug].vue']

// <span ... class="material-symbols-outlined ..." ...> 태그 전체
const ICON_TAG = /<span\b[^>]*class="material-symbols-outlined[^"]*"[^>]*>/g
// 지도 확대 화면의 아이콘만 있는 카카오맵 길찾기 원형 버튼(size-11). 글자가 있는 드롭다운 링크는 대상이 아니다.
const KAKAO_LINK = /<a\b(?=[^>]*(?:kakaoMapUrl|map\.kakao\.com\/link\/to))(?=[^>]*size-11)[^>]*>/g

describe('상세 페이지 아이콘 접근성', () => {
  for (const file of PAGES) {
    it(`${file}: 모든 아이콘이 aria-hidden`, () => {
      const icons = template(file).match(ICON_TAG) ?? []
      expect(icons.length).toBeGreaterThan(0)
      expect(icons.filter((t) => !t.includes('aria-hidden="true"'))).toEqual([])
    })

    it(`${file}: 카카오맵 길찾기 원형 버튼에 이름이 있다`, () => {
      const links = template(file).match(KAKAO_LINK) ?? []
      expect(links.length).toBe(1)
      expect(links.filter((t) => !t.includes('aria-label="카카오맵 길찾기 (새 창)"'))).toEqual([])
    })
  }

  it('청약 상세 지도 닫기 버튼에 이름이 있다', () => {
    expect(template('pages/subscription/[id].vue')).toMatch(/<button\b[^>]*aria-label="지도 닫기"[^>]*@click="isMapExpanded = false"/)
  })

  it('청약 상세에 font-display 가 없다(미로딩 글꼴, 본문과 같은 Pretendard 로 떨어짐)', () => {
    expect(template('pages/subscription/[id].vue')).not.toContain('font-display')
  })
})
