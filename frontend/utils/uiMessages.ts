/** 화면 공통 메시지 사전 — 한 줄 상태문은 마침표 없음(spec §3.3). */
export const UI_MESSAGES = {
  emptySearch: '검색 결과가 없습니다',
  loading: '불러오는 중…',
  fetchError: '데이터를 불러오는 중 오류가 발생했습니다',
  notFound: '요청한 정보를 찾을 수 없습니다',
} as const

/** 필터 목록 빈상태: 조건에 맞는 {대상}이 없습니다 */
export function emptyFiltered(target: string): string {
  return `조건에 맞는 ${target}이 없습니다`
}
