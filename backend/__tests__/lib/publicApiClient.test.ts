// @TASK T2.3.3 - 공공데이터 API 클라이언트 테스트
// @SPEC docs/planning/02-trd.md#데이터-동기화

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

import { publicApiClient, type PublicApiConfig } from '../../src/lib/publicApiClient.js';

describe('PublicApiClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OPENAPI_SERVICE_KEY = 'test-service-key';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('fetchPage', () => {
    it('should fetch a single page of data', async () => {
      const mockResponse = {
        response: {
          header: {
            resultCode: '00',
            resultMsg: 'NORMAL SERVICE.',
          },
          body: {
            items: [
              { addrCtpvNm: '서울특별시', addrSggNm: '강남구' },
              { addrCtpvNm: '서울특별시', addrSggNm: '서초구' },
            ],
            totalCount: 100,
            pageNo: 1,
            numOfRows: 2,
          },
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const config: PublicApiConfig = {
        endpoint: 'https://apis.data.go.kr/1741000/kiosk_info/installation_info',
        pageSize: 100,
      };

      const result = await publicApiClient.fetchPage(config, 1);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('apis.data.go.kr'),
        expect.anything()
      );
      expect(result.items).toHaveLength(2);
      expect(result.totalCount).toBe(100);
    });

    it('should include service key in request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            response: {
              header: { resultCode: '00' },
              body: { items: [], totalCount: 0 },
            },
          }),
      });

      await publicApiClient.fetchPage(
        { endpoint: 'https://apis.data.go.kr/test', pageSize: 100 },
        1
      );

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('serviceKey='),
        expect.anything()
      );
    });

    it('should handle API error response', async () => {
      const mockResponse = {
        response: {
          header: {
            resultCode: '99',
            resultMsg: 'SERVICE ERROR',
          },
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      await expect(
        publicApiClient.fetchPage(
          { endpoint: 'https://apis.data.go.kr/test', pageSize: 100 },
          1
        )
      ).rejects.toThrow('SERVICE ERROR');
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(
        publicApiClient.fetchPage(
          { endpoint: 'https://apis.data.go.kr/test', pageSize: 100 },
          1
        )
      ).rejects.toThrow('Network error');
    });

    it('should handle HTTP errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(
        publicApiClient.fetchPage(
          { endpoint: 'https://apis.data.go.kr/test', pageSize: 100 },
          1
        )
      ).rejects.toThrow();
    });
  });

  describe('fetchAll', () => {
    it('should fetch all pages of data', async () => {
      // First page response
      const page1Response = {
        response: {
          header: { resultCode: '00' },
          body: {
            items: [{ id: 1 }, { id: 2 }],
            totalCount: 3,
            pageNo: 1,
            numOfRows: 2,
          },
        },
      };

      // Second page response
      const page2Response = {
        response: {
          header: { resultCode: '00' },
          body: {
            items: [{ id: 3 }],
            totalCount: 3,
            pageNo: 2,
            numOfRows: 2,
          },
        },
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(page1Response),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(page2Response),
        });

      const config: PublicApiConfig = {
        endpoint: 'https://apis.data.go.kr/test',
        pageSize: 2,
      };

      const results = await publicApiClient.fetchAll(config);

      expect(results).toHaveLength(3);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should handle empty response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            response: {
              header: { resultCode: '00' },
              body: { items: [], totalCount: 0 },
            },
          }),
      });

      const results = await publicApiClient.fetchAll({
        endpoint: 'https://apis.data.go.kr/test',
        pageSize: 100,
      });

      expect(results).toEqual([]);
    });

    it('should call onProgress callback', async () => {
      const mockResponse = {
        response: {
          header: { resultCode: '00' },
          body: {
            items: [{ id: 1 }],
            totalCount: 1,
          },
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const onProgress = vi.fn();

      await publicApiClient.fetchAll(
        { endpoint: 'https://apis.data.go.kr/test', pageSize: 100 },
        { onProgress }
      );

      expect(onProgress).toHaveBeenCalled();
    });

    it('should respect maxPages option', async () => {
      const mockResponse = {
        response: {
          header: { resultCode: '00' },
          body: {
            items: Array.from({ length: 100 }, (_, i) => ({ id: i })),
            totalCount: 1000,
          },
        },
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const results = await publicApiClient.fetchAll(
        { endpoint: 'https://apis.data.go.kr/test', pageSize: 100 },
        { maxPages: 2 }
      );

      expect(results).toHaveLength(200);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('response format handling', () => {
    it('should handle items as array', async () => {
      const mockResponse = {
        response: {
          header: { resultCode: '00' },
          body: {
            items: [{ id: 1 }, { id: 2 }],
            totalCount: 2,
          },
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await publicApiClient.fetchPage(
        { endpoint: 'https://apis.data.go.kr/test', pageSize: 100 },
        1
      );

      expect(result.items).toHaveLength(2);
    });

    it('should handle items as object with item array', async () => {
      const mockResponse = {
        response: {
          header: { resultCode: '00' },
          body: {
            items: {
              item: [{ id: 1 }, { id: 2 }],
            },
            totalCount: 2,
          },
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await publicApiClient.fetchPage(
        { endpoint: 'https://apis.data.go.kr/test', pageSize: 100 },
        1
      );

      expect(result.items).toHaveLength(2);
    });

    it('should handle single item as object', async () => {
      const mockResponse = {
        response: {
          header: { resultCode: '00' },
          body: {
            items: {
              item: { id: 1 },
            },
            totalCount: 1,
          },
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await publicApiClient.fetchPage(
        { endpoint: 'https://apis.data.go.kr/test', pageSize: 100 },
        1
      );

      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toEqual({ id: 1 });
    });

    it('should handle null items', async () => {
      const mockResponse = {
        response: {
          header: { resultCode: '00' },
          body: {
            items: null,
            totalCount: 0,
          },
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await publicApiClient.fetchPage(
        { endpoint: 'https://apis.data.go.kr/test', pageSize: 100 },
        1
      );

      expect(result.items).toEqual([]);
    });
  });
});
