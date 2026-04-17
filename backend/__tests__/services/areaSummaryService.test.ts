import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockCount, mockFindFirst, mockFindMany, mockQueryRaw, mockFindFirstRealEstate, mockGroupBy } = vi.hoisted(() => ({
  mockCount: vi.fn(),
  mockFindFirst: vi.fn(),
  mockFindMany: vi.fn(),
  mockQueryRaw: vi.fn(),
  mockFindFirstRealEstate: vi.fn(),
  mockGroupBy: vi.fn(),
}));

vi.mock('../../src/lib/prisma.js', () => {
  const model = {
    count: mockCount,
    groupBy: mockGroupBy,
  };
  const realEstateModel = { findFirst: mockFindFirstRealEstate };
  const prismaClient = {
    toilet: model,
    wifi: model,
    clothes: model,
    parking: model,
    aed: model,
    library: model,
    hospital: model,
    pharmacy: model,
    park: model,
    school: model,
    market: model,
    childcare: model,
    evCharger: model,
    sports: model,
    wasteSchedule: model,
    region: { findFirst: mockFindFirst, findMany: mockFindMany },
    aptSaleTransaction: realEstateModel,
    aptRentTransaction: realEstateModel,
    villaSaleTransaction: realEstateModel,
    villaRentTransaction: realEstateModel,
    offitelSaleTransaction: realEstateModel,
    offitelRentTransaction: realEstateModel,
    $queryRaw: mockQueryRaw,
  };
  return { default: prismaClient, prisma: prismaClient };
});

import { getAreaSummary, clearAreaSummaryCache } from '../../src/services/areaSummaryService.js';

beforeEach(() => {
  vi.clearAllMocks();
  clearAreaSummaryCache();

  // 기본 mock 응답
  mockFindFirst.mockResolvedValue({ district: '강남구', lat: 37.5172, lng: 127.0473 });
  mockFindMany.mockResolvedValue([]);
  mockCount.mockResolvedValue(0);
  mockGroupBy.mockResolvedValue([]);
  mockQueryRaw.mockResolvedValue([]);
  mockFindFirstRealEstate.mockResolvedValue(null);
});

