/** 시설 목록 페이지 noindex 판정: page2+ 또는 키워드 검색 상태면 noindex. `?city=`만은 색인 유지. */
export function shouldNoindexFacilityList(input: { page: number; keyword?: string }): boolean {
  return input.page >= 2 || !!input.keyword?.trim()
}
