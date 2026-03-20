// NEIS Open API 클라이언트 (open.neis.go.kr)
// 학교기본정보, 학생수(반정보), 학과정보 엔드포인트 지원

import { SYNC, NEIS } from '../constants/index.js';

interface NeisApiClientOptions {
  maxRetries?: number;
  retryDelay?: number;
  timeout?: number;
}

interface NeisRow {
  [key: string]: string | number | null | undefined;
}

interface NeisApiResponse<T = NeisRow> {
  [endpoint: string]: Array<{
    head?: Array<{ list_total_count?: number; RESULT?: { CODE: string; MESSAGE: string } }>;
    row?: T[];
  }>;
}

export class NeisApiClient {
  private apiKey: string;
  private maxRetries: number;
  private retryDelay: number;
  private timeout: number;

  constructor(apiKey: string, options: NeisApiClientOptions = {}) {
    this.apiKey = apiKey;
    this.maxRetries = options.maxRetries ?? SYNC.MAX_RETRIES;
    this.retryDelay = options.retryDelay ?? SYNC.RETRY_BASE_DELAY_MS;
    this.timeout = options.timeout ?? 30000;
  }

  /**
   * NEIS API 단일 페이지 조회
   */
  async fetchPage<T = NeisRow>(
    endpoint: string,
    params: Record<string, string | number> = {},
    pIndex = 1,
    pSize: number = NEIS.PAGE_SIZE
  ): Promise<{ rows: T[]; totalCount: number }> {
    const url = new URL(`${NEIS.BASE_URL}${endpoint}`);
    url.searchParams.set('KEY', this.apiKey);
    url.searchParams.set('Type', 'json');
    url.searchParams.set('pIndex', String(pIndex));
    url.searchParams.set('pSize', String(pSize));

    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, String(value));
    }

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        const response = await fetch(url.toString(), {
          method: 'GET',
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`NEIS API request failed: ${response.status} ${response.statusText}`);
        }

        const data = (await response.json()) as NeisApiResponse<T>;

        // NEIS 응답 구조: { "endpointName": [{ head: [...] }, { row: [...] }] }
        // 또는 에러 시: { RESULT: { CODE: "INFO-200", MESSAGE: "해당하는 데이터가 없습니다." } }
        const resultData = data as Record<string, unknown>;

        // 데이터 없음 응답 처리
        if (resultData.RESULT && typeof resultData.RESULT === 'object') {
          const result = resultData.RESULT as { CODE: string; MESSAGE: string };
          if (result.CODE === 'INFO-200') {
            return { rows: [], totalCount: 0 };
          }
          throw new Error(`NEIS API Error: ${result.CODE} - ${result.MESSAGE}`);
        }

        // 엔드포인트 이름에서 '/' 제거
        const endpointKey = endpoint.replace('/', '');
        const endpointData = data[endpointKey];

        if (!endpointData || !Array.isArray(endpointData)) {
          return { rows: [], totalCount: 0 };
        }

        let totalCount = 0;
        let rows: T[] = [];

        for (const section of endpointData) {
          if (section.head) {
            for (const headItem of section.head) {
              if (headItem.list_total_count != null) {
                totalCount = headItem.list_total_count;
              }
              if (headItem.RESULT && headItem.RESULT.CODE !== 'INFO-000') {
                if (headItem.RESULT.CODE === 'INFO-200') {
                  return { rows: [], totalCount: 0 };
                }
                throw new Error(`NEIS API Error: ${headItem.RESULT.CODE} - ${headItem.RESULT.MESSAGE}`);
              }
            }
          }
          if (section.row) {
            rows = section.row;
          }
        }

        return { rows, totalCount };
      } catch (error) {
        lastError = error as Error;
        if (attempt < this.maxRetries) {
          await this.delay(this.retryDelay * attempt);
        }
      }
    }

    throw lastError;
  }

  /**
   * 모든 페이지 데이터 조회
   */
  async fetchAllPages<T = NeisRow>(
    endpoint: string,
    params: Record<string, string | number> = {},
    pageSize = NEIS.PAGE_SIZE
  ): Promise<T[]> {
    const allRows: T[] = [];
    let currentPage = 1;

    const first = await this.fetchPage<T>(endpoint, params, currentPage, pageSize);
    allRows.push(...first.rows);

    if (first.totalCount === 0) return allRows;

    const totalPages = Math.ceil(first.totalCount / pageSize);
    console.info(`NEIS API: Total ${first.totalCount} records, ${totalPages} pages`);
    currentPage++;

    while (currentPage <= totalPages) {
      const result = await this.fetchPage<T>(endpoint, params, currentPage, pageSize);
      allRows.push(...result.rows);
      console.info(`NEIS API: Page ${currentPage}/${totalPages} fetched (${allRows.length}/${first.totalCount})`);
      currentPage++;
    }

    return allRows;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
