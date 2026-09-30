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
});
