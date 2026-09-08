import { describe, it, expect } from 'vitest'
import { resolveFacilityRedirect } from '~/server/middleware/facility-redirect'
import REDIRECTS from '~/server/data/facilityRedirects.json'
import GONE_FACILITIES from '~/server/data/goneFacilities.json'

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

  it('school 이외 카테고리는 한 현행 URL 에 여러 고아가 매핑되지 않는다', () => {
    // 원래 매핑은 (이름, 구, 주소, 구별자) 양방향 유일성으로 생성했으므로 타깃도 유일했다.
    // school 은 NEIS 단일 소스 재구성에서 옛 URL 여럿이 한 생존자로 모이므로 제외한다(아래 참조).
    const values = Object.entries(REDIRECTS as Record<string, string>)
      .filter(([key]) => !key.startsWith('school-'))
      .map(([, to]) => to)
    expect(new Set(values).size).toBe(values.length)
  })

  it('school 은 옛 URL 여럿이 한 생존자를 가리킬 수 있다', () => {
    // NEIS 기준 재구성에서 같은 학교의 표준행·NEIS행이 하나로 합쳐졌고, 7/14 고아 매핑이
    // 이미 가리키던 URL 도 그 생존자로 합성됐다. 예: school-7010146 과 school-B000012842 가
    // 모두 school-B000011973 으로 간다 — 셋이 같은 학교다. 다대일은 리다이렉트로 정상이다.
    const entries = Object.entries(REDIRECTS as Record<string, string>)
      .filter(([key]) => key.startsWith('school-'))
    const byTarget = new Map<string, string[]>()
    for (const [from, to] of entries) {
      const list = byTarget.get(to)
      if (list) list.push(from)
      else byTarget.set(to, [from])
    }
    // 공유는 허용하되, 공유하는 쪽은 전부 school id 여야 한다(카테고리 혼입 방지).
    for (const [, sources] of byTarget) {
      expect(sources.every((s) => s.startsWith('school-'))).toBe(true)
    }
  })

  it('리다이렉트 타깃이 다시 리다이렉트되지 않는다', () => {
    // 연쇄가 생기면 크롤러가 두 홉을 타고, 중간 홉이 사라지면 끊긴다.
    const map = REDIRECTS as Record<string, string>
    const chained = Object.entries(map).filter(([, to]) => map[to] !== undefined)
    expect(chained).toEqual([])
  })

  it('리다이렉트 타깃이 410 목록에 없다', () => {
    // 301 → 410 은 죽은 리다이렉트다.
    const goneSet = new Set(GONE_FACILITIES as string[])
    const broken = Object.entries(REDIRECTS as Record<string, string>)
      .filter(([, to]) => goneSet.has(to))
    expect(broken).toEqual([])
  })
})
