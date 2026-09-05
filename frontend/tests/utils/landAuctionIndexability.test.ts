import { describe, it, expect } from 'vitest'
import {
  isTransactionDocumentIndexable,
  isListingDocumentIndexable,
  MIN_INDEXABLE_TRANSACTIONS,
} from '~/utils/indexability'

/**
 * 토지 동상세(거래 집계)와 공매 랭킹·토지 허브(목록)가 공유하는 색인 판정 경계.
 *
 * 이 파일이 지키는 두 가지 회귀:
 * - 과잉 제외: sync 시점 스냅샷(최근 5건 또는 누적 10건)이 콘텐츠 있는 동을 noindex 로 만들었다.
 * - fail-open 위반: 일시 장애가 noindex 로 굳었다(503 과 noindex 동시 송출).
 */
describe('isTransactionDocumentIndexable — 거래 집계 문서 색인 경계', () => {
  it(`임계값은 ${MIN_INDEXABLE_TRANSACTIONS}건이다`, () => {
    expect(MIN_INDEXABLE_TRANSACTIONS).toBe(3)
  })

  it('2건은 색인 대상이 아니다(경계 아래)', () => {
    expect(isTransactionDocumentIndexable({ transactionCount: 2 })).toBe(false)
  })

  it('3건은 색인 대상이다(경계 정확히)', () => {
    expect(isTransactionDocumentIndexable({ transactionCount: 3 })).toBe(true)
  })

  it('4건은 색인 대상이다(경계 위)', () => {
    expect(isTransactionDocumentIndexable({ transactionCount: 4 })).toBe(true)
  })

  it('0건은 색인 대상이 아니다', () => {
    expect(isTransactionDocumentIndexable({ transactionCount: 0 })).toBe(false)
  })

  it('sync 스냅샷이 제외하던 "총 5건 중 최근 3건" 동은 이제 색인 대상이다', () => {
    // 최근 12개월 5건 미달 + 누적 10건 미달 → 예전 정책은 noindex.
    // 그런데도 지목별 시세 그리드와 대지 거래 사례 카드가 전부 렌더된다.
    expect(isTransactionDocumentIndexable({ transactionCount: 5 })).toBe(true)
  })

  it('fetch 실패는 건수가 임계 미만이어도 색인 상태를 건드리지 않는다(fail-open)', () => {
    expect(isTransactionDocumentIndexable({ transactionCount: 0, fetchFailed: true })).toBe(true)
    expect(isTransactionDocumentIndexable({ transactionCount: 1, fetchFailed: true })).toBe(true)
  })

  it('건수 미확보(undefined/null)는 "없다"로 굳히지 않는다', () => {
    expect(isTransactionDocumentIndexable({ transactionCount: undefined })).toBe(true)
    expect(isTransactionDocumentIndexable({ transactionCount: null })).toBe(true)
  })
})

describe('isListingDocumentIndexable — 목록 문서 색인 경계', () => {
  it('0건은 소프트 404 라 색인 대상이 아니다', () => {
    expect(isListingDocumentIndexable({ itemCount: 0 })).toBe(false)
  })

  it('1건이라도 있으면 색인 대상이다(데이터가 생기면 자동 복귀)', () => {
    expect(isListingDocumentIndexable({ itemCount: 1 })).toBe(true)
  })

  it('fetch 실패는 0건이어도 색인 상태를 건드리지 않는다(fail-open)', () => {
    expect(isListingDocumentIndexable({ itemCount: 0, fetchFailed: true })).toBe(true)
  })
})
