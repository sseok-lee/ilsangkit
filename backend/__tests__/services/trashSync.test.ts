// @TASK T2.2 - 쓰레기 배출 일정 데이터 동기화 테스트
// @SPEC docs/planning/02-trd.md#데이터-동기화
// @TEST __tests__/services/trashSync.test.ts
// NOTE: 쓰레기 배출 데이터는 좌표가 없어 WasteSchedule 테이블에 저장됨 (지도 마커 X)

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PublicApiClient } from '../../src/services/publicApiClient.js';
import {
  fetchCompleteTrashPages,
  transformTrashData,
  syncTrashData,
  TrashApiResponse,
  reserveRawWasteSchedules,
  redactSyncResultForLog,
} from '../../src/scripts/syncTrash.js';

const publicationMock = vi.hoisted(() => ({
  assertWasteAreaDiscoveryWriteEnabled: vi.fn(),
  prepareWasteGeneration: vi.fn().mockResolvedValue({
    generationId: 'prepared-generation',
    reportHash: 'a'.repeat(64),
    canPublish: true,
    reviewReport: { reportHash: 'a'.repeat(64), sourceChanges: [] },
  }),
  publishWasteGeneration: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../src/services/wastePublicationService.js', () => publicationMock);

// Create persistent mock functions for transaction context
const mockTxCreate = vi.fn().mockResolvedValue({ id: 1 });
const mockTxFindUnique = vi.fn().mockResolvedValue(null);
const mockTxCreateMany = vi.fn().mockResolvedValue({ count: 1 });
const mockTxMarkerCreate = vi.fn().mockResolvedValue({});

// Mock Prisma
vi.mock('../../src/lib/prisma.js', () => {
  const prismaClient = {
    wasteSchedule: {
      upsert: vi.fn().mockResolvedValue({}),
      count: vi.fn().mockResolvedValue(0),
      findUnique: vi.fn().mockResolvedValue(null),
    },
    syncHistory: {
      create: vi.fn().mockResolvedValue({ id: 1 }),
      update: vi.fn().mockResolvedValue({}),
    },
    wastePublication: {
      findUnique: vi.fn().mockResolvedValue({ activeGenerationId: null }),
    },
    $transaction: vi.fn().mockImplementation(async (callback) => {
      // Mock transaction context with persistent mocks
      const tx = {
        wasteSchedule: {
          create: mockTxCreate,
          findUnique: mockTxFindUnique,
        },
        wasteStagedSchedule: {
          createMany: mockTxCreateMany,
          create: mockTxMarkerCreate,
        },
      };
      return callback(tx);
    }),
  };
  return { default: prismaClient, prisma: prismaClient };
});

// Mock fetch for API calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

const emptyRefs = { version: 'test', areas: [], relations: [], sourceAreaKinds: {} };

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
      MNG_ZONE_NM: '남상면',
      MNG_ZONE_TRGT_RGN_NM: '남상면+신원면',
      EMSN_PLC: '집앞',
      EMSN_PLC_TYPE: '문전수거',
      LF_WST_EMSN_DOW: '월,수,금',
      LF_WST_EMSN_BGNG_TM: '18:00',
      LF_WST_EMSN_END_TM: '21:00',
      LF_WST_EMSN_MTHD: '규격봉투 배출',
      FOD_WST_EMSN_DOW: '화,목,토',
      FOD_WST_EMSN_BGNG_TM: '18:00',
      FOD_WST_EMSN_END_TM: '21:00',
      FOD_WST_EMSN_MTHD: '전용봉투',
      RCYCL_EMSN_DOW: '수,토',
      RCYCL_EMSN_BGNG_TM: '06:00',
      RCYCL_EMSN_END_TM: '20:00',
      RCYCL_EMSN_MTHD: '분리배출',
      TMPRY_BULK_WASTE_EMSN_BGNG_TM: '09:00',
      TMPRY_BULK_WASTE_EMSN_END_TM: '18:00',
      TMPRY_BULK_WASTE_EMSN_MTHD: '스티커 부착',
      TMPRY_BULK_WASTE_EMSN_PLC: '주민센터 앞',
      UNCLLT_DAY: '설,추석',
      MNG_DEPT_NM: '환경과',
      MNG_DEPT_TELNO: '055-940-3503',
      MNG_NO: 'GC-001',
      DAT_CRTR_YMD: '2024-01-01',
      LAST_MDFCN_PNT: '2024-06-15',
    };

    const result = transformTrashData(apiResponse);

    expect(result).toEqual({
      city: '경상남도',
      district: '거창군',
      targetRegion: '남상면+신원면',
      emissionPlace: '집앞',
      details: {
        emissionPlaceType: '문전수거',
        managementZone: '남상면',
        livingWaste: {
          dayOfWeek: '월,수,금',
          beginTime: '18:00',
          endTime: '21:00',
          method: '규격봉투 배출',
        },
        foodWaste: {
          dayOfWeek: '화,목,토',
          beginTime: '18:00',
          endTime: '21:00',
          method: '전용봉투',
        },
        recyclable: {
          dayOfWeek: '수,토',
          beginTime: '06:00',
          endTime: '20:00',
          method: '분리배출',
        },
        bulkWaste: {
          beginTime: '09:00',
          endTime: '18:00',
          method: '스티커 부착',
          place: '주민센터 앞',
        },
        uncollectedDay: '설,추석',
        manageDepartment: '환경과',
        managePhone: '055-940-3503',
        dataCreatedDate: '2024-01-01',
        lastModified: '2024-06-15',
      },
      sourceId: 'GC-001',
      sourceUrl: 'https://www.data.go.kr/data/15155080/openapi.do',
      govCode: null,
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
        emissionPlaceType: undefined,
        managementZone: undefined,
        livingWaste: undefined,
        foodWaste: undefined,
        recyclable: undefined,
        bulkWaste: undefined,
        uncollectedDay: undefined,
        manageDepartment: undefined,
        managePhone: undefined,
        dataCreatedDate: undefined,
        lastModified: undefined,
      },
      sourceId: expect.any(String),
      sourceUrl: 'https://www.data.go.kr/data/15155080/openapi.do',
      govCode: null,
    });
  });

  it('should use MNG_NO as sourceId when available', () => {
    const apiResponse: TrashApiResponse = {
      CTPV_NM: '서울특별시',
      SGG_NM: '강남구',
      MNG_NO: 'TEST-123',
    };

    const result = transformTrashData(apiResponse);
    expect(result!.sourceId).toBe('TEST-123');
  });

  it('should use hash fallback when MNG_NO is missing', () => {
    const apiResponse1: TrashApiResponse = {
      CTPV_NM: '서울특별시',
      SGG_NM: '강남구',
      MNG_ZONE_TRGT_RGN_NM: '삼성동',
      EMSN_PLC: '집앞',
    };

    const apiResponse2: TrashApiResponse = {
      CTPV_NM: '서울특별시',
      SGG_NM: '강남구',
      MNG_ZONE_TRGT_RGN_NM: '역삼동',
      EMSN_PLC: '집앞',
    };

    const result1 = transformTrashData(apiResponse1);
    const result2 = transformTrashData(apiResponse2);

    // Hash-based, should be 32-char hex
    expect(result1!.sourceId).toMatch(/^[a-f0-9]{32}$/);
    expect(result1!.sourceId).not.toEqual(result2!.sourceId);
  });

  it('should only create sub-objects when related fields exist', () => {
    const apiResponse: TrashApiResponse = {
      CTPV_NM: '서울특별시',
      SGG_NM: '강남구',
      LF_WST_EMSN_DOW: '월,수,금',
      // No food waste, recyclable, or bulk waste fields
    };

    const result = transformTrashData(apiResponse);

    expect(result!.details.livingWaste).toBeDefined();
    expect(result!.details.foodWaste).toBeUndefined();
    expect(result!.details.recyclable).toBeUndefined();
    expect(result!.details.bulkWaste).toBeUndefined();
  });

  it('should return null for data missing required fields', () => {
    const apiResponse1: TrashApiResponse = {
      CTPV_NM: '',
      SGG_NM: '강남구',
    };

    const apiResponse2: TrashApiResponse = {
      CTPV_NM: '서울특별시',
      SGG_NM: '',
    };

    expect(transformTrashData(apiResponse1)).toBeNull();
    expect(transformTrashData(apiResponse2)).toBeNull();
  });
});

