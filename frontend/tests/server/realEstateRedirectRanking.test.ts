import { describe, it, expect } from 'vitest'

/**
 * Task C4: ranking/new-high prefix pass-through 회귀 테스트
 *
 * `/real-estate/ranking/[type]` 와 `/real-estate/new-high/[type]` 경로가
 * redirect middleware의 LEGACY 정규식에 안 걸려(=리다이렉트/404 안 됨) pass-through됨을 검증.
 *
 * middleware/real-estate-redirect.ts 의 정규식들:
 * - LEGACY_TAB_DETAIL: /^\/real-estate\/(apt|villa|offitel)\/([^/]+)\/?$/
 * - LEGACY_TAB_LIST: /^\/real-estate\/(apt|villa|offitel)\/?$/
 * - LEGACY_SALE_DETAIL: /^\/real-estate\/(apt|villa|offitel)-(sale|rent)\/([^/]+)\/?$/
 *
 * 모두 2번째 세그먼트가 (apt|villa|offitel) 또는 (apt|villa|offitel)-(sale|rent) 형태이므로
 * ranking/new-high 는 어느 정규식에도 매칭되지 않아야 함.
 */

// middleware 와 동일한 정규식 (import 대신 복제 — middleware 는 h3 런타임 의존)
const LEGACY_TAB_DETAIL = /^\/real-estate\/(apt|villa|offitel)\/([^/]+)\/?$/
const LEGACY_TAB_LIST = /^\/real-estate\/(apt|villa|offitel)\/?$/
const LEGACY_SALE_DETAIL = /^\/real-estate\/(apt|villa|offitel)-(sale|rent)\/([^/]+)\/?$/

describe('ranking/new-high 경로는 redirect 정규식에 안 걸린다 (pass-through)', () => {
  const legacyPatterns = [LEGACY_TAB_DETAIL, LEGACY_TAB_LIST, LEGACY_SALE_DETAIL]

  describe('/real-estate/ranking/* 경로', () => {
    const rankingPaths = [
      '/real-estate/ranking/apt-sale',
      '/real-estate/ranking/apt-rent',
      '/real-estate/ranking/villa-sale',
      '/real-estate/ranking/villa-rent',
      '/real-estate/ranking/offitel-sale',
      '/real-estate/ranking/offitel-rent',
      '/real-estate/ranking/apt-sale/',
      '/real-estate/ranking/villa-rent/',
    ]

    for (const path of rankingPaths) {
      it(`${path} 는 어느 LEGACY 패턴에도 매칭 안 됨`, () => {
        for (const pattern of legacyPatterns) {
          expect(pattern.test(path)).toBe(false)
        }
      })
    }
  })

  describe('/real-estate/new-high/* 경로', () => {
    const newHighPaths = [
      '/real-estate/new-high/apt-sale',
      '/real-estate/new-high/apt-rent',
      '/real-estate/new-high/villa-sale',
      '/real-estate/new-high/villa-rent',
      '/real-estate/new-high/offitel-sale',
      '/real-estate/new-high/offitel-rent',
      '/real-estate/new-high/apt-sale/',
      '/real-estate/new-high/offitel-rent/',
    ]

    for (const path of newHighPaths) {
      it(`${path} 는 어느 LEGACY 패턴에도 매칭 안 됨`, () => {
        for (const pattern of legacyPatterns) {
          expect(pattern.test(path)).toBe(false)
        }
      })
    }
  })

  it('LEGACY 패턴들은 여전히 정상 작동 (회귀 방지)', () => {
    // LEGACY_TAB_LIST 는 /real-estate/apt 매칭
    expect(LEGACY_TAB_LIST.test('/real-estate/apt')).toBe(true)
    expect(LEGACY_TAB_LIST.test('/real-estate/villa')).toBe(true)

    // LEGACY_TAB_DETAIL 는 /real-estate/apt/{bldg} 매칭
    expect(LEGACY_TAB_DETAIL.test('/real-estate/apt/bldgname')).toBe(true)
    expect(LEGACY_TAB_DETAIL.test('/real-estate/villa/abc')).toBe(true)

    // LEGACY_SALE_DETAIL 는 /real-estate/apt-sale/{bldg} 매칭
    expect(LEGACY_SALE_DETAIL.test('/real-estate/apt-sale/bldg')).toBe(true)
    expect(LEGACY_SALE_DETAIL.test('/real-estate/villa-rent/xyz')).toBe(true)
  })
})
