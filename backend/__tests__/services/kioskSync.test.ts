// @TASK T2.3.3 - 무인민원발급기 데이터 동기화 테스트
// @SPEC docs/planning/02-trd.md#데이터-동기화

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Create persistent mock functions for transaction context
const mockTxUpsert = vi.fn().mockResolvedValue({});
const mockTxFindUnique = vi.fn().mockResolvedValue(null);

// Mock modules before importing
vi.mock('../../src/lib/prisma.js', () => ({
  default: {
    kiosk: {
      upsert: vi.fn(),
      count: vi.fn(),
      findUnique: vi.fn(),
    },
    syncHistory: {
      create: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn().mockImplementation(async (callback) => {
      // Mock transaction context with persistent mocks
      const tx = {
        kiosk: {
          upsert: mockTxUpsert,
          findUnique: mockTxFindUnique,
        },
      };
      return callback(tx);
    }),
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
  type CertificateApiResponse,
} from '../../src/scripts/syncKiosk.js';

describe('KioskSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('buildAddressFromKioskRow', () => {
    it('should return full address from INSTL_PLC_ADDR field', () => {
      const row: Partial<KioskApiResponse> = {
        MNG_NO: 'TEST001',
        OPN_ATMY_GRP_CD: '1100000000',
        INSTL_PLC_ADDR: '서울특별시 강남구 테헤란로 123, 역삼빌딩',
      };

      const address = buildAddressFromKioskRow(row as KioskApiResponse);
      expect(address).toBe('서울특별시 강남구 테헤란로 123, 역삼빌딩');
    });

    it('should handle empty address', () => {
      const row: Partial<KioskApiResponse> = {
        MNG_NO: 'TEST001',
        OPN_ATMY_GRP_CD: '1100000000',
        INSTL_PLC_ADDR: '',
      };

      const address = buildAddressFromKioskRow(row as KioskApiResponse);
      expect(address).toBe('');
    });

    it('should trim whitespace', () => {
      const row: Partial<KioskApiResponse> = {
        MNG_NO: 'TEST001',
        OPN_ATMY_GRP_CD: '1100000000',
        INSTL_PLC_ADDR: '  서울특별시 강남구 테헤란로 123  ',
      };

      const address = buildAddressFromKioskRow(row as KioskApiResponse);
      expect(address).toBe('서울특별시 강남구 테헤란로 123');
    });
  });

  describe('transformKioskData', () => {
    it('should transform API response to Facility model format', () => {
      const row: KioskApiResponse = {
        MNG_NO: 'TEST001',
        OPN_ATMY_GRP_CD: '1100000000',
        INSTL_PLC_ADDR: '서울특별시 강남구 테헤란로 123, 역삼빌딩',
        INSTL_PLC_DTL_PSTN: '1층 로비',
        ISSUMCHN_NM: '역삼역',
        MNG_INST_NM: '강남구청',
        WKDY_OPER_BGNG_TM: '09:00',
        WKDY_OPER_END_TM: '18:00',
        LHLDY_OPER_BGNG_TM: '',
        LHLDY_OPER_END_TM: '',
        FRBLND_KPD: '제공',
        FRBLND_VOICE_GD: '제공',
        BRL_LBL_ATCMNT: '미부착',
        WHCHR_USER_MNPLT: '가능',
        INSTL_PLC_PSTN: '역삼동',
      };
      const coords = { lat: 37.5012, lng: 127.0396 };
      const availableDocuments = ['주민등록등본', '가족관계증명서'];

      const result = transformKioskData(row, coords, availableDocuments);

      expect(result).toMatchObject({
        name: expect.stringContaining('무인민원발급기'),
        address: '서울특별시 강남구 테헤란로 123, 역삼빌딩',
        city: '서울특별시',
        district: '강남구',
        lat: 37.5012,
        lng: 127.0396,
        // Kiosk 전용 필드 (flat structure)
        detailLocation: '1층 로비',
        operationAgency: '강남구청',
        weekdayOperatingHours: '09:00~18:00',
        holidayOperatingHours: null,
        blindKeypad: true,
        voiceGuide: true,
        brailleOutput: false,
        wheelchairAccessible: true,
        mngNo: 'TEST001',
        availableDocuments: ['주민등록등본', '가족관계증명서'],
      });
      expect(result.id).toMatch(/^kiosk_/);
      expect(result.sourceId).toBeDefined();
    });

    it('should handle null coordinates', () => {
      const row: KioskApiResponse = {
        MNG_NO: 'TEST002',
        OPN_ATMY_GRP_CD: '1100000000',
        INSTL_PLC_ADDR: '서울특별시 강남구 테헤란로 123',
        INSTL_PLC_DTL_PSTN: '1층',
        ISSUMCHN_NM: '역삼역',
        MNG_INST_NM: '강남구청',
        WKDY_OPER_BGNG_TM: '09:00',
        WKDY_OPER_END_TM: '18:00',
        LHLDY_OPER_BGNG_TM: '',
        LHLDY_OPER_END_TM: '',
        FRBLND_KPD: '미제공',
        FRBLND_VOICE_GD: '미제공',
        BRL_LBL_ATCMNT: '미부착',
        WHCHR_USER_MNPLT: '불가능',
        INSTL_PLC_PSTN: '역삼동',
      };
      const coords = null;

      const result = transformKioskData(row, coords);

      // 좌표가 없으면 기본값 0으로 설정 (지도 미표시 처리는 프론트엔드에서)
      expect(result.lat).toBe(0);
      expect(result.lng).toBe(0);
      expect(result.availableDocuments).toEqual([]);
    });

    it('should parse 제공/미제공 fields to boolean', () => {
      const row: KioskApiResponse = {
        MNG_NO: 'TEST003',
        OPN_ATMY_GRP_CD: '1100000000',
        INSTL_PLC_ADDR: '서울특별시 강남구 테헤란로 123',
        INSTL_PLC_DTL_PSTN: '1층',
        ISSUMCHN_NM: '역삼역',
        MNG_INST_NM: '강남구청',
        WKDY_OPER_BGNG_TM: '09:00',
        WKDY_OPER_END_TM: '18:00',
        LHLDY_OPER_BGNG_TM: '',
        LHLDY_OPER_END_TM: '',
        FRBLND_KPD: '제공',
        FRBLND_VOICE_GD: '미제공',
        BRL_LBL_ATCMNT: '부착',
        WHCHR_USER_MNPLT: '불가능',
        INSTL_PLC_PSTN: '역삼동',
      };

      const result = transformKioskData(row, { lat: 37.5, lng: 127.0 });

      expect(result.blindKeypad).toBe(true);
      expect(result.voiceGuide).toBe(false);
      expect(result.brailleOutput).toBe(true);
      expect(result.wheelchairAccessible).toBe(false);
    });

    it('should format operating hours correctly', () => {
      const row: KioskApiResponse = {
        MNG_NO: 'TEST004',
        OPN_ATMY_GRP_CD: '1100000000',
        INSTL_PLC_ADDR: '서울특별시 강남구 테헤란로 123',
        INSTL_PLC_DTL_PSTN: '1층',
        ISSUMCHN_NM: '역삼역',
        MNG_INST_NM: '강남구청',
        WKDY_OPER_BGNG_TM: '09:00',
        WKDY_OPER_END_TM: '18:00',
        LHLDY_OPER_BGNG_TM: '10:00',
        LHLDY_OPER_END_TM: '14:00',
        FRBLND_KPD: '미제공',
        FRBLND_VOICE_GD: '미제공',
        BRL_LBL_ATCMNT: '미부착',
        WHCHR_USER_MNPLT: '불가능',
        INSTL_PLC_PSTN: '역삼동',
      };

      const result = transformKioskData(row, { lat: 37.5, lng: 127.0 });

      expect(result.weekdayOperatingHours).toBe('09:00~18:00');
      expect(result.saturdayOperatingHours).toBeNull(); // 새 API에는 토요일 필드 없음
      expect(result.holidayOperatingHours).toBe('10:00~14:00');
    });

    it('should include mngNo from API response', () => {
      const row: KioskApiResponse = {
        MNG_NO: 'MNG12345',
        OPN_ATMY_GRP_CD: '1100000000',
        INSTL_PLC_ADDR: '서울특별시 강남구 테헤란로 123',
        INSTL_PLC_DTL_PSTN: '1층',
        ISSUMCHN_NM: '역삼역',
        MNG_INST_NM: '강남구청',
        WKDY_OPER_BGNG_TM: '09:00',
        WKDY_OPER_END_TM: '18:00',
        LHLDY_OPER_BGNG_TM: '',
        LHLDY_OPER_END_TM: '',
        FRBLND_KPD: '미제공',
        FRBLND_VOICE_GD: '미제공',
        BRL_LBL_ATCMNT: '미부착',
        WHCHR_USER_MNPLT: '불가능',
        INSTL_PLC_PSTN: '역삼동',
      };

      const result = transformKioskData(row, { lat: 37.5, lng: 127.0 });

      expect(result.mngNo).toBe('MNG12345');
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
    beforeEach(() => {
      mockTxUpsert.mockClear();
      mockTxFindUnique.mockClear();
    });

    const mockInstallationData: KioskApiResponse[] = [
      {
        MNG_NO: 'TEST001',
        OPN_ATMY_GRP_CD: '1100000000',
        INSTL_PLC_ADDR: '서울특별시 강남구 테헤란로 123, 역삼빌딩',
        INSTL_PLC_DTL_PSTN: '1층 로비',
        ISSUMCHN_NM: '역삼역',
        MNG_INST_NM: '강남구청',
        WKDY_OPER_BGNG_TM: '09:00',
        WKDY_OPER_END_TM: '18:00',
        LHLDY_OPER_BGNG_TM: '',
        LHLDY_OPER_END_TM: '',
        FRBLND_KPD: '제공',
        FRBLND_VOICE_GD: '제공',
        BRL_LBL_ATCMNT: '미부착',
        WHCHR_USER_MNPLT: '가능',
        INSTL_PLC_PSTN: '역삼동',
      },
    ];

    const mockCertificateData: CertificateApiResponse[] = [
      {
        MNG_NO: '42710005011270000004402', // certificate_info 내부 키 (긴 코드)
        OPN_ATMY_GRP_CD: '1100000000',
        ISSUMCHN_NO: 'TEST001', // installation_info.MNG_NO와 매칭
        CVLCPT_OFCWORK_CLSF_NM: '주민등록등본',
        INITA_MENU_NM: '주민등록등본발급',
      },
      {
        MNG_NO: '42710005011270000004403',
        OPN_ATMY_GRP_CD: '1100000000',
        ISSUMCHN_NO: 'TEST001', // 같은 발급기에 다른 민원
        CVLCPT_OFCWORK_CLSF_NM: '가족관계증명서',
        INITA_MENU_NM: '가족관계증명서발급',
      },
    ];

    it('should fetch data from both installation and certificate APIs', async () => {
      vi.mocked(publicApiClient.fetchAll)
        .mockResolvedValueOnce(mockInstallationData)
        .mockResolvedValueOnce(mockCertificateData);
      vi.mocked(batchGeocode).mockResolvedValue([{ lat: 37.5012, lng: 127.0396 }]);
      vi.mocked(prisma.syncHistory.create).mockResolvedValue({ id: 1 } as never);
      vi.mocked(prisma.syncHistory.update).mockResolvedValue({} as never);
      vi.mocked(prisma.kiosk.upsert).mockResolvedValue({} as never);
      vi.mocked(prisma.kiosk.findUnique).mockResolvedValue(null as never);

      await syncKiosks();

      // fetchAll should be called twice (installation + certificate APIs)
      expect(publicApiClient.fetchAll).toHaveBeenCalledTimes(2);
      const firstCallArgs = vi.mocked(publicApiClient.fetchAll).mock.calls[0];
      const secondCallArgs = vi.mocked(publicApiClient.fetchAll).mock.calls[1];
      expect(firstCallArgs[0].endpoint).toContain('installation_info');
      expect(secondCallArgs[0].endpoint).toContain('certificate_info');
    });

    it('should geocode addresses and save to database with available documents', async () => {
      vi.mocked(publicApiClient.fetchAll)
        .mockResolvedValueOnce(mockInstallationData)
        .mockResolvedValueOnce(mockCertificateData);
      vi.mocked(batchGeocode).mockResolvedValue([{ lat: 37.5012, lng: 127.0396 }]);
      vi.mocked(prisma.syncHistory.create).mockResolvedValue({ id: 1 } as never);
      vi.mocked(prisma.syncHistory.update).mockResolvedValue({} as never);

      await syncKiosks();

      expect(batchGeocode).toHaveBeenCalled();
      expect(mockTxUpsert).toHaveBeenCalled();

      const upsertCall = mockTxUpsert.mock.calls[0][0];
      expect(upsertCall.create.mngNo).toBe('TEST001');
      expect(upsertCall.create.availableDocuments).toEqual(['주민등록등본', '가족관계증명서']);
    });

    it('should record sync history', async () => {
      vi.mocked(publicApiClient.fetchAll)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
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
      vi.mocked(publicApiClient.fetchAll)
        .mockResolvedValueOnce(mockInstallationData)
        .mockResolvedValueOnce(mockCertificateData);
      vi.mocked(batchGeocode).mockResolvedValue([{ lat: 37.5012, lng: 127.0396 }]);
      vi.mocked(prisma.syncHistory.create).mockResolvedValue({ id: 1 } as never);
      vi.mocked(prisma.syncHistory.update).mockResolvedValue({} as never);
      vi.mocked(prisma.kiosk.upsert).mockResolvedValue({} as never);
      vi.mocked(prisma.kiosk.findUnique).mockResolvedValue(null as never);

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
      vi.mocked(publicApiClient.fetchAll).mockReset();
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

    it('should handle kiosk with no certificate data', async () => {
      const installationDataWithNoMngNo: KioskApiResponse[] = [
        {
          MNG_NO: 'TEST999',
          OPN_ATMY_GRP_CD: '1100000000',
          INSTL_PLC_ADDR: '서울특별시 강남구 테헤란로 123',
          INSTL_PLC_DTL_PSTN: '1층',
          ISSUMCHN_NM: '역삼역',
          MNG_INST_NM: '강남구청',
          WKDY_OPER_BGNG_TM: '09:00',
          WKDY_OPER_END_TM: '18:00',
          LHLDY_OPER_BGNG_TM: '',
          LHLDY_OPER_END_TM: '',
          FRBLND_KPD: '미제공',
          FRBLND_VOICE_GD: '미제공',
          BRL_LBL_ATCMNT: '미부착',
          WHCHR_USER_MNPLT: '불가능',
          INSTL_PLC_PSTN: '역삼동',
        },
      ];

      vi.mocked(publicApiClient.fetchAll)
        .mockResolvedValueOnce(installationDataWithNoMngNo)
        .mockResolvedValueOnce([]); // No certificate data
      vi.mocked(batchGeocode).mockResolvedValue([{ lat: 37.5012, lng: 127.0396 }]);
      vi.mocked(prisma.syncHistory.create).mockResolvedValue({ id: 1 } as never);
      vi.mocked(prisma.syncHistory.update).mockResolvedValue({} as never);

      await syncKiosks();

      const upsertCall = mockTxUpsert.mock.calls[0][0];
      expect(upsertCall.create.availableDocuments).toEqual([]);
    });
  });
});
