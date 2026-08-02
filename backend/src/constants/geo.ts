// @TASK P12-T3 - 지리적 좌표 상수
// 한국 영역 좌표 범위 및 검색 관련 상수

export const KOREA_BOUNDS = {
  LAT_MIN: 33,
  LAT_MAX: 39,
  LNG_MIN: 124,
  LNG_MAX: 132,
} as const;

export const SEARCH_DEFAULTS = {
  RADIUS_METERS: 1000,
  MIN_RADIUS_METERS: 100,
  MAX_RADIUS_METERS: 10000,
} as const;

// 주변 시설 "개수 요약"용 상수 (GET /api/facilities/nearby-counts).
// 목록을 만들지 않고 개수만 세는 경로라 검색과 상한이 다르다.
//
// MAX_RADIUS_METERS 를 검색(10km)보다 훨씬 낮게 잡는 이유:
// 개수 세기는 위경도 바운딩박스를 훑는 비용이 반경 제곱에 비례한다. 게다가
// @@index([lat, lng]) 는 복합 B-tree 라 선행 lat 범위스캔까지만 인덱스를 타고
// lng 는 필터로 떨어져, 밀집 지역에서는 같은 위도 밴드를 넓게 훑는다.
// 실측(강남 1km): hospital 바운딩박스 스캔만 0.2s. "주변 요약"에 그 비용은 과하다.
// 넓은 범위가 필요하면 목록 API(POST /search)를 쓴다.
export const NEARBY_SUMMARY = {
  DEFAULT_RADIUS_METERS: 300,
  MIN_RADIUS_METERS: 100,
  MAX_RADIUS_METERS: 2000,
  // 바운딩박스 스캔 상한. 초과하면 개수가 하한값이 되므로 exact=false 로 알린다.
  SCAN_CAP: 20000,
} as const;
