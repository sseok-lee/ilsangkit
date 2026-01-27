// @TASK T2.2 - 쓰레기 배출 데이터 동기화 테스트
// @SPEC docs/planning/02-trd.md#데이터-동기화
// @TEST __tests__/services/trashSync.test.ts

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PublicApiClient } from '../../src/services/publicApiClient.js';
import {
  transformTrashData,
  syncTrashData,
  TrashApiResponse,
} from '../../src/scripts/syncTrash.js';

// Mock Prisma
vi.mock('../../src/lib/prisma.js', () => ({
  default: {
    facility: {
      upsert: vi.fn().mockResolvedValue({}),
      count: vi.fn().mockResolvedValue(0),
    },
    syncHistory: {
      create: vi.fn().mockResolvedValue({ id: 1 }),
      update: vi.fn().mockResolvedValue({}),
    },
  },
}));

// Mock fetch for API calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('PublicApiClient', () => {
  const baseUrl = 'https://apis.data.go.kr/1741000/household_waste_info';
  const serviceKey = 'test-api-key';

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create instance with base URL and service key', () => {
      const client = new PublicApiClient(baseUrl, serviceKey);

      expect(client).toBeInstanceOf(PublicApiClient);
    });
  });

  describe('fetchData', () => {
    it('should fetch data with correct URL parameters', async () => {
      const client = new PublicApiClient(baseUrl, serviceKey);
      const mockResponse = {
        response: {
          header: { resultCode: '00', resultMsg: 'NORMAL SERVICE.' },
          body: {
            items: [{ id: '1', name: 'test' }],
            numOfRows: 100,
            pageNo: 1,
            totalCount: 150,
          },
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await client.fetchData({ pageNo: 1, numOfRows: 100 });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(baseUrl),
        expect.objectContaining({
          method: 'GET',
          headers: expect.any(Object),
        })
      );
      expect(result).toEqual(mockResponse);
    });

    it('should include service key in URL parameters', async () => {
      const client = new PublicApiClient(baseUrl, serviceKey);
      const mockResponse = {
        response: {
          header: { resultCode: '00', resultMsg: 'NORMAL SERVICE.' },
          body: { items: [], numOfRows: 100, pageNo: 1, totalCount: 0 },
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      await client.fetchData({ pageNo: 1, numOfRows: 100 });

      const calledUrl = mockFetch.mock.calls[0][0];
      expect(calledUrl).toContain(`serviceKey=${encodeURIComponent(serviceKey)}`);
    });

    it('should handle API error responses', async () => {
      const client = new PublicApiClient(baseUrl, serviceKey, { maxRetries: 1, retryDelay: 10 });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(client.fetchData({ pageNo: 1, numOfRows: 100 })).rejects.toThrow(
        'API request failed'
      );
    });

    it('should retry on failure up to max retries', async () => {
      const client = new PublicApiClient(baseUrl, serviceKey, { maxRetries: 3, retryDelay: 10 });

      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              response: {
                header: { resultCode: '00' },
                body: { items: [], numOfRows: 100, pageNo: 1, totalCount: 0 },
              },
            }),
        });

      const result = await client.fetchData({ pageNo: 1, numOfRows: 100 });

      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(result).toBeDefined();
    });

    it('should throw error after max retries exceeded', async () => {
      const client = new PublicApiClient(baseUrl, serviceKey, { maxRetries: 2, retryDelay: 10 });

      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(client.fetchData({ pageNo: 1, numOfRows: 100 })).rejects.toThrow(
        'Network error'
      );
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('fetchAllPages', () => {
    it('should fetch all pages when total count exceeds page size', async () => {
      const client = new PublicApiClient(baseUrl, serviceKey, { maxRetries: 1, retryDelay: 10 });

      // First page response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            response: {
              header: { resultCode: '00' },
              body: {
                items: [{ id: '1' }, { id: '2' }],
                numOfRows: 2,
                pageNo: 1,
                totalCount: 4,
              },
            },
          }),
      });

      // Second page response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            response: {
              header: { resultCode: '00' },
              body: {
                items: [{ id: '3' }, { id: '4' }],
                numOfRows: 2,
                pageNo: 2,
                totalCount: 4,
              },
            },
          }),
      });

      const allItems = await client.fetchAllPages(2);

      expect(allItems).toHaveLength(4);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });
});

