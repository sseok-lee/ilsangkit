import { describe, it, expect } from 'vitest'
import { isDetailSsrDegraded } from '~/utils/detailSsrDegraded'

describe('isDetailSsrDegraded', () => {
  it('데이터가 정상이면 degraded 아님', () => {
    expect(isDetailSsrDegraded({ hasError: false, hasData: true, explicitFailure: false })).toBe(false)
  })

  it('핸들러가 내부적으로 실패를 표시하면 degraded', () => {
    expect(isDetailSsrDegraded({ hasError: false, hasData: true, explicitFailure: true })).toBe(true)
  })
})

describe('isDetailSsrDegraded — 핸들러 자체가 죽은 경우 (회귀 핵심)', () => {
  // 기존 코드는 `ssrData.value?.infoFetchFailed` 만 봤다.
  // 그 플래그는 핸들러 "안에서" 세팅되므로, 핸들러가 통째로 throw 하면
  // ssrData 는 null 이고 옵셔널 체이닝 결과는 undefined → 가드가 통과된다.
  // 결과: 백엔드 장애 중 데이터 없는 페이지가 HTTP 200 으로 나간다.
  // 정작 그걸 잡아줄 error ref 는 구조분해만 해두고 한 번도 쓰이지 않았다.
  it('데이터가 없으면 degraded — explicitFailure 를 읽을 수조차 없다', () => {
    expect(isDetailSsrDegraded({ hasError: false, hasData: false, explicitFailure: false })).toBe(true)
  })

  it('error 가 있으면 degraded', () => {
    expect(isDetailSsrDegraded({ hasError: true, hasData: false, explicitFailure: false })).toBe(true)
  })

  it('데이터가 있어도 error 가 남아 있으면 degraded', () => {
    expect(isDetailSsrDegraded({ hasError: true, hasData: true, explicitFailure: false })).toBe(true)
  })

  it('explicitFailure 를 생략해도 데이터 없으면 degraded', () => {
    expect(isDetailSsrDegraded({ hasError: false, hasData: false })).toBe(true)
  })
})

describe('isDetailSsrDegraded — fail-open 불변식', () => {
  // #467: 일시 장애를 404 나 영구 noindex 로 굳히지 않는다.
  // 이 함수는 boolean 만 돌려주며, 판정은 "503 + no-store 를 붙일지"에만 쓰인다.
  it('모든 입력 조합에서 boolean 을 반환한다', () => {
    for (const hasError of [true, false]) {
      for (const hasData of [true, false]) {
        for (const explicitFailure of [true, false, undefined]) {
          expect(typeof isDetailSsrDegraded({ hasError, hasData, explicitFailure })).toBe('boolean')
        }
      }
    }
  })

  it('정상 응답은 어떤 경우에도 degraded 로 오판하지 않는다', () => {
    expect(isDetailSsrDegraded({ hasError: false, hasData: true })).toBe(false)
    expect(isDetailSsrDegraded({ hasError: false, hasData: true, explicitFailure: false })).toBe(false)
  })
})
