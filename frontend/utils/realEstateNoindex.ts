/**
 * 부동산 상세 페이지 noindex 판단 유틸.
 *
 * 세 조건 중 하나라도 참이면 `<meta name="robots" content="noindex, follow">`를 출력해
 * 저품질/thin content URL이 검색엔진에 색인되지 않도록 한다.
 *
 * 1. `buildingName`이 지번 패턴 → 즉시 noindex (SSR 첫 바이트부터 차단)
 * 2. 데이터 로드 완료 && `buildingInfo` 없음 → 존재하지 않는 건물
 * 3. 데이터 로드 완료 && 총 거래 < 10 → thin content
 */

import { INVALID_BUILDING_NAME } from './realEstateBuildingName'

export interface RealEstateNoindexInput {
  buildingName: string
  loaded: boolean
  hasBuildingInfo: boolean
  totalCount: number | null | undefined
}

export function shouldNoindexRealEstateDetail(input: RealEstateNoindexInput): boolean {
  if (INVALID_BUILDING_NAME.test(input.buildingName)) return true
  if (!input.loaded) return false
  if (!input.hasBuildingInfo) return true
  if ((input.totalCount ?? 0) < 10) return true
  return false
}