describe('transformTrashData', () => {
  it('should transform API response to Facility model format', () => {
    const apiResponse: TrashApiResponse = {
      ctpvNm: '서울특별시',
      sggNm: '강남구',
      adongNm: '삼성동',
      ldongCd: '11680',
      dsbdPlcNm: '삼성1동 생활쓰레기 배출장소',
      dsbdWeekday: '월,수,금',
      dsbdBgngTm: '18:00',
      dsbdEndTm: '21:00',
      dsbdSrtnSn: '1',
      lat: '37.5145',
      lot: '127.0592',
    };

    const result = transformTrashData(apiResponse);

    expect(result).toEqual({
      id: expect.stringContaining('trash-'),
      category: 'trash',
      name: '삼성1동 생활쓰레기 배출장소',
      address: null,
      roadAddress: null,
      lat: 37.5145,
      lng: 127.0592,
      city: '서울특별시',
      district: '강남구',
      bjdCode: '11680',
      details: {
        neighborhood: '삼성동',
        collectionDays: '월,수,금',
        startTime: '18:00',
        endTime: '21:00',
        serialNumber: '1',
      },
      sourceId: expect.stringContaining('11680'),
      sourceUrl: 'https://www.data.go.kr/data/15155080/openapi.do',
    });
  });

  it('should handle missing optional fields', () => {
    const apiResponse: TrashApiResponse = {
      ctpvNm: '서울특별시',
      sggNm: '강남구',
      adongNm: '',
      ldongCd: '11680',
      dsbdPlcNm: '배출장소',
      dsbdWeekday: '',
      dsbdBgngTm: '',
      dsbdEndTm: '',
      dsbdSrtnSn: '1',
      lat: '37.5145',
      lot: '127.0592',
    };

    const result = transformTrashData(apiResponse);

    expect(result.details).toEqual({
      neighborhood: '',
      collectionDays: '',
      startTime: '',
      endTime: '',
      serialNumber: '1',
    });
  });

  it('should generate unique sourceId based on ldongCd and dsbdSrtnSn', () => {
    const apiResponse1: TrashApiResponse = {
      ctpvNm: '서울특별시',
      sggNm: '강남구',
      adongNm: '삼성동',
      ldongCd: '11680',
      dsbdPlcNm: '배출장소1',
      dsbdWeekday: '월,수,금',
      dsbdBgngTm: '18:00',
      dsbdEndTm: '21:00',
      dsbdSrtnSn: '1',
      lat: '37.5145',
      lot: '127.0592',
    };

    const apiResponse2: TrashApiResponse = {
      ...apiResponse1,
      dsbdSrtnSn: '2',
    };

    const result1 = transformTrashData(apiResponse1);
    const result2 = transformTrashData(apiResponse2);

    expect(result1.sourceId).not.toEqual(result2.sourceId);
    expect(result1.sourceId).toContain('11680');
    expect(result2.sourceId).toContain('11680');
  });

  it('should skip invalid data with missing coordinates', () => {
    const apiResponse: TrashApiResponse = {
      ctpvNm: '서울특별시',
      sggNm: '강남구',
      adongNm: '삼성동',
      ldongCd: '11680',
      dsbdPlcNm: '배출장소',
      dsbdWeekday: '월,수,금',
      dsbdBgngTm: '18:00',
      dsbdEndTm: '21:00',
      dsbdSrtnSn: '1',
      lat: '',
      lot: '',
    };

    const result = transformTrashData(apiResponse);

    expect(result).toBeNull();
  });

  it('should skip invalid data with zero coordinates', () => {
    const apiResponse: TrashApiResponse = {
      ctpvNm: '서울특별시',
      sggNm: '강남구',
      adongNm: '삼성동',
      ldongCd: '11680',
      dsbdPlcNm: '배출장소',
      dsbdWeekday: '월,수,금',
      dsbdBgngTm: '18:00',
      dsbdEndTm: '21:00',
      dsbdSrtnSn: '1',
      lat: '0',
      lot: '0',
    };

    const result = transformTrashData(apiResponse);

    expect(result).toBeNull();
  });
});