describe('syncTrashData', () => {
  const originalDiscoveryEnabled = process.env.WASTE_AREA_DISCOVERY_ENABLED;

  beforeEach(() => {
    process.env.WASTE_AREA_DISCOVERY_ENABLED = 'true';
    vi.clearAllMocks();
    mockFetch.mockReset();
    mockTxCreate.mockClear();
    mockTxFindUnique.mockClear();
    mockTxCreateMany.mockClear();
    mockTxMarkerCreate.mockClear();
    publicationMock.prepareWasteGeneration.mockClear().mockResolvedValue({
      generationId: 'prepared-generation',
      reportHash: 'a'.repeat(64),
      canPublish: true,
      reviewReport: { reportHash: 'a'.repeat(64), sourceChanges: [] },
    });
    publicationMock.publishWasteGeneration.mockClear().mockResolvedValue(undefined);
    publicationMock.assertWasteAreaDiscoveryWriteEnabled.mockClear();
  });

  afterEach(() => {
    if (originalDiscoveryEnabled === undefined) {
      delete process.env.WASTE_AREA_DISCOVERY_ENABLED;
    } else {
      process.env.WASTE_AREA_DISCOVERY_ENABLED = originalDiscoveryEnabled;
    }
  });

  it('does not create SyncHistory during dry-run validation', async () => {
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

    expect(prisma.syncHistory.create).not.toHaveBeenCalled();
    expect(prisma.syncHistory.update).not.toHaveBeenCalled();
  });

  it('prepares a generation without publishing on completion', async () => {
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
                  MNG_NO: 'GC-001',
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

    await syncTrashData({
      serviceKey: 'test-key',
      dryRun: false,
      references: emptyRefs,
    });

    expect(publicationMock.prepareWasteGeneration).toHaveBeenCalledWith(expect.objectContaining({
      dryRun: false,
      sourceComplete: true,
    }));
    expect(publicationMock.publishWasteGeneration).not.toHaveBeenCalled();
  });

  it('should update SyncHistory with failed status on error', async () => {
    const prisma = (await import('../../src/lib/prisma.js')).default;

    mockFetch.mockRejectedValue(new Error('API Error'));

    vi.mocked(prisma.syncHistory.create).mockResolvedValueOnce({ id: 1 } as never);

    await expect(syncTrashData({ serviceKey: 'test-key', dryRun: false, references: emptyRefs })).rejects.toThrow();

    expect(prisma.syncHistory.create).toHaveBeenCalledWith({
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
                  MNG_NO: 'GN-001',
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

    // In dry run mode, transaction should not be called
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(mockTxCreate).not.toHaveBeenCalled();
    expect(result.totalRecords).toBe(1);
  });

  it('rejects incomplete page evidence before treating a collection as publishable', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          response: {
            header: { resultCode: '00' },
            body: {
              items: [{ CTPV_NM: '서울특별시', SGG_NM: '강남구', MNG_NO: 'GN-001' }],
              numOfRows: 1,
              pageNo: 2,
              totalCount: 1,
            },
          },
        }),
    });

    await expect(fetchCompleteTrashPages('test-key', 1)).rejects.toThrow(/page index/i);
  });

  it('rejects parse failures instead of publishing skipped success', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          response: {
            header: { resultCode: '00' },
            body: {
              items: [{ CTPV_NM: '', SGG_NM: '강남구', MNG_NO: 'GN-001' }],
              numOfRows: 1,
              pageNo: 1,
              totalCount: 1,
            },
          },
        }),
    });

    await expect(syncTrashData({ serviceKey: 'test-key', dryRun: true, pageSize: 1 }))
      .rejects.toThrow(/parse/i);
  });

  it('should prepare through the generation pipeline when not in dry run mode', async () => {
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
                  MNG_NO: 'GN-002',
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

    await syncTrashData({
      serviceKey: 'test-key',
      dryRun: false,
      references: emptyRefs,
    });

    expect(publicationMock.prepareWasteGeneration).toHaveBeenCalledWith(expect.objectContaining({
      provenance: 'raw',
      sourceComplete: true,
      dryRun: false,
    }));
    expect(publicationMock.publishWasteGeneration).not.toHaveBeenCalled();
    expect(mockTxCreate).toHaveBeenCalled();
    expect(mockTxMarkerCreate).toHaveBeenCalledWith({
      data: { scheduleId: 1 },
    });
  });

  it('rejects legacy approval flags before fetching source data', async () => {
    await expect(syncTrashData({
      serviceKey: 'test-key',
      dryRun: false,
      references: emptyRefs,
      approvalReportHash: 'a'.repeat(64),
    })).rejects.toThrow(/waste:publish/);

    expect(mockFetch).not.toHaveBeenCalled();
    expect(publicationMock.prepareWasteGeneration).not.toHaveBeenCalled();
    expect(publicationMock.publishWasteGeneration).not.toHaveBeenCalled();
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
                  MNG_NO: 'GN-003',
                  LF_WST_EMSN_DOW: '월,수,금',
                },
                {
                  CTPV_NM: '서울특별시',
                  SGG_NM: '강남구',
                  MNG_ZONE_TRGT_RGN_NM: '역삼동',
                  EMSN_PLC: '집앞',
                  MNG_NO: 'GN-004',
                  LF_WST_EMSN_DOW: '화,목,토',
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
    // First record exists (update), second is new (create)
    mockTxFindUnique
      .mockResolvedValueOnce({ id: 1, city: '서울특별시', district: '강남구', sourceId: 'GN-003' } as never)
      .mockResolvedValueOnce(null);

    const result = await syncTrashData({
      serviceKey: 'test-key',
      dryRun: false,
      references: emptyRefs,
    });

    expect(result.totalRecords).toBe(2);
    expect(result.newRecords).toBe(0);
    expect(result.updatedRecords).toBe(0);
  });

  it('treats an existing source identity as revision input without mutating the legacy row or adding a marker', async () => {
    mockTxFindUnique.mockResolvedValueOnce({ id: 42 });
    const item = transformTrashData({
      CTPV_NM: '서울특별시',
      SGG_NM: '강남구',
      MNG_ZONE_TRGT_RGN_NM: '역삼1동',
      EMSN_PLC: '변경된 장소',
      MNG_NO: 'existing-source',
    })!;

    const prepared = await reserveRawWasteSchedules([item], [{
      CTPV_NM: '서울특별시',
      SGG_NM: '강남구',
      MNG_ZONE_TRGT_RGN_NM: '역삼1동',
      EMSN_PLC: '변경된 장소',
      MNG_NO: 'existing-source',
    }]);

    expect(prepared[0]).toMatchObject({ scheduleId: 42, emissionPlace: '변경된 장소' });
    expect(mockTxCreate).not.toHaveBeenCalled();
    expect(mockTxMarkerCreate).not.toHaveBeenCalled();
  });


  it('redacts reviewReport from CLI-safe sync results', () => {
    expect(redactSyncResultForLog({
      totalRecords: 1,
      newRecords: 0,
      updatedRecords: 0,
      skippedRecords: 0,
      reportHash: 'a'.repeat(64),
      canPublish: true,
      reviewReport: { sourceChanges: [{ sourceId: 'secret-ish-source-id' }] },
    })).toEqual({
      totalRecords: 1,
      newRecords: 0,
      updatedRecords: 0,
      skippedRecords: 0,
      reportHash: 'a'.repeat(64),
      canPublish: true,
    });
  });

});
