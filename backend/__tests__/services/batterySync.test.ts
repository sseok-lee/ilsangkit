// @TASK T2.3.2 - 폐형광등/폐건전지 데이터 동기화 테스트
// @SPEC docs/planning/02-trd.md#데이터-동기화

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock Prisma
vi.mock('../../src/lib/prisma.js', () => ({
  default: {
    facility: {
      upsert: vi.fn(),
      findUnique: vi.fn().mockResolvedValue(null), // 새 레코드로 처리
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

// Import after mocks
import prisma from '../../src/lib/prisma.js';
import {
  fetchBatteryData,
  transformBatteryData,
  syncBatteryData,
  type BatteryApiResponse,
  type BatteryApiItem,
} from '../../src/scripts/syncBattery.js';

describe('Battery Data Sync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // 환경 변수 설정
    process.env.OPENAPI_SERVICE_KEY = 'test-api-key';
  });

  afterEach(() => {
    delete process.env.OPENAPI_SERVICE_KEY;
  });

  describe('fetchBatteryData - API 호출', () => {
    it('should call API with correct parameters', async () => {
      const mockResponse: BatteryApiResponse = {
        response: {
          header: { resultCode: '00', resultMsg: 'NORMAL SERVICE.' },
          body: {
            items: [],
            numOfRows: 100,
            pageNo: 1,
            totalCount: 0,
          },
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      await fetchBatteryData(1, 100);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const calledUrl = mockFetch.mock.calls[0][0];
      expect(calledUrl).toContain('api.data.go.kr');
      expect(calledUrl).toContain('tn_pubr_public_waste_lamp_battery_collection_box_api');
      expect(calledUrl).toContain('pageNo=1');
      expect(calledUrl).toContain('numOfRows=100');
      expect(calledUrl).toContain('type=json');
    });

    it('should return items from API response', async () => {
      const mockItems: BatteryApiItem[] = [
        {
          instlPlcNm: '테스트 수거함',
          dtlLoc: '1층 로비',
          ctprvnNm: '서울특별시',
          signguNm: '강남구',
          rdnmadr: '서울특별시 강남구 테헤란로 123',
          lnmadr: '서울특별시 강남구 역삼동 123-45',
          latitude: '37.5000000',
          longitude: '127.0500000',
          colctItmNm: '폐건전지, 폐형광등',
          colctBoxCnt: '2',
          mngInsttNm: '강남구청',
          mngInsttTelno: '02-1234-5678',
        },
      ];

      const mockResponse: BatteryApiResponse = {
        response: {
          header: { resultCode: '00', resultMsg: 'NORMAL SERVICE.' },
          body: {
            items: mockItems,
            numOfRows: 100,
            pageNo: 1,
            totalCount: 1,
          },
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await fetchBatteryData(1, 100);

      expect(result.items).toHaveLength(1);
      expect(result.items[0].instlPlcNm).toBe('테스트 수거함');
      expect(result.totalCount).toBe(1);
    });

    it('should throw error when API returns error code', async () => {
      const mockResponse: BatteryApiResponse = {
        response: {
          header: { resultCode: '99', resultMsg: 'SERVICE ERROR' },
          body: {
            items: [],
            numOfRows: 100,
            pageNo: 1,
            totalCount: 0,
          },
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      await expect(fetchBatteryData(1, 100)).rejects.toThrow('API Error');
    });

    it('should throw error when fetch fails', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(fetchBatteryData(1, 100)).rejects.toThrow('Network error');
    });
  });

  describe('transformBatteryData - 데이터 변환', () => {
    it('should transform API response to Facility model', () => {
      const apiItem: BatteryApiItem = {
        instlPlcNm: '강남역 지하철역',
        dtlLoc: '2호선 출구 앞',
        ctprvnNm: '서울특별시',
        signguNm: '강남구',
        rdnmadr: '서울특별시 강남구 강남대로 396',
        lnmadr: '서울특별시 강남구 역삼동 123',
        latitude: '37.4979',
        longitude: '127.0276',
        colctItmNm: '폐건전지, 폐형광등',
        colctBoxCnt: '3',
        mngInsttNm: '서울교통공사',
        mngInsttTelno: '02-6311-1234',
      };

      const result = transformBatteryData(apiItem);

      expect(result).toMatchObject({
        name: '강남역 지하철역',
        address: '서울특별시 강남구 역삼동 123',
        roadAddress: '서울특별시 강남구 강남대로 396',
        lat: 37.4979,
        lng: 127.0276,
        city: '서울특별시',
        district: '강남구',
        category: 'battery',
        details: {
          detailLocation: '2호선 출구 앞',
          collectionItems: '폐건전지, 폐형광등',
          boxCount: 3,
          managementAgency: '서울교통공사',
          phoneNumber: '02-6311-1234',
        },
      });
    });

    it('should generate unique ID based on category and location', () => {
      const apiItem: BatteryApiItem = {
        instlPlcNm: '테스트 장소',
        dtlLoc: '',
        ctprvnNm: '서울특별시',
        signguNm: '강남구',
        rdnmadr: '서울특별시 강남구 테헤란로 123',
        lnmadr: '',
        latitude: '37.5000',
        longitude: '127.0500',
        colctItmNm: '폐건전지',
        colctBoxCnt: '1',
        mngInsttNm: '',
        mngInsttTelno: '',
      };

      const result = transformBatteryData(apiItem);

      expect(result.id).toBeDefined();
      expect(result.id).toContain('battery');
      expect(result.sourceId).toBeDefined();
    });

    it('should use lnmadr when rdnmadr is empty', () => {
      const apiItem: BatteryApiItem = {
        instlPlcNm: '테스트 장소',
        dtlLoc: '',
        ctprvnNm: '서울특별시',
        signguNm: '강남구',
        rdnmadr: '',
        lnmadr: '서울특별시 강남구 역삼동 456',
        latitude: '37.5000',
        longitude: '127.0500',
        colctItmNm: '폐건전지',
        colctBoxCnt: '1',
        mngInsttNm: '',
        mngInsttTelno: '',
      };

      const result = transformBatteryData(apiItem);

      expect(result.address).toBe('서울특별시 강남구 역삼동 456');
      expect(result.roadAddress).toBeNull();
    });

    it('should handle missing optional fields', () => {
      const apiItem: BatteryApiItem = {
        instlPlcNm: '최소 정보 장소',
        dtlLoc: '',
        ctprvnNm: '서울특별시',
        signguNm: '강남구',
        rdnmadr: '',
        lnmadr: '',
        latitude: '37.5000',
        longitude: '127.0500',
        colctItmNm: '',
        colctBoxCnt: '',
        mngInsttNm: '',
        mngInsttTelno: '',
      };

      const result = transformBatteryData(apiItem);

      expect(result.name).toBe('최소 정보 장소');
      expect(result.address).toBeNull();
      expect(result.roadAddress).toBeNull();
      expect(result.details.boxCount).toBe(1); // 기본값
    });

    it('should skip items with invalid coordinates', () => {
      const apiItem: BatteryApiItem = {
        instlPlcNm: '좌표 없는 장소',
        dtlLoc: '',
        ctprvnNm: '서울특별시',
        signguNm: '강남구',
        rdnmadr: '서울특별시 강남구 테헤란로 123',
        lnmadr: '',
        latitude: '',
        longitude: '',
        colctItmNm: '폐건전지',
        colctBoxCnt: '1',
        mngInsttNm: '',
        mngInsttTelno: '',
      };

      const result = transformBatteryData(apiItem);

      expect(result).toBeNull();
    });

    it('should skip items with zero coordinates', () => {
      const apiItem: BatteryApiItem = {
        instlPlcNm: '좌표 0인 장소',
        dtlLoc: '',
        ctprvnNm: '서울특별시',
        signguNm: '강남구',
        rdnmadr: '서울특별시 강남구 테헤란로 123',
        lnmadr: '',
        latitude: '0',
        longitude: '0',
        colctItmNm: '폐건전지',
        colctBoxCnt: '1',
        mngInsttNm: '',
        mngInsttTelno: '',
      };

      const result = transformBatteryData(apiItem);

      expect(result).toBeNull();
    });
  });

  describe('syncBatteryData - 전체 동기화', () => {
    it('should upsert transformed data to database', async () => {
      const mockItems: BatteryApiItem[] = [
        {
          instlPlcNm: '동기화 테스트 장소',
          dtlLoc: '1층',
          ctprvnNm: '서울특별시',
          signguNm: '강남구',
          rdnmadr: '서울특별시 강남구 테헤란로 123',
          lnmadr: '서울특별시 강남구 역삼동 123',
          latitude: '37.5000',
          longitude: '127.0500',
          colctItmNm: '폐건전지',
          colctBoxCnt: '1',
          mngInsttNm: '테스트기관',
          mngInsttTelno: '02-1234-5678',
        },
      ];

      const mockResponse: BatteryApiResponse = {
        response: {
          header: { resultCode: '00', resultMsg: 'NORMAL SERVICE.' },
          body: {
            items: mockItems,
            numOfRows: 100,
            pageNo: 1,
            totalCount: 1,
          },
        },
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      (prisma.facility.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const result = await syncBatteryData();

      expect(prisma.facility.upsert).toHaveBeenCalled();
      expect(result.totalRecords).toBeGreaterThanOrEqual(0);
    });

    it('should record sync history on success', async () => {
      const mockResponse: BatteryApiResponse = {
        response: {
          header: { resultCode: '00', resultMsg: 'NORMAL SERVICE.' },
          body: {
            items: [],
            numOfRows: 100,
            pageNo: 1,
            totalCount: 0,
          },
        },
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      await syncBatteryData();

      expect(prisma.syncHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          category: 'battery',
          status: 'running',
        }),
      });

      expect(prisma.syncHistory.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: expect.objectContaining({
          status: 'success',
          completedAt: expect.any(Date),
        }),
      });
    });

    it('should record sync history on failure', async () => {
      mockFetch.mockRejectedValue(new Error('API failure'));

      await expect(syncBatteryData()).rejects.toThrow();

      expect(prisma.syncHistory.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: expect.objectContaining({
          status: 'failed',
          errorMessage: expect.stringContaining('API failure'),
        }),
      });
    });

    it('should handle pagination when totalCount exceeds page size', async () => {
      // 첫 페이지 응답 (총 150건, 페이지당 100건)
      const mockPage1: BatteryApiResponse = {
        response: {
          header: { resultCode: '00', resultMsg: 'NORMAL SERVICE.' },
          body: {
            items: Array(100).fill({
              instlPlcNm: '장소',
              dtlLoc: '',
              ctprvnNm: '서울특별시',
              signguNm: '강남구',
              rdnmadr: '주소',
              lnmadr: '',
              latitude: '37.5',
              longitude: '127.0',
              colctItmNm: '폐건전지',
              colctBoxCnt: '1',
              mngInsttNm: '',
              mngInsttTelno: '',
            }),
            numOfRows: 100,
            pageNo: 1,
            totalCount: 150,
          },
        },
      };

      // 두 번째 페이지 응답
      const mockPage2: BatteryApiResponse = {
        response: {
          header: { resultCode: '00', resultMsg: 'NORMAL SERVICE.' },
          body: {
            items: Array(50).fill({
              instlPlcNm: '장소2',
              dtlLoc: '',
              ctprvnNm: '서울특별시',
              signguNm: '강남구',
              rdnmadr: '주소2',
              lnmadr: '',
              latitude: '37.5',
              longitude: '127.0',
              colctItmNm: '폐건전지',
              colctBoxCnt: '1',
              mngInsttNm: '',
              mngInsttTelno: '',
            }),
            numOfRows: 100,
            pageNo: 2,
            totalCount: 150,
          },
        },
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockPage1),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockPage2),
        });

      (prisma.facility.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({});

      await syncBatteryData();

      // 2번의 API 호출이 있어야 함
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should skip invalid items and continue processing', async () => {
      const mockItems: BatteryApiItem[] = [
        {
          // 유효한 항목
          instlPlcNm: '유효한 장소',
          dtlLoc: '',
          ctprvnNm: '서울특별시',
          signguNm: '강남구',
          rdnmadr: '주소',
          lnmadr: '',
          latitude: '37.5',
          longitude: '127.0',
          colctItmNm: '폐건전지',
          colctBoxCnt: '1',
          mngInsttNm: '',
          mngInsttTelno: '',
        },
        {
          // 좌표 없는 항목 (스킵됨)
          instlPlcNm: '좌표 없는 장소',
          dtlLoc: '',
          ctprvnNm: '서울특별시',
          signguNm: '강남구',
          rdnmadr: '주소',
          lnmadr: '',
          latitude: '',
          longitude: '',
          colctItmNm: '폐건전지',
          colctBoxCnt: '1',
          mngInsttNm: '',
          mngInsttTelno: '',
        },
      ];

      const mockResponse: BatteryApiResponse = {
        response: {
          header: { resultCode: '00', resultMsg: 'NORMAL SERVICE.' },
          body: {
            items: mockItems,
            numOfRows: 100,
            pageNo: 1,
            totalCount: 2,
          },
        },
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      (prisma.facility.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const result = await syncBatteryData();

      // 유효한 항목만 upsert
      expect(prisma.facility.upsert).toHaveBeenCalledTimes(1);
      expect(result.totalRecords).toBe(1);
    });
  });
});
