// @TASK P12-T3 - 동기화 관련 상수
// API 호출, 배치 처리, 재시도 관련 상수

export const SYNC = {
  BATCH_SIZE: 100,
  MAX_RETRIES: 3,
  RETRY_BASE_DELAY_MS: 1000,
  PAGE_SIZE: 1000,
} as const;

export const API_TIMEOUT = {
  DEFAULT_DELAY_MS: 100,
} as const;

export const NEIS = {
  BASE_URL: 'https://open.neis.go.kr/hub',
  PAGE_SIZE: 1000,
  ENDPOINTS: {
    SCHOOL_INFO: '/schoolInfo',
    ENROLLMENT: '/schoolInfo',  // 학생수는 별도 API: /classInfo
    CLASS_INFO: '/classInfo',
    DEPARTMENT: '/schulAflcoinfo',
  },
} as const;
