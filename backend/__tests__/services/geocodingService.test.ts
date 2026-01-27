// @TASK T2.3.3 - Kakao 지오코딩 서비스 테스트
// @SPEC docs/planning/02-trd.md#데이터-동기화

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

import {
  geocode,
  batchGeocode,
  sleep,
  chunks,
} from '../../src/services/geocodingService.js';

describe('GeocodingService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.KAKAO_REST_API_KEY = 'test-api-key';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('geocode', () => {
    it('should return coordinates for valid address', async () => {
      const mockResponse = {
        documents: [
          {
            x: '127.0396',
            y: '37.5012',
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await geocode('서울특별시 강남구 테헤란로 123');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('dapi.kakao.com/v2/local/search/address'),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'KakaoAK test-api-key',
          }),
        })
      );
      expect(result).toEqual({ lat: 37.5012, lng: 127.0396 });
    });

    it('should return null when no results found', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ documents: [] }),
      });

      const result = await geocode('존재하지않는주소');

      expect(result).toBeNull();
    });

    it('should return null on API error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      });

      const result = await geocode('서울특별시 강남구');

      expect(result).toBeNull();
    });

    it('should return null on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await geocode('서울특별시 강남구');

      expect(result).toBeNull();
    });

    it('should URL encode the address', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ documents: [] }),
      });

      await geocode('서울특별시 강남구 테헤란로 123');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(encodeURIComponent('서울특별시 강남구 테헤란로 123')),
        expect.anything()
      );
    });
  });

  describe('batchGeocode', () => {
    it('should geocode multiple addresses', async () => {
      const mockResponse1 = {
        documents: [{ x: '127.0396', y: '37.5012' }],
      };
      const mockResponse2 = {
        documents: [{ x: '127.0292', y: '37.4923' }],
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockResponse1),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockResponse2),
        });

      const addresses = [
        '서울특별시 강남구 테헤란로 123',
        '서울특별시 서초구 서초대로 456',
      ];

      const results = await batchGeocode(addresses);

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({ lat: 37.5012, lng: 127.0396 });
      expect(results[1]).toEqual({ lat: 37.4923, lng: 127.0292 });
    });

    it('should handle mixed success and failure', async () => {
      const mockResponse = {
        documents: [{ x: '127.0396', y: '37.5012' }],
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockResponse),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ documents: [] }),
        });

      const addresses = ['서울특별시 강남구', '존재하지않는주소'];

      const results = await batchGeocode(addresses);

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({ lat: 37.5012, lng: 127.0396 });
      expect(results[1]).toBeNull();
    });

    it('should process in batches to respect rate limit', async () => {
      const addresses = Array.from({ length: 25 }, (_, i) => `주소 ${i}`);

      // Mock all responses
      for (let i = 0; i < 25; i++) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ documents: [{ x: '127.0', y: '37.5' }] }),
        });
      }

      await batchGeocode(addresses, { batchSize: 10, delayMs: 10 });

      expect(mockFetch).toHaveBeenCalledTimes(25);
    });

    it('should return empty array for empty input', async () => {
      const results = await batchGeocode([]);
      expect(results).toEqual([]);
    });
  });

  describe('utility functions', () => {
    describe('sleep', () => {
      it('should delay execution', async () => {
        const start = Date.now();
        await sleep(50);
        const elapsed = Date.now() - start;
        expect(elapsed).toBeGreaterThanOrEqual(45); // Allow some tolerance
      });
    });

    describe('chunks', () => {
      it('should split array into chunks', () => {
        const arr = [1, 2, 3, 4, 5];
        const result = chunks(arr, 2);
        expect(result).toEqual([[1, 2], [3, 4], [5]]);
      });

      it('should handle empty array', () => {
        const result = chunks([], 2);
        expect(result).toEqual([]);
      });

      it('should handle chunk size larger than array', () => {
        const arr = [1, 2, 3];
        const result = chunks(arr, 10);
        expect(result).toEqual([[1, 2, 3]]);
      });
    });
  });
});
