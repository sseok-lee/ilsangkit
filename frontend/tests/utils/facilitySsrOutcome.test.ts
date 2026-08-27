import { describe, it, expect } from 'vitest'
import { resolveFacilitySsrOutcome } from '~/utils/facilitySsrOutcome'

/**
 * 시설 상세 SSR 응답 판정. 'gone'(410) 은 원천에서 영구히 사라진 시설용이다 —
 * 백엔드가 FacilityGone 조회로 확정한 경우에만 나온다.
 */
describe('resolveFacilitySsrOutcome', () => {
  it('백엔드 410 은 gone 으로 판정한다', () => {
    expect(resolveFacilitySsrOutcome({ errorStatusCode: 410, fetchSettled: false, hasData: false }))
      .toBe('gone')
  })

  it('410 은 데이터가 있어도 gone 이다 (확정 신호가 우선)', () => {
    expect(resolveFacilitySsrOutcome({ errorStatusCode: 410, fetchSettled: true, hasData: true }))
      .toBe('gone')
  })

  it('404·422 는 not-found 를 유지한다', () => {
    expect(resolveFacilitySsrOutcome({ errorStatusCode: 404, fetchSettled: false, hasData: false }))
      .toBe('not-found')
    expect(resolveFacilitySsrOutcome({ errorStatusCode: 422, fetchSettled: false, hasData: false }))
      .toBe('not-found')
  })

  it('데이터가 있으면 ok', () => {
    expect(resolveFacilitySsrOutcome({ errorStatusCode: undefined, fetchSettled: true, hasData: true }))
      .toBe('ok')
  })

  it('에러 없이 성공했는데 본문이 비면 not-found', () => {
    expect(resolveFacilitySsrOutcome({ errorStatusCode: undefined, fetchSettled: true, hasData: false }))
      .toBe('not-found')
  })

  it('5xx 는 degraded — 일시 장애를 하드 404 로 굳히지 않는다 (fail-open)', () => {
    expect(resolveFacilitySsrOutcome({ errorStatusCode: 503, fetchSettled: false, hasData: false }))
      .toBe('degraded')
    expect(resolveFacilitySsrOutcome({ errorStatusCode: 500, fetchSettled: false, hasData: false }))
      .toBe('degraded')
  })

  it('SSR 렌더 시점 미해결도 degraded', () => {
    expect(resolveFacilitySsrOutcome({ errorStatusCode: undefined, fetchSettled: false, hasData: false }))
      .toBe('degraded')
  })
})
