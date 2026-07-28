import { describe, it, expect } from 'vitest'
import { resolveFacilitySsrOutcome } from '~/utils/facilitySsrOutcome'

describe('resolveFacilitySsrOutcome', () => {
  it('백엔드가 부재를 확정한 404/422 만 not-found', () => {
    expect(resolveFacilitySsrOutcome({ errorStatusCode: 404, fetchSettled: false, hasData: false })).toBe('not-found')
    expect(resolveFacilitySsrOutcome({ errorStatusCode: 422, fetchSettled: false, hasData: false })).toBe('not-found')
  })

  it('본문 데이터가 있으면 ok', () => {
    expect(resolveFacilitySsrOutcome({ fetchSettled: true, hasData: true })).toBe('ok')
  })

  it('에러 없이 성공했는데 본문이 비었으면 확정 부재(not-found)', () => {
    expect(resolveFacilitySsrOutcome({ fetchSettled: true, hasData: false })).toBe('not-found')
  })
})

describe('resolveFacilitySsrOutcome — 5xx 회귀 (사이트 기본 title 200 색인)', () => {
  // 회귀 핵심: 5xx 를 통과시키면 facility=null 인 채로 렌더돼
  // 사이트 기본 title 이 200 + index,follow 로 색인된다.
  // 네이버 진단 실측 — "일상킷 - 부동산 실거래가·청약·내 주변 생활정보" 50건(06-29 버스트),
  // "일상킷 - 내 주변 생활 편의 정보" 50건. 둘 다 표본 상한이라 실제 규모는 최소 50건씩.
  it.each([500, 502, 503, 504])('%i 은 degraded (404 로 굳히지도, 200 으로 렌더하지도 않음)', (code) => {
    expect(resolveFacilitySsrOutcome({ errorStatusCode: code, fetchSettled: false, hasData: false })).toBe('degraded')
  })

  it('5xx 는 fetchSettled 여부와 무관하게 degraded — 확정 부재로 오인하지 않는다', () => {
    expect(resolveFacilitySsrOutcome({ errorStatusCode: 500, fetchSettled: true, hasData: false })).toBe('degraded')
  })

  it('네트워크 실패(statusCode 없는 에러)도 degraded', () => {
    expect(resolveFacilitySsrOutcome({ errorStatusCode: undefined, fetchSettled: false, hasData: false })).toBe('degraded')
  })

  it('SSR 렌더 시점에 아직 미해결(pending)이어도 degraded — 200 기본 title 로 새지 않는다', () => {
    expect(resolveFacilitySsrOutcome({ fetchSettled: false, hasData: false })).toBe('degraded')
  })

  it('렌더할 데이터가 있으면 5xx 잔여 에러가 있어도 ok — degraded 판정이 정상 렌더를 잠식하지 않는다', () => {
    // useAsyncData 에서 에러와 데이터가 동시에 남는 경우(재시도 성공 등).
    // 보여줄 본문이 있으면 굳이 503 으로 깎지 않는다.
    expect(resolveFacilitySsrOutcome({ errorStatusCode: 500, fetchSettled: false, hasData: true })).toBe('ok')
  })
})

describe('resolveFacilitySsrOutcome — fail-open 불변식', () => {
  it('확정 404/422 가 아니면 어떤 입력도 not-found 를 만들지 않는다', () => {
    const transientCodes = [undefined, 500, 502, 503, 504, 429, 408]
    for (const code of transientCodes) {
      for (const settled of [true, false]) {
        const outcome = resolveFacilitySsrOutcome({ errorStatusCode: code, fetchSettled: settled, hasData: false })
        // 에러 없이 성공 + 빈 본문만 확정 부재로 인정한다.
        const expected = code === undefined && settled ? 'not-found' : 'degraded'
        expect(outcome, `code=${code} settled=${settled}`).toBe(expected)
      }
    }
  })
})
