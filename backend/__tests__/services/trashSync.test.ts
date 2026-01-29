// @TASK T2.2 - 쓰레기 배출 일정 데이터 동기화 테스트
// @SPEC docs/planning/02-trd.md#데이터-동기화
// @TEST __tests__/services/trashSync.test.ts
// NOTE: 쓰레기 배출 데이터는 좌표가 없어 WasteSchedule 테이블에 저장됨 (지도 마커 X)

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
    wasteSchedule: {
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
  it('should transform API response to WasteSchedule model format', () => {
    const apiResponse: TrashApiResponse = {
      CTPV_NM: '경상남도',
      SGG_NM: '거창군',
      MNG_ZONE_TRGT_RGN_NM: '남상면+신원면',
      EMSN_PLC: '집앞',
      EMSN_ITM: '일반쓰레기',
      EMSN_DAY: '월,수,금',
      EMSN_TIME: '18:00~21:00',
      EMSN_MTH: '봉투배출',
      CLLCT_DAY: '화,목,토',
      CLLCT_TIME: '06:00~08:00',
      CLLCT_MTH: '수거차량',
      MNG_INST_NM: '거창군청',
      MNG_INST_TELNO: '055-940-3000',
      DATA_STDR_DE: '2024-01-01',
    };

    const result = transformTrashData(apiResponse);

    expect(result).toEqual({
      city: '경상남도',
      district: '거창군',
      targetRegion: '남상면+신원면',
      emissionPlace: '집앞',
      details: {
        emissionItem: '일반쓰레기',
        emissionDay: '월,수,금',
        emissionTime: '18:00~21:00',
        emissionMethod: '봉투배출',
        collectDay: '화,목,토',
        collectTime: '06:00~08:00',
        collectMethod: '수거차량',
        manageInstitute: '거창군청',
        managePhone: '055-940-3000',
        dataStandardDate: '2024-01-01',
      },
      sourceId: expect.any(String),
      sourceUrl: 'https://www.data.go.kr/data/15155080/openapi.do',
    });
  });

  it('should handle missing optional fields', () => {
    const apiResponse: TrashApiResponse = {
      CTPV_NM: '서울특별시',
      SGG_NM: '강남구',
    };

    const result = transformTrashData(apiResponse);

    expect(result).toEqual({
      city: '서울특별시',
      district: '강남구',
      targetRegion: null,
      emissionPlace: null,
      details: {
        emissionItem: undefined,
        emissionDay: undefined,
        emissionTime: undefined,
        emissionMethod: undefined,
        collectDay: undefined,
        collectTime: undefined,
        collectMethod: undefined,
        manageInstitute: undefined,
        managePhone: undefined,
        dataStandardDate: undefined,
      },
      sourceId: expect.any(String),
      sourceUrl: 'https://www.data.go.kr/data/15155080/openapi.do',
    });
  });

  it('should generate unique sourceId based on city, district, and other fields', () => {
    const apiResponse1: TrashApiResponse = {
      CTPV_NM: '서울특별시',
      SGG_NM: '강남구',
      MNG_ZONE_TRGT_RGN_NM: '삼성동',
      EMSN_PLC: '집앞',
      EMSN_DAY: '월,수,금',
    };

    const apiResponse2: TrashApiResponse = {
      CTPV_NM: '서울특별시',
      SGG_NM: '강남구',
      MNG_ZONE_TRGT_RGN_NM: '삼성동',
      EMSN_PLC: '집앞',
      EMSN_DAY: '화,목,토', // 다른 배출요일
    };

    const result1 = transformTrashData(apiResponse1);
    const result2 = transformTrashData(apiResponse2);

    expect(result1!.sourceId).not.toEqual(result2!.sourceId);
  });

  it('should return null for data missing required fields', () => {
    // 시도명 없음
    const apiResponse1: TrashApiResponse = {
      CTPV_NM: '',
      SGG_NM: '강남구',
    };

    // 시군구명 없음
    const apiResponse2: TrashApiResponse = {
      CTPV_NM: '서울특별시',
      SGG_NM: '',
    };

    expect(transformTrashData(apiResponse1)).toBeNull();
    expect(transformTrashData(apiResponse2)).toBeNull();
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
        category: 'waste_schedule',
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
                  CTPV_NM: '경상남도',
                  SGG_NM: '거창군',
                  MNG_ZONE_TRGT_RGN_NM: '남상면',
                  EMSN_PLC: '집앞',
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

  it('should not call wasteSchedule.upsert in dry run mode', async () => {
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
                  CTPV_NM: '서울특별시',
                  SGG_NM: '강남구',
                  MNG_ZONE_TRGT_RGN_NM: '삼성동',
                  EMSN_PLC: '집앞',
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

    // In dry run mode, wasteSchedule.upsert should not be called
    expect(prisma.wasteSchedule.upsert).not.toHaveBeenCalled();
    expect(result.totalRecords).toBe(1);
  });

  it('should call wasteSchedule.upsert when not in dry run mode', async () => {
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
                  CTPV_NM: '서울특별시',
                  SGG_NM: '강남구',
                  MNG_ZONE_TRGT_RGN_NM: '삼성동',
                  EMSN_PLC: '집앞',
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
    vi.mocked(prisma.wasteSchedule.count).mockResolvedValueOnce(0 as never);

    await syncTrashData({ serviceKey: 'test-key', dryRun: false });

    expect(prisma.wasteSchedule.upsert).toHaveBeenCalled();
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
                  CTPV_NM: '서울특별시',
                  SGG_NM: '강남구',
                  MNG_ZONE_TRGT_RGN_NM: '삼성동',
                  EMSN_PLC: '집앞',
                  EMSN_DAY: '월,수,금',
                },
                {
                  CTPV_NM: '서울특별시',
                  SGG_NM: '강남구',
                  MNG_ZONE_TRGT_RGN_NM: '역삼동',
                  EMSN_PLC: '집앞',
                  EMSN_DAY: '화,목,토',
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
    vi.mocked(prisma.wasteSchedule.count)
      .mockResolvedValueOnce(1 as never)
      .mockResolvedValueOnce(0 as never);

    const result = await syncTrashData({ serviceKey: 'test-key', dryRun: false });

    expect(result.totalRecords).toBe(2);
    expect(result.newRecords).toBe(1);
    expect(result.updatedRecords).toBe(1);
  });
});
