import { describe, it, expect } from 'vitest'
import { resolveFacilityRedirect } from '~/server/middleware/facility-redirect'
import REDIRECTS from '~/server/data/facilityRedirects.json'

/**
 * 고아 시설 URL → 현행 URL 301.
 *
 * 배경: 2026-07-01 전남광주통합특별시 출범으로 공공데이터 API 가 주소 값을 갱신했고,
 * sourceId 가 주소를 재료로 쓰는 카테고리(sports 등)는 같은 시설이 새 sourceId 로
 * INSERT 됐다. 2026-07-14 sync 실측: sports 신규 4,153 / school 신규 1,215.
 * 옛 행은 갱신되지 않고 남아 같은 시설이 두 URL 로 200·index·자기참조 canonical 이 됐다.
 */
describe('resolveFacilityRedirect', () => {
  it('매핑된 고아 URL 을 현행 URL 로 치환한다', () => {
    const [oldId, newId] = Object.entries(REDIRECTS)[0] as [string, string]
    const category = oldId.split('-')[0]
    expect(resolveFacilityRedirect(`/${category}/${oldId}`)).toBe(`/${category}/${newId}`)
  })

  it('매핑에 없는 URL 은 null 을 반환한다', () => {
    expect(resolveFacilityRedirect('/sports/sports-doesnotexist000')).toBeNull()
  })

  it('카테고리 세그먼트가 id 접두와 다르면 치환하지 않는다', () => {
    const oldId = Object.keys(REDIRECTS).find((k) => k.startsWith('sports-'))!
    expect(resolveFacilityRedirect(`/toilet/${oldId}`)).toBeNull()
  })

  it('목록·지역 페이지는 건드리지 않는다', () => {
    expect(resolveFacilityRedirect('/sports')).toBeNull()
    expect(resolveFacilityRedirect('/seoul/gangnam/sports')).toBeNull()
    expect(resolveFacilityRedirect('/')).toBeNull()
    expect(resolveFacilityRedirect('/real-estate/apt-sale/seoul/gangnam/은마')).toBeNull()
  })

  it('후행 슬래시가 있어도 매칭한다', () => {
    const [oldId, newId] = Object.entries(REDIRECTS)[0] as [string, string]
    const category = oldId.split('-')[0]
    expect(resolveFacilityRedirect(`/${category}/${oldId}/`)).toBe(`/${category}/${newId}`)
  })

  it('타깃이 다시 리다이렉트되지 않는다 (체인·자기참조 없음)', () => {
    const map = REDIRECTS as Record<string, string>
    const targets = new Set(Object.values(map))
    for (const key of Object.keys(map)) {
      expect(targets.has(key)).toBe(false)
      expect(map[key]).not.toBe(key)
    }
  })

  it('ev-charger 는 포함하지 않는다 (행 id 가 URL 이 아니라 statId 단위)', () => {
    expect(Object.keys(REDIRECTS).some((k) => k.startsWith('ev-charger'))).toBe(false)
  })

  it('한 현행 URL 에 여러 고아가 매핑되지 않는다', () => {
    const values = Object.values(REDIRECTS as Record<string, string>)
    expect(new Set(values).size).toBe(values.length)
  })
})
