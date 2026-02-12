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
