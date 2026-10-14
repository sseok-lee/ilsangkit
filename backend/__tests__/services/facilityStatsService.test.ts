import { beforeEach, describe, expect, it, vi } from 'vitest';

const { genericGroupBy, genericCount, wasteGroupBy, wasteCount, regionFindFirst, queryRaw, wasteDisplay } = vi.hoisted(() => ({
  genericGroupBy: vi.fn(),
  genericCount: vi.fn(),
  wasteGroupBy: vi.fn(),
  wasteCount: vi.fn(),
  regionFindFirst: vi.fn(),
  queryRaw: vi.fn(),
  wasteDisplay: vi.fn(),
}));

vi.mock('../../src/services/wasteAreaService.js', () => ({
  getWasteDistrictDisplay: wasteDisplay,
}));

vi.mock('../../src/services/wifiService.js', () => ({
  countWifiGroups: vi.fn().mockResolvedValue(0),
  countWifiGroupsByDistrict: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../src/lib/prisma.js', () => {
  const model = { groupBy: genericGroupBy, count: genericCount };
  const prisma = {
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
    wasteSchedule: { groupBy: wasteGroupBy, count: wasteCount },
    region: { findFirst: regionFindFirst },
    $queryRaw: queryRaw,
  };
  return { default: prisma, prisma };
});

import { ServiceUnavailableError } from '../../src/lib/errors.js';
import {
  getDistrictStatsByCity,
  getStatsByCity,
  getStatsByDistrict,
  statsByCityCache,
  statsByDistrictCache,
} from '../../src/services/facilityStatsService.js';

beforeEach(() => {
  vi.clearAllMocks();
  statsByCityCache.clear();
  statsByDistrictCache.clear();
  genericGroupBy.mockResolvedValue([]);
  genericCount.mockResolvedValue(0);
  wasteGroupBy.mockResolvedValue([]);
  wasteCount.mockResolvedValue(0);
  wasteDisplay.mockResolvedValue(null);
  regionFindFirst.mockResolvedValue({ district: '강남구' });
});

describe('facilityStatsService trash visibility', () => {
  it('excludes staged trash rows from city public stats', async () => {
    await getStatsByCity('seoul');

    expect(wasteGroupBy).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ stagedMarker: null }),
    }));
  });

  it('excludes staged trash rows from district map public stats', async () => {
    await getDistrictStatsByCity('seoul');

    expect(wasteGroupBy).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ stagedMarker: null }),
    }));
  });

  it('excludes staged trash rows from district public stats', async () => {
    await getStatsByDistrict('seoul', 'gangnam');

    expect(wasteCount).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ stagedMarker: null }),
    }));
  });
});

describe('허브 통계 — 쓰레기 표시 건수와 합계 제외', () => {
  const nonTrashSum = (c: Record<string, number>) =>
    Object.entries(c).filter(([k]) => k !== 'trash').reduce((s, [, n]) => s + n, 0);

  it('구·군: areas 모드면 trash=동 수, wasteMode=areas, total·topCategories 에 trash 미포함', async () => {
    genericCount.mockResolvedValue(5);
    wasteDisplay.mockResolvedValue({ mode: 'areas', count: 22 });
    const stats = await getStatsByDistrict('seoul', 'gangnam');
    expect(stats?.categories.trash).toBe(22);
    expect(stats?.wasteMode).toBe('areas');
    expect(stats?.total).toBe(nonTrashSum(stats!.categories));
    expect(stats?.topCategories).not.toContain('trash');
    expect(wasteCount).not.toHaveBeenCalled();
  });

  it('구·군: source 모드면 trash=원본 수, wasteMode=source', async () => {
    wasteDisplay.mockResolvedValue({ mode: 'source', count: 339 });
    const stats = await getStatsByDistrict('seoul', 'gangnam');
    expect(stats?.categories.trash).toBe(339);
    expect(stats?.wasteMode).toBe('source');
  });

  it('구·군: 표시 건수가 null 이면 레거시 count 로 폴백하고 wasteMode=legacy', async () => {
    wasteDisplay.mockResolvedValue(null);
    wasteCount.mockResolvedValue(7);
    const stats = await getStatsByDistrict('seoul', 'gangnam');
    expect(stats?.categories.trash).toBe(7);
    expect(stats?.wasteMode).toBe('legacy');
    expect(stats?.topCategories).not.toContain('trash');
  });

  it('구·군: ServiceUnavailableError 면 레거시 count 로 폴백하고 wasteMode=legacy', async () => {
    wasteDisplay.mockRejectedValue(new ServiceUnavailableError('x', 'WASTE_AREA_UNAVAILABLE'));
    wasteCount.mockResolvedValue(7);
    const stats = await getStatsByDistrict('seoul', 'gangnam');
    expect(stats?.categories.trash).toBe(7);
    expect(stats?.wasteMode).toBe('legacy');
  });

  it('구·군: trash 가 가장 많아도 topCategories 에 들지 않는다', async () => {
    genericCount.mockResolvedValue(1);
    wasteDisplay.mockResolvedValue({ mode: 'source', count: 9999 });
    const stats = await getStatsByDistrict('seoul', 'gangnam');
    expect(stats?.topCategories).not.toContain('trash');
    expect(stats?.total).toBeLessThan(9999);
  });

  it('시·도: total·topCategories·구·군별 total 에 trash 미포함, categories.trash 는 유지', async () => {
    wasteGroupBy.mockResolvedValue([{ district: '강남구', _count: 500 }]);
    genericGroupBy.mockResolvedValue([{ district: '강남구', _count: 3 }]);
    const city = await getStatsByCity('seoul');
    expect(city?.categories.trash).toBe(500);
    expect(city?.topCategories).not.toContain('trash');
    expect(city?.total).toBe(nonTrashSum(city!.categories));
    expect(city?.districts.find((d) => d.district === '강남구')?.total).toBe(nonTrashSum(city!.categories));

    // districtStatsByCityCache 는 비공개라 앞선 테스트가 채운 'seoul' 과 겹치지 않게 다른 시를 쓴다.
    const byDistrict = await getDistrictStatsByCity('busan');
    const gangnam = byDistrict.get('강남구');
    expect(gangnam?.categories.trash).toBe(500);
    expect(gangnam?.topCategories).not.toContain('trash');
    expect(gangnam?.total).toBe(nonTrashSum(gangnam!.categories));
  });
});
