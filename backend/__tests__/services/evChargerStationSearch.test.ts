import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockQueryRawUnsafe } = vi.hoisted(() => ({
  mockQueryRawUnsafe: vi.fn(),
}));

vi.mock('../../src/lib/prisma.js', () => {
  const prisma = {
    $queryRawUnsafe: mockQueryRawUnsafe,
    evCharger: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  };
  return { prisma, default: prisma };
});

vi.mock('../../src/services/viewCountService.js', () => ({
  bufferViewCount: vi.fn(),
}));

vi.mock('../../src/services/search/fulltextKeyword.js', async (orig) => {
  const actual = await orig() as typeof import('../../src/services/search/fulltextKeyword.js');
  return {
    ...actual,
    canUseFulltext: () => false,
  };
});

import { evChargerStationSearch } from '../../src/services/evChargerService.js';

beforeEach(() => {
  mockQueryRawUnsafe.mockReset();
});

describe('evChargerStationSearch', () => {
  it('escapes literal SQL LIKE wildcards in raw adapter keyword fallback', async () => {
    mockQueryRawUnsafe
      .mockResolvedValueOnce([{ cnt: 0n }])
      .mockResolvedValueOnce([]);

    await evChargerStationSearch({ keyword: '%_', city: '서울', district: '강남구', page: 1, limit: 20 });

    const [countSql, ...countValues] = mockQueryRawUnsafe.mock.calls[0];
    expect(countSql).toContain("LIKE ? ESCAPE '\\\\'");
    expect(countValues).toEqual(expect.arrayContaining(['%\\%\\_%']));
  });

  it('uses statId as a deterministic tie breaker for duplicate station names', async () => {
    mockQueryRawUnsafe
      .mockResolvedValueOnce([{ cnt: 2n }])
      .mockResolvedValueOnce([
        { statId: 'A001', name: '같은충전소', address: null, roadAddress: null, lat: 37, lng: 127, city: '서울', district: '강남구', totalChargers: 4, rapidCount: 2, slowCount: 2 },
        { statId: 'B001', name: '같은충전소', address: null, roadAddress: null, lat: 37.1, lng: 127.1, city: '서울', district: '강남구', totalChargers: 4, rapidCount: 1, slowCount: 3 },
      ]);

    const result = await evChargerStationSearch({ city: '서울', district: '강남구', page: 1, limit: 2 });

    const listSql = mockQueryRawUnsafe.mock.calls[1][0] as string;
    expect(listSql).toContain('ORDER BY name ASC, statId ASC');
    expect(result.items.map((item) => item.id)).toEqual(['A001', 'B001']);
  });
  it('skips the unused station COUNT for radius searches', async () => {
    mockQueryRawUnsafe.mockResolvedValueOnce([
      { statId: 'NEAR', name: '가까운충전소', address: null, roadAddress: null, lat: 37.4979, lng: 127.0276, city: '서울', district: '강남구', totalChargers: 2, rapidCount: 1, slowCount: 1 },
      { statId: 'FAR', name: '먼충전소', address: null, roadAddress: null, lat: 37.5069, lng: 127.0389, city: '서울', district: '강남구', totalChargers: 1, rapidCount: 0, slowCount: 1 },
    ]);

    const result = await evChargerStationSearch({ lat: 37.4979, lng: 127.0276, radius: 500, page: 1, limit: 10 });

    expect(mockQueryRawUnsafe).toHaveBeenCalledTimes(1);
    expect(mockQueryRawUnsafe.mock.calls[0][0]).not.toContain('COUNT(*) as cnt');
    expect(result.items.map((item) => item.id)).toEqual(['NEAR']);
    expect(result.total).toBe(1);
    expect(result.totalPages).toBe(1);
  });

  it('keeps the station COUNT for map bounds searches', async () => {
    mockQueryRawUnsafe.mockResolvedValueOnce([{ cnt: 7n }]).mockResolvedValueOnce([]);

    const result = await evChargerStationSearch({ swLat: 37.4, swLng: 126.9, neLat: 37.6, neLng: 127.1, page: 1, limit: 10 });

    expect(mockQueryRawUnsafe.mock.calls[0][0]).toContain('COUNT(*) as cnt');
    expect(result.total).toBe(7);
  });

  it('picks the national page from a narrow (statId, name) subquery before aggregating', async () => {
    mockQueryRawUnsafe.mockResolvedValueOnce([{ cnt: 106622n }]).mockResolvedValueOnce([]);

    await evChargerStationSearch({ page: 3, limit: 20 });

    const [listSql, ...listValues] = mockQueryRawUnsafe.mock.calls[1] as [string, ...unknown[]];
    const sql = listSql.replace(/\s+/g, ' ');
    expect(sql).toContain(
      'statId IN (SELECT statId FROM (SELECT statId, MIN(name) AS pageName FROM EvCharger WHERE statId IS NOT NULL GROUP BY statId ORDER BY pageName ASC, statId ASC LIMIT ? OFFSET ?) page)',
    );
    expect(sql).toMatch(/GROUP BY statId ORDER BY name ASC, statId ASC$/);
    expect(listValues).toEqual([20, 40]);
  });

  it('keeps the single-pass list query when filters narrow the stations', async () => {
    mockQueryRawUnsafe.mockResolvedValueOnce([{ cnt: 0n }]).mockResolvedValueOnce([]);

    await evChargerStationSearch({ city: '서울', page: 2, limit: 20 });

    const listSql = (mockQueryRawUnsafe.mock.calls[1][0] as string).replace(/\s+/g, ' ');
    expect(listSql).not.toContain('statId IN (SELECT');
    expect(listSql).toContain('ORDER BY name ASC, statId ASC LIMIT ? OFFSET ?');
  });
});
