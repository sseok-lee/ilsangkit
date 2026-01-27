// @TASK T2.3.1 - 공공데이터 API 클라이언트
// @SPEC docs/planning/02-trd.md#데이터-동기화

const BASE_URL = 'https://api.data.go.kr';

/**
 * API 응답 인터페이스
 */
export interface PublicApiResponse<T = unknown> {
  response: {
    header: {
      resultCode: string;
      resultMsg: string;
    };
    body: {
      items: T[];
      numOfRows: number;
      pageNo: number;
      totalCount: number;
    };
  };
}

/**
 * 재시도 옵션
 */
interface RetryOptions {
  maxRetries?: number;
  retryDelay?: number;
}

/**
 * 지연 함수
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * API URL 빌드
 * @param endpoint - API 엔드포인트
 * @param params - 쿼리 파라미터
 * @returns 완성된 URL
 */
export function buildApiUrl(endpoint: string, params: Record<string, string | number> = {}): string {
  const serviceKey = process.env.OPENAPI_SERVICE_KEY || '';
  const url = new URL(endpoint, BASE_URL);

  // 기본 파라미터
  url.searchParams.append('serviceKey', serviceKey);
  url.searchParams.append('type', 'json');

  // 추가 파라미터
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.append(key, String(value));
  }

  return url.toString();
}

/**
 * 공공데이터 API 호출
 * @param endpoint - API 엔드포인트
 * @param params - 쿼리 파라미터
 * @param options - 재시도 옵션
 * @returns API 응답
 */
export async function fetchPublicApi<T = unknown>(
  endpoint: string,
  params: Record<string, string | number> = {},
  options: RetryOptions = {}
): Promise<PublicApiResponse<T>> {
  const { maxRetries = 3, retryDelay = 1000 } = options;
  const url = buildApiUrl(endpoint, params);

  let lastError: Error = new Error('Unknown error');

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as PublicApiResponse<T>;

      // API 응답 코드 확인
      if (data.response.header.resultCode !== '00') {
        throw new Error(data.response.header.resultMsg);
      }

      return data;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // 마지막 시도가 아니면 재시도
      if (attempt < maxRetries) {
        await delay(retryDelay * attempt); // 지수 백오프
        continue;
      }
    }
  }

  throw lastError;
}
