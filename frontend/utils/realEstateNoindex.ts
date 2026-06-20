/**
 * 부동산 상세 페이지 noindex 판단 유틸.
 *
 * noindex 출력 조건(둘 중 하나):
 * 1. buildingName이 지번 패턴(INVALID_BUILDING_NAME) → 적극 증거 → noindex
 * 2. 로드 완료 + buildingInfo 없음(백엔드 404 확정) → noindex
 *
 * 단, SSR fetch가 일시 실패(fetchFailed)한 경우는 절대 noindex하지 않는다(fail-open).
 * 과거에는 총 거래 < 10건도 noindex했으나 색인률 회복을 위해 2026-05 폐지.
 */
import { INVALID_BUILDING_NAME } from './realEstateBuildingName'
import { shouldNoindexSsr } from './ssrIndexability'

export interface RealEstateNoindexInput {
  buildingName: string
  loaded: boolean
  hasBuildingInfo: boolean
  /** SSR building-info fetch가 일시 실패했는가. true면 noindex 금지. */
  fetchFailed?: boolean
}

export function shouldNoindexRealEstateDetail(input: RealEstateNoindexInput): boolean {
  return shouldNoindexSsr({
    positiveNoindex: INVALID_BUILDING_NAME.test(input.buildingName),
    fetchFailed: input.fetchFailed ?? false,
    confirmedEmpty: input.loaded && !input.hasBuildingInfo,
  })
}
