// @TASK Region 동기화 테스트
// @SPEC docs/planning/04-database-design.md#region-table

import { describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest';
import prisma from '../../src/lib/prisma.js';

describe('Region 동기화 서비스', () => {
  afterEach(async () => {
    // 테스트 데이터 정리 (테스트용으로 추가된 데이터만)
    await prisma.region.deleteMany({
      where: {
        bjdCode: { startsWith: 'TEST' },
      },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('normalizeKoreanToSlug', () => {
    it('한글 구/군 이름을 로마자 slug로 변환해야 한다', async () => {
      const { normalizeKoreanToSlug } = await import('../../src/scripts/syncRegion.js');

      const testCases = [
        { input: '강남구', expected: 'gangnam-gu' },
        { input: '종로구', expected: 'jongno-gu' },
        { input: '중구', expected: 'jung-gu' },
        { input: '수원시', expected: 'suwon-si' },
        { input: '성남시 분당구', expected: 'seongnam-si-bundang-gu' },
        { input: '제주시', expected: 'jeju-si' },
        { input: '서귀포시', expected: 'seogwipo-si' },
      ];

      for (const tc of testCases) {
        const result = normalizeKoreanToSlug(tc.input);
        expect(result).toBe(tc.expected);
      }
    });
  });

  describe('normalizeCityName', () => {
    it('시/도 이름을 짧은 형태로 변환해야 한다', async () => {
      const { normalizeCityName } = await import('../../src/scripts/syncRegion.js');

      const testCases = [
        { input: '서울특별시', expected: '서울' },
        { input: '부산광역시', expected: '부산' },
        { input: '경기도', expected: '경기' },
        { input: '충청북도', expected: '충북' },
        { input: '전라남도', expected: '전남' },
        { input: '제주특별자치도', expected: '제주' },
        { input: '세종특별자치시', expected: '세종' },
        { input: '강원특별자치도', expected: '강원' },
        { input: '전북특별자치도', expected: '전북' },
      ];

      for (const tc of testCases) {
        const result = normalizeCityName(tc.input);
        expect(result).toBe(tc.expected);
      }
    });
  });

  describe('parseRegionCsv', () => {
    it('CSV 데이터에서 시/군/구 레벨(5자리)만 추출해야 한다', async () => {
      const { parseRegionCsv } = await import('../../src/scripts/syncRegion.js');

      // 법정동코드 CSV 형식 (행정안전부)
      const mockCsvContent = `법정동코드,법정동명,폐지여부
1100000000,서울특별시,존재
1101000000,서울특별시 종로구,존재
1101010100,서울특별시 종로구 청운동,존재
1102000000,서울특별시 중구,존재
2600000000,부산광역시,존재
2611000000,부산광역시 중구,존재
2611010100,부산광역시 중구 중앙동1가,존재
9999999999,폐지된지역,폐지`;

      const result = parseRegionCsv(mockCsvContent);

      // 시/군/구 레벨만 추출 (폐지된 것 제외)
      expect(result.length).toBe(3); // 종로구, 중구(서울), 중구(부산)
      expect(result.map((r) => r.district)).toContain('종로구');
      expect(result.map((r) => r.district)).toContain('중구');

      // 5자리 코드 확인
      expect(result[0].bjdCode).toHaveLength(5);
    });

    it('폐지된 지역은 제외해야 한다', async () => {
      const { parseRegionCsv } = await import('../../src/scripts/syncRegion.js');

      const mockCsvContent = `법정동코드,법정동명,폐지여부
1101000000,서울특별시 종로구,존재
1199000000,서울특별시 폐지구,폐지`;

      const result = parseRegionCsv(mockCsvContent);

      expect(result.length).toBe(1);
      expect(result[0].district).toBe('종로구');
    });
  });

  describe('syncRegionData', () => {
    it('Region 데이터를 upsert로 저장해야 한다', async () => {
      const { syncRegionData } = await import('../../src/scripts/syncRegion.js');

      // 테스트용 데이터로 동기화 (실제 CSV 대신 테스트 데이터 사용)
      const result = await syncRegionData({
        testMode: true,
        testData: [
          {
            bjdCode: 'TEST1',
            city: '테스트',
            district: '테스트구',
            lat: 37.5,
            lng: 127.0,
          },
        ],
      });

      expect(result.status).toBe('success');
      expect(result.totalRecords).toBeGreaterThanOrEqual(1);

      // DB 확인
      const saved = await prisma.region.findFirst({
        where: { bjdCode: 'TEST1' },
      });
      expect(saved).not.toBeNull();
      expect(saved?.district).toBe('테스트구');
    });

    it('기존 데이터가 있으면 업데이트해야 한다', async () => {
      // 기존 데이터 삽입
      await prisma.region.create({
        data: {
          bjdCode: 'TEST2',
          city: '테스트',
          district: '기존구',
          slug: 'test-gu',
          lat: 37.5,
          lng: 127.0,
        },
      });

      const { syncRegionData } = await import('../../src/scripts/syncRegion.js');

      const result = await syncRegionData({
        testMode: true,
        testData: [
          {
            bjdCode: 'TEST2',
            city: '테스트',
            district: '업데이트구',
            lat: 37.55,
            lng: 127.05,
          },
        ],
      });

      expect(result.updatedRecords).toBeGreaterThanOrEqual(1);

      // 업데이트 확인
      const updated = await prisma.region.findFirst({
        where: { bjdCode: 'TEST2' },
      });
      expect(updated?.district).toBe('업데이트구');
    });
  });

  describe('getRegionCoordinates', () => {
    it('시/군/구명으로 중심 좌표를 반환해야 한다', async () => {
      const { getRegionCoordinates } = await import('../../src/scripts/syncRegion.js');

      // 서울 강남구 좌표 확인
      const coords = getRegionCoordinates('서울', '강남구');

      expect(coords).not.toBeNull();
      expect(coords?.lat).toBeGreaterThan(37);
      expect(coords?.lat).toBeLessThan(38);
      expect(coords?.lng).toBeGreaterThan(126);
      expect(coords?.lng).toBeLessThan(128);
    });

    it('존재하지 않는 지역은 기본 좌표를 반환해야 한다', async () => {
      const { getRegionCoordinates } = await import('../../src/scripts/syncRegion.js');

      const coords = getRegionCoordinates('존재하지않는시', '없는구');

      // 기본 좌표 (서울시청) 반환
      expect(coords).not.toBeNull();
      expect(coords?.lat).toBeCloseTo(37.5665, 2);
    });
  });
});