describe('getAreaSummary', () => {
  describe('입력 검증', () => {
    it('존재하지 않는 citySlug는 null 반환', async () => {
      const result = await getAreaSummary('invalidcity', 'gangnam', 'toilet');
      expect(result).toBeNull();
    });

    it('존재하지 않는 districtSlug는 null 반환', async () => {
      mockFindFirst.mockResolvedValueOnce(null);
      const result = await getAreaSummary('seoul', 'nonexistent', 'toilet');
      expect(result).toBeNull();
    });
  });

  describe('count & highlights (toilet)', () => {
    beforeEach(() => {
      mockFindFirst.mockResolvedValue({ district: '강남구', lat: 37.5172, lng: 127.0473 });
    });

    it('해당 구의 총 시설 수를 반환한다', async () => {
      // 첫 번째 count는 base count (total)
      mockCount.mockResolvedValueOnce(48);
      // 나머지 count 호출은 highlights + countDiff용
      mockCount.mockResolvedValue(0);

      const result = await getAreaSummary('seoul', 'gangnam', 'toilet');
      expect(result).not.toBeNull();
      expect(result!.count).toBe(48);
    });

    it('toilet 카테고리 highlights 3개 반환 (disabled/diaper/open24h)', async () => {
      const callCounts: number[] = [48, 31, 12, 23, 0]; // total, disabled, diaper, open24h, countDiff
      let idx = 0;
      mockCount.mockImplementation(() => Promise.resolve(callCounts[idx++] ?? 0));

      const result = await getAreaSummary('seoul', 'gangnam', 'toilet');
      expect(result!.highlights).toHaveLength(3);
      const keys = result!.highlights.map(h => h.key);
      expect(keys).toContain('disabled');
      expect(keys).toContain('diaper');
      expect(keys).toContain('open24h');
    });

    it('highlights의 percent는 count 기준으로 반올림된 정수', async () => {
      const callCounts = [48, 31, 12, 23, 0];
      let idx = 0;
      mockCount.mockImplementation(() => Promise.resolve(callCounts[idx++] ?? 0));

      const result = await getAreaSummary('seoul', 'gangnam', 'toilet');
      const disabled = result!.highlights.find(h => h.key === 'disabled')!;
      expect(disabled.count).toBe(31);
      expect(disabled.percent).toBe(Math.round((31 / 48) * 100));
    });

    it('count가 0이면 highlights percent는 0', async () => {
      mockCount.mockResolvedValue(0);
      const result = await getAreaSummary('seoul', 'gangnam', 'toilet');
      expect(result!.count).toBe(0);
      for (const h of result!.highlights) {
        expect(h.percent).toBe(0);
      }
    });
  });

  describe('countDiff (최근 30일 신규)', () => {
    it('최근 30일 내 createdAt 필터 카운트를 countDiff로 반환', async () => {
      const callCounts = [100, 0, 0, 0, 7]; // total, hl1, hl2, hl3, countDiff
      let idx = 0;
      mockCount.mockImplementation(() => Promise.resolve(callCounts[idx++] ?? 0));

      const result = await getAreaSummary('seoul', 'gangnam', 'toilet');
      expect(result!.countDiff).toBe(7);
    });
  });

  describe('nearbyDistricts', () => {
    it('지리적으로 가까운 구 상위 5개를 반환 (거리 기반)', async () => {
      // 강남구 중심: 37.5172, 127.0473
      // 아래 mock은 서울 자치구의 실제 근사 좌표
      mockGroupBy.mockResolvedValueOnce([
        { district: '서초구', _count: 52 },
        { district: '송파구', _count: 61 },
        { district: '강동구', _count: 38 },
        { district: '용산구', _count: 29 },
        { district: '성동구', _count: 41 },
        { district: '광진구', _count: 33 },
        { district: '종로구', _count: 20 }, // 멀어서 5개 밖으로 밀려야 함
      ]);
      mockFindMany.mockResolvedValueOnce([
        { district: '서초구', slug: 'seocho', lat: 37.4837, lng: 127.0324 }, // ~4km
        { district: '송파구', slug: 'songpa', lat: 37.5145, lng: 127.1059 }, // ~5km
        { district: '성동구', slug: 'seongdong', lat: 37.5634, lng: 127.0371 }, // ~5km
        { district: '광진구', slug: 'gwangjin', lat: 37.5384, lng: 127.0823 }, // ~4km
        { district: '강동구', slug: 'gangdong', lat: 37.5301, lng: 127.1238 }, // ~7km
        { district: '용산구', slug: 'yongsan', lat: 37.5326, lng: 126.9907 }, // ~6km
        { district: '종로구', slug: 'jongno', lat: 37.5729, lng: 126.9794 }, // ~10km
      ]);

      const result = await getAreaSummary('seoul', 'gangnam', 'toilet');
      expect(result!.nearbyDistricts).toBeDefined();
      expect(result!.nearbyDistricts.length).toBeLessThanOrEqual(5);
      // 현재 구는 제외
      expect(result!.nearbyDistricts.every(d => d.district !== '강남구')).toBe(true);
      // 가장 먼 종로구는 top 5 밖
      expect(result!.nearbyDistricts.map(d => d.district)).not.toContain('종로구');
      // 가장 가까운 서초구는 포함
      expect(result!.nearbyDistricts.map(d => d.district)).toContain('서초구');
    });

    it('해당 카테고리 시설이 0건인 구도 포함 (지리적 인접성 우선, 0곳 표시)', async () => {
      mockGroupBy.mockResolvedValueOnce([
        { district: '서초구', _count: 52 },
        // 송파구 데이터 누락 → count=0이지만 지리적으로 가까우므로 포함
      ]);
      mockFindMany.mockResolvedValueOnce([
        { district: '서초구', slug: 'seocho', lat: 37.4837, lng: 127.0324 },
        { district: '송파구', slug: 'songpa', lat: 37.5145, lng: 127.1059 },
      ]);

      const result = await getAreaSummary('seoul', 'gangnam', 'toilet');
      const map = new Map(result!.nearbyDistricts.map(d => [d.district, d.count]));
      expect(map.get('서초구')).toBe(52);
      expect(map.get('송파구')).toBe(0);
    });
  });

  describe('기타 카테고리', () => {
    it('parking 카테고리는 hasDisabledParking highlight 포함', async () => {
      mockCount.mockResolvedValue(10);
      const result = await getAreaSummary('seoul', 'gangnam', 'parking');
      const keys = result!.highlights.map(h => h.key);
      expect(keys).toContain('disabled');
    });

    it('wifi처럼 highlight 정의가 없는 카테고리는 빈 배열', async () => {
      mockCount.mockResolvedValue(5);
      const result = await getAreaSummary('seoul', 'gangnam', 'wifi');
      expect(result!.highlights).toEqual([]);
    });
  });
});
