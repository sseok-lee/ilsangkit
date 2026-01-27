// @TASK T2.3.1 - 의류수거함 데이터 동기화 테스트
// @SPEC docs/planning/02-trd.md#데이터-동기화

import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from 'vitest';
import prisma from '../../src/lib/prisma.js';

// Mock 데이터: 의류수거함 API 응답 형식
const mockClothesApiResponse = {
  response: {
    header: {
      resultCode: '00',
      resultMsg: 'NORMAL SERVICE.',
    },
    body: {
      items: [
        {
          mngNo: 'CLOTHES-001',
          instlPlc: '서울시 강남구 역삼동 123 앞',
          ctprvnNm: '서울특별시',
          signguNm: '강남구',
          rdnmadr: '서울특별시 강남구 테헤란로 123',
          lnmadr: '서울특별시 강남구 역삼동 123',
          latitude: '37.5012',
          longitude: '127.0396',
          mngInsttNm: '강남구청 환경과',
          instlYmd: '2023-01-15',
          phoneNumber: '02-3423-1234',
        },
        {
          mngNo: 'CLOTHES-002',
          instlPlc: '서울시 강남구 삼성동 456 앞',
          ctprvnNm: '서울특별시',
          signguNm: '강남구',
          rdnmadr: '서울특별시 강남구 봉은사로 456',
          lnmadr: '서울특별시 강남구 삼성동 456',
          latitude: '37.5134',
          longitude: '127.0546',
          mngInsttNm: '강남구청 환경과',
          instlYmd: '2023-02-20',
          phoneNumber: '02-3423-5678',
        },
        // 좌표가 없는 데이터 (필터링 대상)
        {
          mngNo: 'CLOTHES-003',
          instlPlc: '좌표없는 수거함',
          ctprvnNm: '서울특별시',
          signguNm: '강남구',
          rdnmadr: '서울특별시 강남구 어딘가',
          lnmadr: '',
          latitude: '',
          longitude: '',
          mngInsttNm: '강남구청',
          instlYmd: '',
          phoneNumber: '',
        },
      ],
      numOfRows: 10,
      pageNo: 1,
      totalCount: 3,
    },
  },
};

// 모듈 mock
vi.mock('../../src/lib/publicApiClient.js', () => ({
  fetchPublicApi: vi.fn(),
}));

