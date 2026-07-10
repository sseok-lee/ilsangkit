// 지역×카테고리 시설 목록의 표시 상태 선택 로직 (SSR ↔ 클라이언트).
//
// SSR 은 서버에서 목록을 채워 HTML 에 렌더한다. 클라이언트에서 페이지네이션/필터로
// 재조회하면 그때부터 composable 데이터를 쓴다. 그 전환 규칙을 순수 함수로 분리해
// 페이지 컴포넌트와 테스트가 동일 로직을 공유하도록 한다.

export interface RegionListSnapshot<T> {
  items: T[]
  total: number
  totalPages: number
}

export interface RegionDisplayInput<T> {
  /** 클라이언트에서 한 번이라도 재조회했는지 (페이지네이션/필터/degraded 보충) */
  ssrConsumed: boolean
  /** SSR(useAsyncData) 결과. 실패(degraded)/미해당(trash) 시 null */
  ssr: RegionListSnapshot<T> | null
  /** composable(클라이언트) 현재 상태 */
  client: RegionListSnapshot<T> & { loading: boolean }
}

export interface RegionDisplayState<T> {
  facilities: T[]
  total: number
  totalPages: number
  loading: boolean
}

/**
 * 표시할 목록 상태를 결정한다.
 * - 클라이언트가 데이터를 갖고 있거나(ssrConsumed || client 채워짐) 하면 client 우선.
 * - 그렇지 않으면 SSR 데이터 사용(없으면 빈 상태).
 * - loading: SSR 데이터가 있고 아직 클라이언트 재조회 전이면 false(스피너 없이 즉시 렌더).
 */
export function resolveRegionDisplay<T>(input: RegionDisplayInput<T>): RegionDisplayState<T> {
  const { ssrConsumed, ssr, client } = input
  const useClientItems = ssrConsumed || client.items.length > 0
  return {
    facilities: useClientItems ? client.items : (ssr?.items ?? []),
    total: ssrConsumed || client.total > 0 ? client.total : (ssr?.total ?? 0),
    totalPages: ssrConsumed || client.totalPages > 0 ? client.totalPages : (ssr?.totalPages ?? 0),
    loading: !ssrConsumed && ssr ? false : client.loading,
  }
}
