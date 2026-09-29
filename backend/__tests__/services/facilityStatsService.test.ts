import { beforeEach, describe, expect, it, vi } from 'vitest';

const { genericGroupBy, genericCount, wasteGroupBy, wasteCount, regionFindFirst, queryRaw } = vi.hoisted(() => ({
  genericGroupBy: vi.fn(),
  genericCount: vi.fn(),
  wasteGroupBy: vi.fn(),
  wasteCount: vi.fn(),
  regionFindFirst: vi.fn(),
  queryRaw: vi.fn(),
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
