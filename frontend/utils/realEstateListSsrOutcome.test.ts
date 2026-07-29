import { describe, it, expect } from 'vitest'
import { resolveRealEstateListSsrOutcome } from '~/utils/realEstateListSsrOutcome'

describe('resolveRealEstateListSsrOutcome', () => {
  it('항목이 있으면 ok', () => {
    expect(resolveRealEstateListSsrOutcome({ hasError: false, fetchSettled: true, hasItems: true })).toBe('ok')
  })

  it('에러 없이 성공했는데 0건이면 empty — 목록 페이지에서 0건은 정상 상태다', () => {
    expect(resolveRealEstateListSsrOutcome({ hasError: false, fetchSettled: true, hasItems: false })).toBe('empty')
  })
})

describe('resolveRealEstateListSsrOutcome — 200 빈 본문 색인 회귀', () => {
  // 회귀 핵심: 백엔드 장애 시 이 페이지들은 HTTP 200 + `index, follow` 로
  // "거래 데이터가 준비 중입니다" 빈 본문을 냈고, routeRules 의
  // swr(s-maxage=300)이 no-store 를 덮어써 5분간 캐시됐다.
  // 2026-07-29 실측(백엔드 다운 + dev SSR):
  //   /real-estate/apt-sale               200  cache-control: s-maxage=300, stale-while-revalidate
  //   /real-estate/land/seoul             200  (동일)
  //   /real-estate/land/seoul/gangnam     200  (동일)
  // 본문 가시 텍스트 1,122자 중 대부분이 푸터·출처 보일러플레이트였다.
  it('fetch 에러면 degraded — 0건과 구분한다', () => {
    expect(resolveRealEstateListSsrOutcome({ hasError: true, fetchSettled: false, hasItems: false })).toBe('degraded')
  })

  it('에러는 fetchSettled 여부와 무관하게 degraded — 정상 0건으로 오인하지 않는다', () => {
    expect(resolveRealEstateListSsrOutcome({ hasError: true, fetchSettled: true, hasItems: false })).toBe('degraded')
  })

  it('SSR 렌더 시점에 미해결(pending)이면 degraded — 빈 본문 200 으로 새지 않는다', () => {
    expect(resolveRealEstateListSsrOutcome({ hasError: false, fetchSettled: false, hasItems: false })).toBe('degraded')
  })

  it('렌더할 항목이 있으면 잔여 에러가 있어도 ok — degraded 가 정상 렌더를 잠식하지 않는다', () => {
    expect(resolveRealEstateListSsrOutcome({ hasError: true, fetchSettled: true, hasItems: true })).toBe('ok')
  })
})

describe('resolveRealEstateListSsrOutcome — fail-open 불변식', () => {
  // #467 fail-open: 일시 장애를 404 나 영구 noindex 로 굳히지 않는다.
  // 이 함수는 어떤 입력에서도 not-found 류를 만들지 않는다 — 판정은 3종뿐이다.
  it.each([
    [true, true, true],
    [true, true, false],
    [true, false, true],
    [true, false, false],
    [false, true, true],
    [false, true, false],
    [false, false, true],
    [false, false, false],
  ])('hasError=%s fetchSettled=%s hasItems=%s → ok|empty|degraded 중 하나', (hasError, fetchSettled, hasItems) => {
    expect(['ok', 'empty', 'degraded']).toContain(
      resolveRealEstateListSsrOutcome({ hasError, fetchSettled, hasItems }),
    )
  })

  it('항목이 있으면 어떤 조합에서도 ok — 정상 응답이 degraded 로 강등되지 않는다', () => {
    for (const hasError of [true, false]) {
      for (const fetchSettled of [true, false]) {
        expect(resolveRealEstateListSsrOutcome({ hasError, fetchSettled, hasItems: true })).toBe('ok')
      }
    }
  })
})
