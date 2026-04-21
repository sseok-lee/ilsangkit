import { describe, it, expect } from 'vitest'

/**
 * US-010 hotfix — legacy pattern 매칭 단위 테스트.
 *
 * middleware/real-estate-redirect.ts 의 정규식이 pattern별로 **정확히** 매칭하는지 확인.
 * 프로덕션 빌드에서 /real-estate/apt-sale 이 404 나던 회귀를 잡기 위해 도입.
 */

// middleware 와 동일한 정규식 (import 대신 복제 — middleware 는 h3 런타임 의존이 있어 테스트 환경에서 import 하면 사이드이펙트 발생)
const LEGACY_TAB_DETAIL = /^\/real-estate\/(apt|villa|offitel)\/([^/]+)\/?$/
const LEGACY_TAB_LIST = /^\/real-estate\/(apt|villa|offitel)\/?$/
const LEGACY_SALE_DETAIL = /^\/real-estate\/(apt|villa|offitel)-(sale|rent)\/([^/]+)\/?$/
const LEGACY_SALE_LIST = /^\/real-estate\/(apt|villa|offitel)-(sale|rent)\/?$/
const NEW_DETAIL = /^\/real-estate\/(apt|villa|offitel)-(sale|rent)\/[^/]+\/[^/]+\/[^/]+\/?$/
const NEW_HUB = /^\/real-estate\/(apt|villa|offitel)-(sale|rent)\/[^/]+\/[^/]+\/?$/

describe('LEGACY_TAB_LIST (/real-estate/apt)', () => {
  it('matches bare type-only hub', () => {
    expect(LEGACY_TAB_LIST.test('/real-estate/apt')).toBe(true)
    expect(LEGACY_TAB_LIST.test('/real-estate/villa')).toBe(true)
    expect(LEGACY_TAB_LIST.test('/real-estate/offitel')).toBe(true)
  })
  it('does NOT match type-mode, detail, or new hub', () => {
    expect(LEGACY_TAB_LIST.test('/real-estate/apt-sale')).toBe(false)
    expect(LEGACY_TAB_LIST.test('/real-estate/apt/bldg')).toBe(false)
    expect(LEGACY_TAB_LIST.test('/real-estate/apt-sale/seoul/gangnam')).toBe(false)
  })
})

describe('LEGACY_TAB_DETAIL (/real-estate/apt/{bldg})', () => {
  it('matches 2-segment detail path', () => {
    expect(LEGACY_TAB_DETAIL.test('/real-estate/apt/%EB%9E%98%EB%AF%B8%EC%95%88%EA%B0%95%EB%82%A8')).toBe(true)
    expect(LEGACY_TAB_DETAIL.test('/real-estate/villa/abc')).toBe(true)
  })
  it('does NOT match hub or type-mode', () => {
    expect(LEGACY_TAB_DETAIL.test('/real-estate/apt')).toBe(false)
    expect(LEGACY_TAB_DETAIL.test('/real-estate/apt-sale')).toBe(false)
  })
})

describe('LEGACY_SALE_LIST (/real-estate/apt-sale) — hotfix scope', () => {
  it('matches bare type-mode hub (no buildingName)', () => {
    expect(LEGACY_SALE_LIST.test('/real-estate/apt-sale')).toBe(true)
    expect(LEGACY_SALE_LIST.test('/real-estate/apt-rent')).toBe(true)
    expect(LEGACY_SALE_LIST.test('/real-estate/villa-sale')).toBe(true)
    expect(LEGACY_SALE_LIST.test('/real-estate/villa-rent')).toBe(true)
    expect(LEGACY_SALE_LIST.test('/real-estate/offitel-sale')).toBe(true)
    expect(LEGACY_SALE_LIST.test('/real-estate/offitel-rent')).toBe(true)
  })
  it('matches with trailing slash', () => {
    expect(LEGACY_SALE_LIST.test('/real-estate/apt-sale/')).toBe(true)
  })
  it('does NOT match when a building segment is present (that is LEGACY_SALE_DETAIL territory)', () => {
    expect(LEGACY_SALE_LIST.test('/real-estate/apt-sale/abc')).toBe(false)
  })
  it('does NOT match the new 4-segment hub (/type/city/dist)', () => {
    expect(LEGACY_SALE_LIST.test('/real-estate/apt-sale/seoul/gangnam')).toBe(false)
  })
})

describe('LEGACY_SALE_DETAIL (/real-estate/apt-sale/{bldg})', () => {
  it('matches 3-segment legacy detail', () => {
    expect(LEGACY_SALE_DETAIL.test('/real-estate/apt-sale/abc')).toBe(true)
  })
  it('does NOT match bare hub or new-shape URLs', () => {
    expect(LEGACY_SALE_DETAIL.test('/real-estate/apt-sale')).toBe(false)
    expect(LEGACY_SALE_DETAIL.test('/real-estate/apt-sale/seoul/gangnam')).toBe(false)
    expect(LEGACY_SALE_DETAIL.test('/real-estate/apt-sale/seoul/gangnam/bldg')).toBe(false)
  })
})

describe('NEW_HUB / NEW_DETAIL guards', () => {
  it('NEW_HUB matches 4-segment region hub', () => {
    expect(NEW_HUB.test('/real-estate/apt-sale/seoul/gangnam')).toBe(true)
    expect(NEW_HUB.test('/real-estate/villa-rent/seoul/gangnam')).toBe(true)
  })
  it('NEW_HUB does NOT match 5-segment detail (that is NEW_DETAIL)', () => {
    expect(NEW_HUB.test('/real-estate/apt-sale/seoul/gangnam/bldg')).toBe(false)
  })
  it('NEW_DETAIL matches 5-segment detail', () => {
    expect(NEW_DETAIL.test('/real-estate/apt-sale/seoul/gangnam/bldg')).toBe(true)
  })
  it('NEW_DETAIL does NOT match 4-segment hub', () => {
    expect(NEW_DETAIL.test('/real-estate/apt-sale/seoul/gangnam')).toBe(false)
  })
  it('NEW_* does NOT match legacy type-mode-only list (pass-through to LEGACY_SALE_LIST)', () => {
    expect(NEW_HUB.test('/real-estate/apt-sale')).toBe(false)
    expect(NEW_DETAIL.test('/real-estate/apt-sale')).toBe(false)
  })
})