describe('syncTrashData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  it('should create SyncHistory record at start', async () => {
    const prisma = (await import('../../src/lib/prisma.js')).default;

    // Mock successful API response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          response: {
            header: { resultCode: '00' },
            body: {
              items: [],
              numOfRows: 100,
              pageNo: 1,
              totalCount: 0,
            },
          },
        }),
    });

    await syncTrashData({ serviceKey: 'test-key', dryRun: true });

    expect(prisma.syncHistory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        category: 'trash',
        status: 'running',
      }),
    });
  });

  it('should update SyncHistory with success status on completion', async () => {
    const prisma = (await import('../../src/lib/prisma.js')).default;

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          response: {
            header: { resultCode: '00' },
            body: {
              items: [
                {
                  ctpvNm: '서울특별시',
                  sggNm: '강남구',
                  adongNm: '삼성동',
                  ldongCd: '11680',
                  dsbdPlcNm: '배출장소',
                  dsbdWeekday: '월,수,금',
                  dsbdBgngTm: '18:00',
                  dsbdEndTm: '21:00',
                  dsbdSrtnSn: '1',
                  lat: '37.5145',
                  lot: '127.0592',
                },
              ],
              numOfRows: 100,
              pageNo: 1,
              totalCount: 1,
            },
          },
        }),
    });

    vi.mocked(prisma.syncHistory.create).mockResolvedValueOnce({ id: 1 } as never);

    await syncTrashData({ serviceKey: 'test-key', dryRun: true });

    expect(prisma.syncHistory.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: expect.objectContaining({
        status: 'success',
        completedAt: expect.any(Date),
      }),
    });
  });

  it('should update SyncHistory with failed status on error', async () => {
    const prisma = (await import('../../src/lib/prisma.js')).default;

    mockFetch.mockRejectedValue(new Error('API Error'));

    vi.mocked(prisma.syncHistory.create).mockResolvedValueOnce({ id: 1 } as never);

    await expect(syncTrashData({ serviceKey: 'test-key', dryRun: true })).rejects.toThrow();

    expect(prisma.syncHistory.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: expect.objectContaining({
        status: 'failed',
        errorMessage: expect.stringContaining('API Error'),
      }),
    });
  });

  it('should upsert facilities in dry run mode without actual DB writes', async () => {
    const prisma = (await import('../../src/lib/prisma.js')).default;

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          response: {
            header: { resultCode: '00' },
            body: {
              items: [
                {
                  ctpvNm: '서울특별시',
                  sggNm: '강남구',
                  adongNm: '삼성동',
                  ldongCd: '11680',
                  dsbdPlcNm: '배출장소',
                  dsbdWeekday: '월,수,금',
                  dsbdBgngTm: '18:00',
                  dsbdEndTm: '21:00',
                  dsbdSrtnSn: '1',
                  lat: '37.5145',
                  lot: '127.0592',
                },
              ],
              numOfRows: 100,
              pageNo: 1,
              totalCount: 1,
            },
          },
        }),
    });

    vi.mocked(prisma.syncHistory.create).mockResolvedValueOnce({ id: 1 } as never);

    const result = await syncTrashData({ serviceKey: 'test-key', dryRun: true });

    // In dry run mode, facility.upsert should not be called
    expect(prisma.facility.upsert).not.toHaveBeenCalled();
    expect(result.totalRecords).toBe(1);
  });

  it('should upsert facilities when not in dry run mode', async () => {
    const prisma = (await import('../../src/lib/prisma.js')).default;

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          response: {
            header: { resultCode: '00' },
            body: {
              items: [
                {
                  ctpvNm: '서울특별시',
                  sggNm: '강남구',
                  adongNm: '삼성동',
                  ldongCd: '11680',
                  dsbdPlcNm: '배출장소',
                  dsbdWeekday: '월,수,금',
                  dsbdBgngTm: '18:00',
                  dsbdEndTm: '21:00',
                  dsbdSrtnSn: '1',
                  lat: '37.5145',
                  lot: '127.0592',
                },
              ],
              numOfRows: 100,
              pageNo: 1,
              totalCount: 1,
            },
          },
        }),
    });

    vi.mocked(prisma.syncHistory.create).mockResolvedValueOnce({ id: 1 } as never);
    vi.mocked(prisma.facility.count).mockResolvedValueOnce(0 as never);

    await syncTrashData({ serviceKey: 'test-key', dryRun: false });

    expect(prisma.facility.upsert).toHaveBeenCalled();
  });

  it('should count new and updated records correctly', async () => {
    const prisma = (await import('../../src/lib/prisma.js')).default;

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          response: {
            header: { resultCode: '00' },
            body: {
              items: [
                {
                  ctpvNm: '서울특별시',
                  sggNm: '강남구',
                  adongNm: '삼성동',
                  ldongCd: '11680',
                  dsbdPlcNm: '배출장소1',
                  dsbdWeekday: '월,수,금',
                  dsbdBgngTm: '18:00',
                  dsbdEndTm: '21:00',
                  dsbdSrtnSn: '1',
                  lat: '37.5145',
                  lot: '127.0592',
                },
                {
                  ctpvNm: '서울특별시',
                  sggNm: '강남구',
                  adongNm: '삼성동',
                  ldongCd: '11680',
                  dsbdPlcNm: '배출장소2',
                  dsbdWeekday: '화,목,토',
                  dsbdBgngTm: '18:00',
                  dsbdEndTm: '21:00',
                  dsbdSrtnSn: '2',
                  lat: '37.5146',
                  lot: '127.0593',
                },
              ],
              numOfRows: 100,
              pageNo: 1,
              totalCount: 2,
            },
          },
        }),
    });

    vi.mocked(prisma.syncHistory.create).mockResolvedValueOnce({ id: 1 } as never);
    // First record exists, second is new
    vi.mocked(prisma.facility.count)
      .mockResolvedValueOnce(1 as never)
      .mockResolvedValueOnce(0 as never);

    const result = await syncTrashData({ serviceKey: 'test-key', dryRun: false });

    expect(result.totalRecords).toBe(2);
    expect(result.newRecords).toBe(1);
    expect(result.updatedRecords).toBe(1);
  });
});
