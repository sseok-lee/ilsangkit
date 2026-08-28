import { describe, it, expect } from 'vitest'
import { resolveErrorPageCopy, errorPagePath, facilityCategoryFromPath } from '~/utils/errorPageCopy'

describe('resolveErrorPageCopy — 410 Gone', () => {
  it('시설 카테고리가 확정되면 폐업/폐원 문구를 쓴다', () => {
    const copy = resolveErrorPageCopy({ statusCode: 410, facilityCategory: 'childcare' })
    expect(copy.kind).toBe('gone')
    expect(copy.title).toBe('운영이 종료된 시설입니다')
    expect(copy.description).toContain('어린이집')
    // 회귀 방지: 410 은 영구 응답이므로 "잠시 후 다시 시도" 를 절대 쓰지 않는다.
    expect(copy.description).not.toContain('다시 시도')
    expect(copy.title).not.toBe('오류가 발생했습니다')
  })

  it('카테고리 목록 CTA 를 준다', () => {
    const copy = resolveErrorPageCopy({ statusCode: 410, facilityCategory: 'childcare' })
    expect(copy.categoryCta).toEqual({ href: '/childcare', label: '어린이집 전체 보기' })
  })

  it('탈출구(재검색·바로가기)를 노출한다', () => {
    expect(resolveErrorPageCopy({ statusCode: 410, facilityCategory: 'childcare' }).showRecovery).toBe(true)
  })

  it('카테고리를 못 뽑아도 오류 문구로 떨어지지 않는다', () => {
    const copy = resolveErrorPageCopy({ statusCode: 410, facilityCategory: null })
    expect(copy.kind).toBe('gone')
    expect(copy.title).toBe('삭제된 페이지입니다')
    expect(copy.description).not.toContain('다시 시도')
    expect(copy.categoryCta).toBeNull()
    expect(copy.showRecovery).toBe(true)
  })

  it('전 시설 카테고리에서 CATEGORY_META 라벨로 문구가 만들어진다', () => {
    for (const c of ['toilet', 'aed', 'hospital', 'ev-charger', 'subway'] as const) {
      const copy = resolveErrorPageCopy({ statusCode: 410, facilityCategory: c })
      expect(copy.categoryCta?.href).toBe(`/${c}`)
      expect(copy.categoryCta?.label).toMatch(/ 전체 보기$/)
      expect(copy.description).not.toContain('undefined')
    }
  })
})

describe('resolveErrorPageCopy — 404 / 5xx 기존 동작 유지', () => {
  it('404 문구와 탈출구는 그대로다', () => {
    const copy = resolveErrorPageCopy({ statusCode: 404 })
    expect(copy.kind).toBe('not-found')
    expect(copy.title).toBe('페이지를 찾을 수 없습니다')
    expect(copy.description).toBe('요청하신 페이지가 존재하지 않거나 이동되었을 수 있습니다.')
    expect(copy.showRecovery).toBe(true)
    expect(copy.categoryCta).toBeNull()
  })

  it('5xx 는 일시 장애 문구 + 탈출구 없음(재시도가 정답)', () => {
    for (const code of [500, 502, 503, 504]) {
      const copy = resolveErrorPageCopy({ statusCode: code })
      expect(copy.kind).toBe('error')
      expect(copy.title).toBe('오류가 발생했습니다')
      expect(copy.description).toContain('다시 시도')
      expect(copy.showRecovery).toBe(false)
    }
  })

  it('statusCode 가 없으면 500 취급', () => {
    expect(resolveErrorPageCopy({}).kind).toBe('error')
    expect(resolveErrorPageCopy({ statusCode: undefined }).title).toBe('오류가 발생했습니다')
  })
})

describe('errorPagePath — Nuxt error.url 에서 경로 추출', () => {
  it('error.url 을 쓴다 (프로덕션 410 페이로드 실측 형태)', () => {
    expect(errorPagePath({ url: '/childcare/childcare-27230000317' })).toBe('/childcare/childcare-27230000317')
  })

  it('쿼리·해시를 떼어낸다', () => {
    expect(errorPagePath({ url: '/childcare/childcare-1?a=1#x' })).toBe('/childcare/childcare-1')
  })

  it('절대 URL 도 경로만 남긴다', () => {
    expect(errorPagePath({ url: 'https://ilsangkit.co.kr/aed/aed-1?x=2' })).toBe('/aed/aed-1')
  })

  it('url 이 없으면 fallback 경로를 쓴다', () => {
    expect(errorPagePath({}, '/childcare/childcare-9')).toBe('/childcare/childcare-9')
    expect(errorPagePath(undefined, '/toilet/toilet-9')).toBe('/toilet/toilet-9')
  })

  it('아무것도 없으면 루트 — 던지지 않는다', () => {
    expect(errorPagePath(undefined)).toBe('/')
    expect(errorPagePath({ url: '' })).toBe('/')
  })
})

describe('facilityCategoryFromPath', () => {
  it('시설 상세 경로에서 카테고리를 뽑는다', () => {
    expect(facilityCategoryFromPath('/childcare/childcare-27230000317')).toBe('childcare')
    expect(facilityCategoryFromPath('/aed/aed-775d759e15ff')).toBe('aed')
    expect(facilityCategoryFromPath('/ev-charger/EV006658')).toBe('ev-charger')
  })

  it('subway 도 포함한다 (resolveSearchScope 와 달리 제외하지 않음)', () => {
    expect(facilityCategoryFromPath('/subway/geomdan-oryu')).toBe('subway')
  })

  it('목록 경로도 카테고리로 인정한다', () => {
    expect(facilityCategoryFromPath('/childcare')).toBe('childcare')
  })

  it('시설이 아닌 경로는 null', () => {
    expect(facilityCategoryFromPath('/real-estate/apt-sale/seoul/guro/x')).toBeNull()
    expect(facilityCategoryFromPath('/guide/foo')).toBeNull()
    expect(facilityCategoryFromPath('/')).toBeNull()
    expect(facilityCategoryFromPath('')).toBeNull()
  })
})
