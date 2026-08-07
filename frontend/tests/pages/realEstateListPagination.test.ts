/**
 * 부동산 목록 SSR 페이지네이션 회귀 방지.
 *
 * 고친 버그: SSR 이 `?page=N` 을 읽지 않아 `/real-estate/apt-sale?page=2` 가 1페이지와
 * 바이트 단위로 같은 본문을 냈다. 페이지네이션을 <a href> 로 열면 같은 콘텐츠가 여러
 * URL 로 노출되는 중복이 새로 생기므로, #719 에서는 부동산을 의도적으로 제외했었다.
 *
 * 이 파일이 지키는 두 가지 계약:
 *  1) useAsyncData 키에 page 가 들어간다 — 안 들어가면 2페이지 요청이 1페이지 캐시를
 *     그대로 돌려받아 버그가 조용히 재현된다. 렌더 결과만 보는 테스트로는 못 잡는다.
 *  2) 목록 fetch 에 하드코딩된 page 1 이 남아있지 않다.
 *
 * 페이지 SFC 를 mount 하지 않고 소스 계약을 검사한다. 같은 저장소의
 * tests/server/robots.test.ts 가 robots.txt 파일을 직접 읽는 것과 같은 방식이다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const PAGES = {
  national: 'pages/real-estate/[realEstateType]/index.vue',
  district: 'pages/real-estate/[realEstateType]/[city]/[district]/index.vue',
} as const

function read(rel: string): string {
  return readFileSync(resolve(process.cwd(), rel), 'utf-8')
}

/** useAsyncData(<key>, ...) 의 첫 인자(키 템플릿)만 뽑는다. */
function extractAsyncDataKey(src: string): string {
  const m = /useAsyncData\(\s*(`[^`]*`)/.exec(src)
  return m ? m[1] : ''
}

describe('부동산 목록 SSR 페이지네이션', () => {
  for (const [label, rel] of Object.entries(PAGES)) {
    describe(label, () => {
      const src = read(rel)

      it('SSR 이 route.query.page 를 읽어 초기 페이지를 정한다', () => {
        expect(src).toContain('parsePositivePageQuery(route.query.page)')
      })

      it('useAsyncData 키에 page 가 포함된다 (없으면 2페이지가 1페이지 캐시를 받는다)', () => {
        const key = extractAsyncDataKey(src)
        expect(key, `${rel} 에서 useAsyncData 키를 찾지 못했다`).not.toBe('')
        expect(key).toMatch(/\$\{\s*initialPage\s*\}/)
      })

      it('초기 목록 fetch 가 하드코딩된 1페이지를 쓰지 않는다', () => {
        // getComplexList(..., undefined, 1, 24) 처럼 리터럴 1 을 넘기던 형태가 남아있으면 안 된다.
        expect(src).not.toMatch(/getComplexList\([^)]*undefined,\s*1\s*,/s)
      })

      it('페이지네이션을 <a href> 로 렌더하도록 href-for 를 넘긴다', () => {
        expect(src).toContain(':href-for="pageHref"')
        expect(src).toContain('buildPageHref(route.path, route.query, page)')
      })

      it('page 이동 시 URL 을 동기화한다 (href 와 SPA URL 이 갈라지지 않게)', () => {
        expect(src).toContain('syncPageQuery')
        expect(src).toMatch(/navigateTo\(\{\s*query:\s*syncPageQuery\(/)
      })

      it('page 1 이면 query 에서 page 키를 제거한다 (canonical URL 과 동일 유지)', () => {
        expect(src).toMatch(/else\s+delete\s+nextQuery\.page/)
      })

      it('뒤로/앞으로가기를 위해 route.query.page 를 watch 한다', () => {
        expect(src).toMatch(/watch\(\s*\(\)\s*=>\s*route\.query\.page/)
      })
    })
  }

  it('두 페이지 모두 page 2+ 에 noindex 를 적용한다', () => {
    // 전국은 currentPage, 지역은 pageQueryParam 으로 판정한다(둘 다 route.query.page 에 연동됨).
    expect(read(PAGES.national)).toMatch(/isNoindex\s*=\s*currentPage\.value\s*>\s*1/)
    expect(read(PAGES.district)).toMatch(/pageQueryParam\.value\s*>\s*1/)
  })
})
