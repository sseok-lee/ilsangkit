import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockQueryRaw } = vi.hoisted(() => ({
  mockQueryRaw: vi.fn(),
}));

vi.mock('../../src/lib/prisma.js', () => ({
  prisma: { $queryRaw: mockQueryRaw },
  default: { $queryRaw: mockQueryRaw },
}));

import { getPricedSliceHotspots } from '../../src/services/realEstateHotspotService.js';

beforeEach(() => {
  mockQueryRaw.mockReset();
});

describe('getPricedSliceHotspots (sale/jeonse 슬라이스)', () => {
  it('rising은 changePct DESC, falling은 ASC, active는 volumeChangePct DESC 정렬', async () => {
    mockQueryRaw.mockResolvedValue([
      { citySlug: 'seoul', city: '서울특별시', districtSlug: 'gangnam-gu', district: '강남구',
        pricePerPyeong: 8000, txnCount: 100n, changePct: 5, volumeChangePct: 30 },
      { citySlug: 'seoul', city: '서울특별시', districtSlug: 'mapo-gu', district: '마포구',
        pricePerPyeong: 5000, txnCount: 60n, changePct: -3, volumeChangePct: 10 },
      { citySlug: 'busan', city: '부산광역시', districtSlug: 'haeundae-gu', district: '해운대구',
        pricePerPyeong: 4000, txnCount: 80n, changePct: 2, volumeChangePct: 50 },
    ]);

    const bundle = await getPricedSliceHotspots('AptSaleTransaction', { sampleThreshold: 30 });

    expect(bundle.rising.map((r) => r.district)).toEqual(['강남구', '해운대구']);
    expect(bundle.falling.map((r) => r.district)).toEqual(['마포구']);
    expect(bundle.active.map((r) => r.district)).toEqual(['해운대구', '강남구', '마포구']);
  });

  it('changePct가 null인 행은 rising/falling에서 제외, active에는 영향 없음', async () => {
    mockQueryRaw.mockResolvedValue([
      { citySlug: 'seoul', city: '서울특별시', districtSlug: 'gangnam-gu', district: '강남구',
        pricePerPyeong: 8000, txnCount: 100n, changePct: null, volumeChangePct: 30 },
    ]);

    const bundle = await getPricedSliceHotspots('AptSaleTransaction', { sampleThreshold: 30 });

    expect(bundle.rising).toEqual([]);
    expect(bundle.falling).toEqual([]);
    expect(bundle.active).toHaveLength(1);
  });

  it('각 시그널 최대 5개로 자름', async () => {
    const rows = Array.from({ length: 10 }, (_, i) => ({
      citySlug: `city-${i}`,
      city: `시-${i}`,
      districtSlug: `dist-${i}`,
      district: `구-${i}`,
      pricePerPyeong: 5000 + i,
      txnCount: 100n,
      changePct: i + 1,
      volumeChangePct: i + 1,
    }));
    mockQueryRaw.mockResolvedValue(rows);

    const bundle = await getPricedSliceHotspots('AptSaleTransaction', { sampleThreshold: 30 });

    expect(bundle.rising).toHaveLength(5);
    expect(bundle.active).toHaveLength(5);
  });

  it('BigInt txnCount는 number로 변환됨', async () => {
    mockQueryRaw.mockResolvedValue([
      { citySlug: 'seoul', city: '서울특별시', districtSlug: 'gangnam-gu', district: '강남구',
        pricePerPyeong: 8000, txnCount: 12345n, changePct: 5, volumeChangePct: 30 },
    ]);
    const bundle = await getPricedSliceHotspots('AptSaleTransaction', { sampleThreshold: 30 });
    expect(bundle.rising[0].txnCount).toBe(12345);
    expect(typeof bundle.rising[0].txnCount).toBe('number');
  });
});
