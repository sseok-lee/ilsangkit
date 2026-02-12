// @TASK P12-T3 - 동기화 관련 상수
// API 호출, 배치 처리, 재시도 관련 상수

export const SYNC = {
  BATCH_SIZE: 100,
  MAX_RETRIES: 3,
  RETRY_BASE_DELAY_MS: 1000,
  PAGE_SIZE: 100,
} as const;

export const API_TIMEOUT = {
  DEFAULT_DELAY_MS: 100,
} as const;
