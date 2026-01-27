// @TASK T2.3.1 - 공공데이터 API 클라이언트 테스트
// @SPEC docs/planning/02-trd.md#데이터-동기화

import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('publicApiClient', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.resetModules();
    // 환경 변수 설정
    process.env.OPENAPI_SERVICE_KEY = 'test-service-key';
  });

  describe('fetchPublicApi', () => {
    it('API 엔드포인트에 올바른 파라미터로 요청해야 한다', async () => {
      const mockResponse = {
        response: {
          header: { resultCode: '00', resultMsg: 'SUCCESS' },
          body: { items: [], totalCount: 0 },
        },
      };

      const mockFetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });
      global.fetch = mockFetch;

      const { fetchPublicApi } = await import('../../src/lib/publicApiClient.js');

      await fetchPublicApi('/test/endpoint', { param1: 'value1' });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const calledUrl = mockFetch.mock.calls[0][0];

      expect(calledUrl).toContain('/test/endpoint');
      expect(calledUrl).toContain('serviceKey=test-service-key');
      expect(calledUrl).toContain('param1=value1');
      expect(calledUrl).toContain('type=json');

      global.fetch = originalFetch;
    });

    it('API 응답이 성공이 아니면 에러를 던져야 한다', async () => {
      const mockResponse = {
        response: {
          header: { resultCode: '99', resultMsg: 'SERVICE ERROR' },
          body: null,
        },
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });
      global.fetch = mockFetch;

      const { fetchPublicApi } = await import('../../src/lib/publicApiClient.js');

      await expect(
        fetchPublicApi('/test/endpoint', {}, { maxRetries: 1, retryDelay: 0 })
      ).rejects.toThrow('SERVICE ERROR');

      global.fetch = originalFetch;
    });

    it('네트워크 오류 시 에러를 던져야 한다', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('Network Error'));
      global.fetch = mockFetch;

      const { fetchPublicApi } = await import('../../src/lib/publicApiClient.js');

      await expect(
        fetchPublicApi('/test/endpoint', {}, { maxRetries: 1, retryDelay: 0 })
      ).rejects.toThrow('Network Error');

      global.fetch = originalFetch;
    });

    it('HTTP 오류 응답 시 에러를 던져야 한다', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });
      global.fetch = mockFetch;

      const { fetchPublicApi } = await import('../../src/lib/publicApiClient.js');

      await expect(
        fetchPublicApi('/test/endpoint', {}, { maxRetries: 1, retryDelay: 0 })
      ).rejects.toThrow('HTTP error: 500 Internal Server Error');

      global.fetch = originalFetch;
    });

    it('재시도 로직이 동작해야 한다 (3회 시도)', async () => {
      const mockFetch = vi
        .fn()
        .mockRejectedValueOnce(new Error('Temporary Error'))
        .mockRejectedValueOnce(new Error('Temporary Error'))
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              response: {
                header: { resultCode: '00', resultMsg: 'SUCCESS' },
                body: { items: [], totalCount: 0 },
              },
            }),
        });
      global.fetch = mockFetch;

      const { fetchPublicApi } = await import('../../src/lib/publicApiClient.js');

      const result = await fetchPublicApi('/test/endpoint', {}, { maxRetries: 3, retryDelay: 10 });

      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(result.response.header.resultCode).toBe('00');

      global.fetch = originalFetch;
    });

    it('최대 재시도 횟수 초과 시 에러를 던져야 한다', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('Persistent Error'));
      global.fetch = mockFetch;

      const { fetchPublicApi } = await import('../../src/lib/publicApiClient.js');

      await expect(
        fetchPublicApi('/test/endpoint', {}, { maxRetries: 2, retryDelay: 10 })
      ).rejects.toThrow('Persistent Error');

      expect(mockFetch).toHaveBeenCalledTimes(2);

      global.fetch = originalFetch;
    });
  });

  describe('buildApiUrl', () => {
    it('기본 URL과 파라미터를 조합해야 한다', async () => {
      const { buildApiUrl } = await import('../../src/lib/publicApiClient.js');

      const url = buildApiUrl('/api/test', { page: 1, limit: 10 });

      expect(url).toContain('api.data.go.kr');
      expect(url).toContain('/api/test');
      expect(url).toContain('page=1');
      expect(url).toContain('limit=10');
    });
  });
});
