// @TASK T2.2 - 공공데이터 API 클라이언트
// @SPEC docs/planning/02-trd.md#데이터-동기화

/**
 * 공공데이터 Open API 클라이언트
 * - REST API 호출
 * - 인증키 처리
 * - 페이지네이션 처리
 * - 에러 핸들링 및 재시도 로직
 */

interface PublicApiClientOptions {
  /** 최대 재시도 횟수 (기본값: 3) */
  maxRetries?: number;
  /** 재시도 간격 ms (기본값: 1000) */
  retryDelay?: number;
  /** 요청 타임아웃 ms (기본값: 30000) */
  timeout?: number;
}

interface FetchParams {
  pageNo: number;
  numOfRows: number;
  [key: string]: string | number;
}

interface PublicApiResponse<T = unknown> {
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

export class PublicApiClient {
  private baseUrl: string;
  private serviceKey: string;
  private maxRetries: number;
  private retryDelay: number;
  private timeout: number;

  constructor(baseUrl: string, serviceKey: string, options: PublicApiClientOptions = {}) {
    this.baseUrl = baseUrl;
    this.serviceKey = serviceKey;
    this.maxRetries = options.maxRetries ?? 3;
    this.retryDelay = options.retryDelay ?? 1000;
    this.timeout = options.timeout ?? 30000;
  }

  /**
   * API 데이터 조회
   * @param params - 요청 파라미터 (pageNo, numOfRows 필수)
   * @returns API 응답 데이터
   */
  async fetchData<T = unknown>(params: FetchParams): Promise<PublicApiResponse<T>> {
    const url = this.buildUrl(params);
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        const response = await fetch(url, {
          method: 'GET',
          headers: {
            Accept: 'application/json',
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`API request failed: ${response.status} ${response.statusText}`);
        }

        const data = (await response.json()) as PublicApiResponse<T>;
        return data;
      } catch (error) {
        lastError = error as Error;

        if (attempt < this.maxRetries) {
          await this.delay(this.retryDelay);
        }
      }
    }

    throw lastError;
  }

  /**
   * 모든 페이지 데이터 조회
   * @param pageSize - 페이지당 항목 수 (기본값: 100)
   * @returns 모든 항목 배열
   */
  async fetchAllPages<T = unknown>(pageSize: number = 100): Promise<T[]> {
    const allItems: T[] = [];
    let currentPage = 1;
    let totalCount = 0;

    // 첫 페이지 조회로 totalCount 확인
    const firstResponse = await this.fetchData<T>({
      pageNo: currentPage,
      numOfRows: pageSize,
    });

    totalCount = firstResponse.response.body.totalCount;
    allItems.push(...firstResponse.response.body.items);
    currentPage++;

    // 나머지 페이지 조회
    const totalPages = Math.ceil(totalCount / pageSize);

    while (currentPage <= totalPages) {
      const response = await this.fetchData<T>({
        pageNo: currentPage,
        numOfRows: pageSize,
      });

      allItems.push(...response.response.body.items);
      currentPage++;
    }

    return allItems;
  }

  /**
   * URL 빌드
   */
  private buildUrl(params: FetchParams): string {
    const url = new URL(this.baseUrl);
    url.searchParams.append('serviceKey', this.serviceKey);
    url.searchParams.append('type', 'json');

    for (const [key, value] of Object.entries(params)) {
      url.searchParams.append(key, String(value));
    }

    return url.toString();
  }

  /**
   * 지연 함수
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export type { PublicApiClientOptions, FetchParams, PublicApiResponse };
