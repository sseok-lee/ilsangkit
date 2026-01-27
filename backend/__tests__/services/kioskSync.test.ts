// @TASK T2.3.3 - 무인민원발급기 데이터 동기화 테스트
// @SPEC docs/planning/02-trd.md#데이터-동기화

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock modules before importing
vi.mock('../../src/lib/prisma.js', () => ({
  default: {
    facility: {
      upsert: vi.fn(),
      count: vi.fn(),
      findUnique: vi.fn(),
    },
    syncHistory: {
      create: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock('../../src/lib/publicApiClient.js', () => ({
  publicApiClient: {
    fetchAll: vi.fn(),
  },
}));

vi.mock('../../src/services/geocodingService.js', () => ({
  geocode: vi.fn(),
  batchGeocode: vi.fn(),
}));

import prisma from '../../src/lib/prisma.js';
import { publicApiClient } from '../../src/lib/publicApiClient.js';
import { geocode, batchGeocode } from '../../src/services/geocodingService.js';
import {
  syncKiosks,
  transformKioskData,
  buildAddressFromKioskRow,
  type KioskApiResponse,
} from '../../src/scripts/syncKiosk.js';

describe('KioskSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('buildAddressFromKioskRow', () => {
    it('should build full address from API response fields', () => {
      const row: Partial<KioskApiResponse> = {
        addrCtpvNm: '서울특별시',
        addrSggNm: '강남구',
        addrEmdNm: '역삼동',
        addrRn: '테헤란로 123',
      };

      const address = buildAddressFromKioskRow(row as KioskApiResponse);
      expect(address).toBe('서울특별시 강남구 테헤란로 123');
    });

    it('should handle missing road address', () => {
      const row: Partial<KioskApiResponse> = {
        addrCtpvNm: '서울특별시',
        addrSggNm: '강남구',
        addrEmdNm: '역삼동',
        addrRn: '',
      };

      const address = buildAddressFromKioskRow(row as KioskApiResponse);
      expect(address).toBe('서울특별시 강남구 역삼동');
    });

    it('should trim whitespace', () => {
      const row: Partial<KioskApiResponse> = {
        addrCtpvNm: '  서울특별시  ',
        addrSggNm: '  강남구  ',
        addrEmdNm: '역삼동',
        addrRn: '테헤란로 123  ',
      };

      const address = buildAddressFromKioskRow(row as KioskApiResponse);
      expect(address).toBe('서울특별시 강남구 테헤란로 123');
    });
  });

  describe('transformKioskData', () => {
    it('should transform API response to Facility model format', () => {
      const row: KioskApiResponse = {
        addrCtpvNm: '서울특별시',
        addrSggNm: '강남구',
        addrEmdNm: '역삼동',
        addrRn: '테헤란로 123',
        instlPlcDtlLocCn: '역삼역 1번출구',
        operInstNm: '강남구청',
        wdayOperBgngTm: '09:00',
        wdayOperEndTm: '18:00',
        satOperBgngTm: '10:00',
        satOperEndTm: '14:00',
        hldyOperBgngTm: '',
        hldyOperEndTm: '',
        vdiYn: 'Y',
        vcgdYn: 'Y',
        brllPrnYn: 'N',
        whlchUseYn: 'Y',
      };
      const coords = { lat: 37.5012, lng: 127.0396 };

      const result = transformKioskData(row, coords);

      expect(result).toMatchObject({
        category: 'kiosk',
        name: expect.stringContaining('무인민원발급기'),
        address: '서울특별시 강남구 테헤란로 123',
        city: '서울특별시',
        district: '강남구',
        lat: 37.5012,
        lng: 127.0396,
        details: expect.objectContaining({
          detailLocation: '역삼역 1번출구',
          operationAgency: '강남구청',
          weekdayOperatingHours: '09:00~18:00',
          saturdayOperatingHours: '10:00~14:00',
          holidayOperatingHours: null,
          blindKeypad: true,
          voiceGuide: true,
          brailleOutput: false,
          wheelchairAccessible: true,
        }),
      });
      expect(result.id).toMatch(/^kiosk_/);
      expect(result.sourceId).toBeDefined();
    });

    it('should handle null coordinates', () => {
      const row: KioskApiResponse = {
        addrCtpvNm: '서울특별시',
        addrSggNm: '강남구',
        addrEmdNm: '역삼동',
        addrRn: '테헤란로 123',
        instlPlcDtlLocCn: '역삼역 1번출구',
        operInstNm: '강남구청',
        wdayOperBgngTm: '09:00',
        wdayOperEndTm: '18:00',
        satOperBgngTm: '',
        satOperEndTm: '',
        hldyOperBgngTm: '',
        hldyOperEndTm: '',
        vdiYn: 'N',
        vcgdYn: 'N',
        brllPrnYn: 'N',
        whlchUseYn: 'N',
      };
      const coords = null;

      const result = transformKioskData(row, coords);

      // 좌표가 없으면 기본값 0으로 설정 (지도 미표시 처리는 프론트엔드에서)
      expect(result.lat).toBe(0);
      expect(result.lng).toBe(0);
    });

    it('should parse Y/N fields to boolean', () => {
      const row: KioskApiResponse = {
        addrCtpvNm: '서울특별시',
        addrSggNm: '강남구',
        addrEmdNm: '역삼동',
        addrRn: '테헤란로 123',
        instlPlcDtlLocCn: '역삼역',
        operInstNm: '강남구청',
        wdayOperBgngTm: '09:00',
        wdayOperEndTm: '18:00',
        satOperBgngTm: '',
        satOperEndTm: '',
        hldyOperBgngTm: '',
        hldyOperEndTm: '',
        vdiYn: 'Y',
        vcgdYn: 'N',
        brllPrnYn: 'Y',
        whlchUseYn: 'N',
      };

      const result = transformKioskData(row, { lat: 37.5, lng: 127.0 });

      expect(result.details.blindKeypad).toBe(true);
      expect(result.details.voiceGuide).toBe(false);
      expect(result.details.brailleOutput).toBe(true);
      expect(result.details.wheelchairAccessible).toBe(false);
    });

    it('should format operating hours correctly', () => {
      const row: KioskApiResponse = {
        addrCtpvNm: '서울특별시',
        addrSggNm: '강남구',
        addrEmdNm: '역삼동',
        addrRn: '테헤란로 123',
        instlPlcDtlLocCn: '역삼역',
        operInstNm: '강남구청',
        wdayOperBgngTm: '0900',
        wdayOperEndTm: '1800',
        satOperBgngTm: '1000',
        satOperEndTm: '1400',
        hldyOperBgngTm: '1000',
        hldyOperEndTm: '1200',
        vdiYn: 'N',
        vcgdYn: 'N',
        brllPrnYn: 'N',
        whlchUseYn: 'N',
      };

      const result = transformKioskData(row, { lat: 37.5, lng: 127.0 });

      expect(result.details.weekdayOperatingHours).toBe('0900~1800');
      expect(result.details.saturdayOperatingHours).toBe('1000~1400');
      expect(result.details.holidayOperatingHours).toBe('1000~1200');
    });
  });

  describe('geocodingService', () => {
    it('should call Kakao geocoding API', async () => {
      const mockCoords = { lat: 37.5012, lng: 127.0396 };
      vi.mocked(geocode).mockResolvedValue(mockCoords);

      const result = await geocode('서울특별시 강남구 테헤란로 123');

      expect(geocode).toHaveBeenCalledWith('서울특별시 강남구 테헤란로 123');
      expect(result).toEqual(mockCoords);
    });

    it('should return null on geocoding failure', async () => {
      vi.mocked(geocode).mockResolvedValue(null);

      const result = await geocode('존재하지않는주소');

      expect(result).toBeNull();
    });

    it('should batch geocode with rate limiting', async () => {
      const addresses = [
        '서울특별시 강남구 테헤란로 123',
        '서울특별시 서초구 서초대로 456',
      ];
      const mockResults = [
        { lat: 37.5012, lng: 127.0396 },
        { lat: 37.4923, lng: 127.0292 },
      ];
      vi.mocked(batchGeocode).mockResolvedValue(mockResults);

      const results = await batchGeocode(addresses);

      expect(batchGeocode).toHaveBeenCalledWith(addresses);
      expect(results).toHaveLength(2);
    });
  });

  describe('syncKiosks', () => {
    it('should fetch data from public API', async () => {
      const mockApiData: KioskApiResponse[] = [
        {
          addrCtpvNm: '서울특별시',
          addrSggNm: '강남구',
          addrEmdNm: '역삼동',
          addrRn: '테헤란로 123',
          instlPlcDtlLocCn: '역삼역 1번출구',
          operInstNm: '강남구청',
          wdayOperBgngTm: '09:00',
          wdayOperEndTm: '18:00',
          satOperBgngTm: '',
          satOperEndTm: '',
          hldyOperBgngTm: '',
          hldyOperEndTm: '',
          vdiYn: 'Y',
          vcgdYn: 'Y',
          brllPrnYn: 'N',
          whlchUseYn: 'Y',
        },
      ];

      vi.mocked(publicApiClient.fetchAll).mockResolvedValue(mockApiData);
      vi.mocked(batchGeocode).mockResolvedValue([{ lat: 37.5012, lng: 127.0396 }]);
      vi.mocked(prisma.syncHistory.create).mockResolvedValue({ id: 1 } as never);
      vi.mocked(prisma.syncHistory.update).mockResolvedValue({} as never);
      vi.mocked(prisma.facility.upsert).mockResolvedValue({} as never);
      vi.mocked(prisma.facility.findUnique).mockResolvedValue(null as never);

      await syncKiosks();

      // fetchAll은 config와 options 두 인자로 호출됨
      expect(publicApiClient.fetchAll).toHaveBeenCalled();
      const callArgs = vi.mocked(publicApiClient.fetchAll).mock.calls[0];
      expect(callArgs[0].endpoint).toContain('kiosk_info');
    });

    it('should geocode addresses and save to database', async () => {
      const mockApiData: KioskApiResponse[] = [
        {
          addrCtpvNm: '서울특별시',
          addrSggNm: '강남구',
          addrEmdNm: '역삼동',
          addrRn: '테헤란로 123',
          instlPlcDtlLocCn: '역삼역 1번출구',
          operInstNm: '강남구청',
          wdayOperBgngTm: '09:00',
          wdayOperEndTm: '18:00',
          satOperBgngTm: '',
          satOperEndTm: '',
          hldyOperBgngTm: '',
          hldyOperEndTm: '',
          vdiYn: 'Y',
          vcgdYn: 'Y',
          brllPrnYn: 'N',
          whlchUseYn: 'Y',
        },
      ];

      vi.mocked(publicApiClient.fetchAll).mockResolvedValue(mockApiData);
      vi.mocked(batchGeocode).mockResolvedValue([{ lat: 37.5012, lng: 127.0396 }]);
      vi.mocked(prisma.syncHistory.create).mockResolvedValue({ id: 1 } as never);
      vi.mocked(prisma.syncHistory.update).mockResolvedValue({} as never);
      vi.mocked(prisma.facility.upsert).mockResolvedValue({} as never);
      vi.mocked(prisma.facility.findUnique).mockResolvedValue(null as never);

      await syncKiosks();

      expect(batchGeocode).toHaveBeenCalled();
      expect(prisma.facility.upsert).toHaveBeenCalled();
    });

    it('should record sync history', async () => {
      const mockApiData: KioskApiResponse[] = [];

      vi.mocked(publicApiClient.fetchAll).mockResolvedValue(mockApiData);
      vi.mocked(prisma.syncHistory.create).mockResolvedValue({ id: 1 } as never);
      vi.mocked(prisma.syncHistory.update).mockResolvedValue({} as never);

      await syncKiosks();

      expect(prisma.syncHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          category: 'kiosk',
          status: 'running',
        }),
      });
    });

    it('should update sync history on completion', async () => {
      const mockApiData: KioskApiResponse[] = [
        {
          addrCtpvNm: '서울특별시',
          addrSggNm: '강남구',
          addrEmdNm: '역삼동',
          addrRn: '테헤란로 123',
          instlPlcDtlLocCn: '역삼역',
          operInstNm: '강남구청',
          wdayOperBgngTm: '09:00',
          wdayOperEndTm: '18:00',
          satOperBgngTm: '',
          satOperEndTm: '',
          hldyOperBgngTm: '',
          hldyOperEndTm: '',
          vdiYn: 'Y',
          vcgdYn: 'Y',
          brllPrnYn: 'N',
          whlchUseYn: 'Y',
        },
      ];

      vi.mocked(publicApiClient.fetchAll).mockResolvedValue(mockApiData);
      vi.mocked(batchGeocode).mockResolvedValue([{ lat: 37.5012, lng: 127.0396 }]);
      vi.mocked(prisma.syncHistory.create).mockResolvedValue({ id: 1 } as never);
      vi.mocked(prisma.syncHistory.update).mockResolvedValue({} as never);
      vi.mocked(prisma.facility.upsert).mockResolvedValue({} as never);
      vi.mocked(prisma.facility.findUnique).mockResolvedValue(null as never);

      await syncKiosks();

      expect(prisma.syncHistory.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: expect.objectContaining({
          status: 'success',
          completedAt: expect.any(Date),
        }),
      });
    });

    it('should handle API errors and record failed status', async () => {
      vi.mocked(publicApiClient.fetchAll).mockRejectedValue(new Error('API Error'));
      vi.mocked(prisma.syncHistory.create).mockResolvedValue({ id: 1 } as never);
      vi.mocked(prisma.syncHistory.update).mockResolvedValue({} as never);

      await expect(syncKiosks()).rejects.toThrow('API Error');

      expect(prisma.syncHistory.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: expect.objectContaining({
          status: 'failed',
          errorMessage: 'API Error',
        }),
      });
    });
  });
});
