/**
 * 부동산 상세 페이지 noindex 판단 유틸.
 *
 * 두 조건 중 하나라도 참이면 `<meta name="robots" content="noindex, follow">`를 출력해
 * 색인 부적합 URL이 검색엔진에 색인되지 않도록 한다.
 *
 * 1. `buildingName`이 지번 패턴 → 즉시 noindex (SSR 첫 바이트부터 차단)
 * 2. 데이터 로드 완료 && `buildingInfo` 없음 → 존재하지 않는 건물
 *
 * 과거에는 총 거래 < 10건도 noindex했으나 색인률 회복을 위해 2026-05 폐지.
 * thin content 위험은 인근 단지 cross-property 섹션이 unique value를 제공해 완화.
 */

import { INVALID_BUILDING_NAME } from './realEstateBuildingName'

export interface RealEstateNoindexInput {
  buildingName: string
  loaded: boolean
  hasBuildingInfo: boolean
}

export function shouldNoindexRealEstateDetail(input: RealEstateNoindexInput): boolean {
  if (INVALID_BUILDING_NAME.test(input.buildingName)) return true
  if (!input.loaded) return false
  if (!input.hasBuildingInfo) return true
  return false
}
