import { describe, it, expect } from 'vitest'
import { isGonePath } from '~/server/middleware/gone'
import GONE_FACILITIES from '~/server/data/goneFacilities.json'
import REDIRECTS from '~/server/data/facilityRedirects.json'

/**
 * 410 Gone — 의도적으로 제거한 URL 에서 색인 제거를 유도한다.
 *
 * 두 종류를 다룬다:
 *   1. 제거된 카테고리 (경로 접두/접미) — kiosk · public-rental · lh-rental
 *   2. 원천에서 사라진 개별 시설 (id 목록) — 학교 데이터를 NEIS 단일 소스로 재구성하면서
 *      NEIS 현재 목록에 없는 113건(폐교·통폐합, 학력인정 평생학교·공동실습소)을 삭제했다.
 *      갈 곳이 없으므로 301 이 아니라 410 이다.
 */
describe('isGonePath — 제거된 카테고리', () => {
  it('공공임대 허브/목록/상세를 410 처리한다', () => {
    expect(isGonePath('/public-rental')).toBe(true)
    expect(isGonePath('/public-rental/buy-lease')).toBe(true)
    expect(isGonePath('/public-rental/charter')).toBe(true)
    expect(isGonePath('/public-rental/announcements')).toBe(true)
    expect(isGonePath('/public-rental/announcements/2024010012345')).toBe(true)
  })

  it('레거시 /lh-rental 경로를 410 처리한다', () => {
    expect(isGonePath('/lh-rental')).toBe(true)
    expect(isGonePath('/lh-rental/buy-lease')).toBe(true)
  })

  it('청약 경로는 절대 410 처리하지 않는다', () => {
    expect(isGonePath('/subscription')).toBe(false)
    expect(isGonePath('/subscription/rent')).toBe(false)
    expect(isGonePath('/subscription/rent/public')).toBe(false)
    expect(isGonePath('/subscription/12345')).toBe(false)
  })

  it('기존 kiosk 제거 동작을 유지한다', () => {
    expect(isGonePath('/kiosk')).toBe(true)
    expect(isGonePath('/kiosk/seoul')).toBe(true)
  })
})

describe('isGonePath — 사라진 개별 시설', () => {
  const goneIds = GONE_FACILITIES as string[]

  it('목록에 있는 시설 상세를 410 처리한다', () => {
    const id = goneIds[0]
    const category = id.split('-')[0]
    expect(isGonePath(`/${category}/${id}`)).toBe(true)
  })

  it('후행 슬래시가 있어도 410 처리한다', () => {
    const id = goneIds[0]
    const category = id.split('-')[0]
    expect(isGonePath(`/${category}/${id}/`)).toBe(true)
  })

  it('목록에 없는 시설 상세는 410 처리하지 않는다', () => {
    expect(isGonePath('/school/school-B000013453')).toBe(false)
    expect(isGonePath('/school/school-doesnotexist')).toBe(false)
  })

  it('카테고리 세그먼트가 id 접두와 다르면 410 처리하지 않는다', () => {
    // /toilet/school-... 같은 오조합으로 엉뚱한 410 을 내지 않는다.
    const id = goneIds.find((g) => g.startsWith('school-'))!
    expect(isGonePath(`/toilet/${id}`)).toBe(false)
  })

  it('카테고리 허브·목록·지역 페이지는 건드리지 않는다', () => {
    expect(isGonePath('/school')).toBe(false)
    expect(isGonePath('/school/')).toBe(false)
    expect(isGonePath('/seoul/gangnam/school')).toBe(false)
    expect(isGonePath('/')).toBe(false)
  })

  it('410 목록과 301 매핑이 겹치지 않는다', () => {
    // 겹치면 미들웨어 실행 순서에 따라 동작이 갈린다. 데이터 단계에서 배타적이어야 한다.
    const redirects = REDIRECTS as Record<string, string>
    const overlap = goneIds.filter((id) => redirects[id] !== undefined)
    expect(overlap).toEqual([])
  })

  it('301 타깃이 410 목록에 있지 않다', () => {
    // 301 → 410 연결은 죽은 리다이렉트다.
    const redirects = REDIRECTS as Record<string, string>
    const goneSet = new Set(goneIds)
    const broken = Object.entries(redirects).filter(([, to]) => goneSet.has(to))
    expect(broken).toEqual([])
  })
})
