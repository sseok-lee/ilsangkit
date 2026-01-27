// @TASK T2.3.3 - 공공데이터 API 클라이언트
// @SPEC docs/planning/02-trd.md#데이터-동기화

/**
 * 공공데이터 API 설정
 */
export interface PublicApiConfig {
  /** API 엔드포인트 URL */
  endpoint: string;
  /** 페이지당 데이터 수 */
  pageSize: number;
  /** 응답 형식 (기본값: json) */
  responseType?: 'json' | 'xml';
}

/**
 * 공공데이터 API 응답 형식
 */
interface PublicApiResponse<T> {
  response: {
    header: {
      resultCode: string;
      resultMsg: string;
    };
    body: {
      items: T[] | { item: T | T[] } | null;
      totalCount: number;
      pageNo?: number;
      numOfRows?: number;
    };
  };
}

/**
 * 페이지 조회 결과
 */
export interface PageResult<T> {
  items: T[];
  totalCount: number;
  pageNo: number;
  numOfRows: number;
}

/**
 * fetchAll 옵션
 */
export interface FetchAllOptions {
  /** 진행 상황 콜백 */
  onProgress?: (current: number, total: number) => void;
  /** 최대 페이지 수 (테스트용) */
  maxPages?: number;
  /** 페이지 간 딜레이 (ms) */
  delayMs?: number;
}

/**
 * items 필드를 배열로 정규화
 */
function normalizeItems<T>(items: T[] | { item: T | T[] } | null | undefined): T[] {
  if (!items) return [];
  if (Array.isArray(items)) return items;
  if ('item' in items) {
    const item = items.item;
    return Array.isArray(item) ? item : [item];
  }
  return [];
}

/**
 * 공공데이터 API 클라이언트
 */
export const publicApiClient = {
  /**
   * 단일 페이지 데이터 조회
   */
  async fetchPage<T>(config: PublicApiConfig, pageNo: number): Promise<PageResult<T>> {
    const serviceKey = process.env.OPENAPI_SERVICE_KEY;
    if (!serviceKey) {
      throw new Error('OPENAPI_SERVICE_KEY environment variable is not set');
    }

    const url = new URL(config.endpoint);
    url.searchParams.set('serviceKey', serviceKey);
    url.searchParams.set('pageNo', String(pageNo));
    url.searchParams.set('numOfRows', String(config.pageSize));
    url.searchParams.set('type', config.responseType || 'json');

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as PublicApiResponse<T>;

    // API 에러 체크
    if (data.response.header.resultCode !== '00') {
      throw new Error(data.response.header.resultMsg);
    }

    const items = normalizeItems(data.response.body.items);

    return {
      items,
      totalCount: data.response.body.totalCount || 0,
      pageNo: data.response.body.pageNo || pageNo,
      numOfRows: data.response.body.numOfRows || config.pageSize,
    };
  },

  /**
   * 모든 페이지 데이터 조회
   */
  async fetchAll<T>(config: PublicApiConfig, options: FetchAllOptions = {}): Promise<T[]> {
    const { onProgress, maxPages, delayMs = 100 } = options;
    const allItems: T[] = [];

    // 첫 페이지 조회하여 총 개수 확인
    const firstPage = await this.fetchPage<T>(config, 1);
    allItems.push(...firstPage.items);

    if (firstPage.totalCount === 0) {
      return allItems;
    }

    const totalPages = Math.ceil(firstPage.totalCount / config.pageSize);
    const pagesToFetch = maxPages ? Math.min(totalPages, maxPages) : totalPages;

    if (onProgress) {
      onProgress(1, pagesToFetch);
    }

    // 나머지 페이지 조회
    for (let pageNo = 2; pageNo <= pagesToFetch; pageNo++) {
      // Rate limit 대응 딜레이
      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }

      const page = await this.fetchPage<T>(config, pageNo);
      allItems.push(...page.items);

      if (onProgress) {
        onProgress(pageNo, pagesToFetch);
      }
    }

    return allItems;
  },
};