describe('의류수거함 동기화 서비스', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    // 테스트 데이터 정리
    await prisma.facility.deleteMany({
      where: { sourceId: { startsWith: 'CLOTHES-' } },
    });
    await prisma.syncHistory.deleteMany({
      where: { category: 'clothes' },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('transformClothesData', () => {
    it('API 응답을 Facility 모델 형식으로 변환해야 한다', async () => {
      const { transformClothesData } = await import('../../src/scripts/syncClothes.js');

      const apiItem = mockClothesApiResponse.response.body.items[0];
      const result = transformClothesData(apiItem);

      expect(result).toMatchObject({
        id: expect.stringContaining('clothes-'),
        category: 'clothes',
        name: '서울시 강남구 역삼동 123 앞',
        address: '서울특별시 강남구 역삼동 123',
        roadAddress: '서울특별시 강남구 테헤란로 123',
        lat: expect.any(Object), // Prisma Decimal
        lng: expect.any(Object),
        city: '서울',
        district: '강남구',
        sourceId: 'CLOTHES-001',
        details: expect.objectContaining({
          managementNo: 'CLOTHES-001',
          managementAgency: '강남구청 환경과',
          installDate: '2023-01-15',
          phoneNumber: '02-3423-1234',
        }),
      });
    });

    it('도로명 주소가 없으면 지번 주소를 사용해야 한다', async () => {
      const { transformClothesData } = await import('../../src/scripts/syncClothes.js');

      const apiItem = {
        mngNo: 'CLOTHES-004',
        instlPlc: '테스트 수거함',
        ctprvnNm: '서울특별시',
        signguNm: '강남구',
        rdnmadr: '', // 도로명 주소 없음
        lnmadr: '서울특별시 강남구 테스트동 789',
        latitude: '37.5',
        longitude: '127.0',
        mngInsttNm: '강남구청',
        instlYmd: '',
        phoneNumber: '',
      };

      const result = transformClothesData(apiItem);

      expect(result.address).toBe('서울특별시 강남구 테스트동 789');
      expect(result.roadAddress).toBeNull();
    });

    it('시도명에서 "시/도"를 제거하고 짧은 형태로 변환해야 한다', async () => {
      const { transformClothesData } = await import('../../src/scripts/syncClothes.js');

      const testCases = [
        { ctprvnNm: '서울특별시', expected: '서울' },
        { ctprvnNm: '부산광역시', expected: '부산' },
        { ctprvnNm: '경기도', expected: '경기' },
        { ctprvnNm: '제주특별자치도', expected: '제주' },
        { ctprvnNm: '세종특별자치시', expected: '세종' },
      ];

      for (const tc of testCases) {
        const result = transformClothesData({
          mngNo: 'TEST',
          instlPlc: '테스트',
          ctprvnNm: tc.ctprvnNm,
          signguNm: '테스트구',
          rdnmadr: '',
          lnmadr: '테스트 주소',
          latitude: '37.5',
          longitude: '127.0',
          mngInsttNm: '',
          instlYmd: '',
          phoneNumber: '',
        });

        expect(result.city).toBe(tc.expected);
      }
    });
  });

  describe('isValidClothesData', () => {
    it('유효한 좌표가 있는 데이터는 true를 반환해야 한다', async () => {
      const { isValidClothesData } = await import('../../src/scripts/syncClothes.js');

      const validItem = mockClothesApiResponse.response.body.items[0];
      expect(isValidClothesData(validItem)).toBe(true);
    });

    it('좌표가 없는 데이터는 false를 반환해야 한다', async () => {
      const { isValidClothesData } = await import('../../src/scripts/syncClothes.js');

      const invalidItem = mockClothesApiResponse.response.body.items[2];
      expect(isValidClothesData(invalidItem)).toBe(false);
    });

    it('관리번호가 없는 데이터는 false를 반환해야 한다', async () => {
      const { isValidClothesData } = await import('../../src/scripts/syncClothes.js');

      const invalidItem = {
        mngNo: '',
        instlPlc: '테스트',
        ctprvnNm: '서울특별시',
        signguNm: '강남구',
        rdnmadr: '',
        lnmadr: '테스트 주소',
        latitude: '37.5',
        longitude: '127.0',
        mngInsttNm: '',
        instlYmd: '',
        phoneNumber: '',
      };

      expect(isValidClothesData(invalidItem)).toBe(false);
    });
  });

  describe('syncClothesData', () => {
    it('API에서 데이터를 가져와 DB에 저장해야 한다', async () => {
      const { fetchPublicApi } = await import('../../src/lib/publicApiClient.js');
      const { syncClothesData } = await import('../../src/scripts/syncClothes.js');

      // Mock API 응답
      vi.mocked(fetchPublicApi).mockResolvedValue(mockClothesApiResponse);

      const result = await syncClothesData();

      // 결과 확인
      expect(result.totalRecords).toBe(3);
      expect(result.newRecords).toBe(2); // 좌표 없는 1개 제외
      expect(result.status).toBe('success');

      // DB에 저장되었는지 확인
      const saved = await prisma.facility.findMany({
        where: { category: 'clothes', sourceId: { startsWith: 'CLOTHES-' } },
      });
      expect(saved.length).toBe(2);
    });

    it('기존 데이터가 있으면 업데이트해야 한다 (upsert)', async () => {
      const { fetchPublicApi } = await import('../../src/lib/publicApiClient.js');
      const { syncClothesData } = await import('../../src/scripts/syncClothes.js');

      // 기존 데이터 삽입
      await prisma.facility.create({
        data: {
          id: 'clothes-CLOTHES-001',
          category: 'clothes',
          name: '기존 수거함',
          address: '기존 주소',
          lat: 37.5,
          lng: 127.0,
          city: '서울',
          district: '강남구',
          sourceId: 'CLOTHES-001',
        },
      });

      vi.mocked(fetchPublicApi).mockResolvedValue(mockClothesApiResponse);

      const result = await syncClothesData();

      // 업데이트 확인
      expect(result.updatedRecords).toBeGreaterThanOrEqual(1);

      // DB 데이터 확인
      const updated = await prisma.facility.findUnique({
        where: { id: 'clothes-CLOTHES-001' },
      });
      expect(updated?.name).toBe('서울시 강남구 역삼동 123 앞'); // 새 데이터로 업데이트
    });

    it('SyncHistory에 동기화 기록을 남겨야 한다', async () => {
      const { fetchPublicApi } = await import('../../src/lib/publicApiClient.js');
      const { syncClothesData } = await import('../../src/scripts/syncClothes.js');

      vi.mocked(fetchPublicApi).mockResolvedValue(mockClothesApiResponse);

      await syncClothesData();

      // SyncHistory 확인
      const history = await prisma.syncHistory.findFirst({
        where: { category: 'clothes' },
        orderBy: { startedAt: 'desc' },
      });

      expect(history).not.toBeNull();
      expect(history?.status).toBe('success');
      expect(history?.totalRecords).toBe(3);
      expect(history?.completedAt).not.toBeNull();
    });

    it('API 호출 실패 시 에러를 기록하고 실패 상태를 반환해야 한다', async () => {
      const { fetchPublicApi } = await import('../../src/lib/publicApiClient.js');
      const { syncClothesData } = await import('../../src/scripts/syncClothes.js');

      // API 호출 실패 mock
      vi.mocked(fetchPublicApi).mockRejectedValue(new Error('API 호출 실패'));

      const result = await syncClothesData();

      expect(result.status).toBe('failed');
      expect(result.errorMessage).toContain('API 호출 실패');

      // SyncHistory에 실패 기록 확인
      const history = await prisma.syncHistory.findFirst({
        where: { category: 'clothes', status: 'failed' },
        orderBy: { startedAt: 'desc' },
      });

      expect(history).not.toBeNull();
      expect(history?.errorMessage).toContain('API 호출 실패');
    });
  });

  describe('페이지네이션 처리', () => {
    it('전체 데이터를 가져오기 위해 여러 페이지를 호출해야 한다', async () => {
      const { fetchPublicApi } = await import('../../src/lib/publicApiClient.js');
      const { syncClothesData } = await import('../../src/scripts/syncClothes.js');

      // 첫 페이지 응답
      const page1Response = {
        response: {
          header: { resultCode: '00', resultMsg: 'NORMAL SERVICE.' },
          body: {
            items: [mockClothesApiResponse.response.body.items[0]],
            numOfRows: 1,
            pageNo: 1,
            totalCount: 2,
          },
        },
      };

      // 두 번째 페이지 응답
      const page2Response = {
        response: {
          header: { resultCode: '00', resultMsg: 'NORMAL SERVICE.' },
          body: {
            items: [mockClothesApiResponse.response.body.items[1]],
            numOfRows: 1,
            pageNo: 2,
            totalCount: 2,
          },
        },
      };

      vi.mocked(fetchPublicApi)
        .mockResolvedValueOnce(page1Response)
        .mockResolvedValueOnce(page2Response);

      await syncClothesData({ numOfRows: 1 });

      // API가 2번 호출되었는지 확인
      expect(fetchPublicApi).toHaveBeenCalledTimes(2);
    });
  });
});
