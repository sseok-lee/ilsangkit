/**
 * 색인 가능 여부 판정 — 명시적 정책 함수 모음.
 *
 * ## 왜 별도 모듈인가
 *
 * noindex 판단이 페이지마다 인라인 조건식으로 흩어져 있었다. 그래서 두 방향으로 동시에 틀렸다.
 *
 * - **과잉 제외**: 토지 동상세는 sync 시점에 계산된 `LandRegionSummary.isIndexable`
 *   (최근 12개월 5건 이상 **또는** 누적 10건 이상)만 보고 noindex 를 찍었다. 거래 5건이
 *   전부 1년 넘은 동은 recentCount 3 / total 5 → 두 조건 모두 미달 → 지목별 시세 그리드와
 *   거래 사례 카드를 전부 렌더하면서도 색인에서 빠졌다.
 * - **과소 제외**: 공매 랭킹처럼 "데이터가 없으면 빈 상태 문구만 남는" 페이지가
 *   200 + index + self-canonical 로 나가 소프트 404 로 분류됐다.
 *
 * 두 경우 모두 "이 문서에 실질 콘텐츠가 있는가" 라는 같은 질문이다. 그 질문을 이름 있는
 * 함수로 고정해서 페이지가 조건식을 새로 짜지 못하게 한다.
 *
 * ## 공통 원칙 (기존 utils/ssrIndexability.ts 의 fail-open 원칙을 그대로 따른다)
 *
 * 1. **일시 장애는 절대 noindex 로 굳히지 않는다.** fetch 실패는 503 + no-store 로 알리고
 *    (utils/detailSsrDegraded.ts, composables/useDegradedResponse.ts) 색인 상태는 건드리지 않는다.
 * 2. **noindex 문서는 sitemap 에 넣지 않는다.** 같은 판정을 사이트맵 쪽에서도 쓴다.
 * 3. **데이터가 생기면 자동으로 indexable 이 된다.** 임계값은 요청 시점 데이터로 평가하며,
 *    수동 허용 목록이나 sync 시점 스냅샷 플래그에 의존하지 않는다.
 */

/**
 * 실거래 집계 문서(토지 동/구, 부동산 목록)를 색인 대상으로 볼 최소 거래 건수.
 *
 * 3건인 이유: 1~2건이면 "평균가"·"면적별 시세" 같은 집계 표현이 사실상 개별 거래의
 * 반복이라 이웃 문서와 구별되는 정보가 생기지 않는다. 3건부터 분포가 만들어진다.
 * 상한을 낮게 잡은 것은 의도적이다 — 종전 sync 시점 기준(최근 5건 또는 누적 10건)이
 * 실제 콘텐츠가 있는 문서를 대량으로 제외하고 있었고, 그 회복이 이 값의 목적이다.
 */
export const MIN_INDEXABLE_TRANSACTIONS = 3

export interface TransactionDocumentInput {
  /** 이 문서가 실제로 렌더하는 거래 건수. 미확보(undefined)면 보수적으로 indexable 로 둔다. */
  transactionCount: number | null | undefined
  /** SSR fetch 가 일시 실패했는가. true 면 절대 noindex 하지 않는다(fail-open). */
  fetchFailed?: boolean
}

/**
 * 거래 데이터 기반 문서(토지 동상세 등)의 색인 여부.
 *
 * - fetch 실패 → indexable 유지 (fail-open). 상태 코드로만 degraded 를 알린다.
 * - 건수 미확보(undefined/null) → indexable 유지. "모른다"를 "없다"로 굳히지 않는다.
 * - 0건 또는 임계 미만 → noindex.
 */
export function isTransactionDocumentIndexable(input: TransactionDocumentInput): boolean {
  if (input.fetchFailed) return true
  const count = input.transactionCount
  if (count === null || count === undefined) return true
  return count >= MIN_INDEXABLE_TRANSACTIONS
}

export interface ListingDocumentInput {
  /** 이 문서 본문을 이루는 항목 수(랭킹 행, 목록 카드 등). */
  itemCount: number | null | undefined
  /** SSR fetch 가 일시 실패했는가. true 면 noindex 하지 않는다(fail-open). */
  fetchFailed?: boolean
}

/**
 * 본문이 목록/표 하나로 이루어진 문서(공매 랭킹 등)의 색인 여부.
 *
 * 항목이 0이면 남는 것은 빈 상태 문구뿐이라 소프트 404 다. 항목이 생기면 다음 요청부터
 * 자동으로 indexable 이 된다 — 별도 배포나 플래그 전환이 필요 없다.
 */
export function isListingDocumentIndexable(input: ListingDocumentInput): boolean {
  if (input.fetchFailed) return true
  const count = input.itemCount
  if (count === null || count === undefined) return true
  return count > 0
}
