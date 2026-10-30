import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockBusFindMany } = vi.hoisted(() => ({ mockBusFindMany: vi.fn() }));

vi.mock('../../src/lib/prisma.js', () => {
  const prismaClient = { busStop: { findMany: mockBusFindMany } };
  return { default: prismaClient, prisma: prismaClient };
});

import { findNearbyBusStops } from '../../src/services/busStopService';

const LAT = 37.4979;
const LNG = 127.0276;
// 위도 1도 ≈ 111.19km → 1m ≈ 0.000009도
const dLat = (m: number) => LAT + m * 0.000009;

function row(nodeId: string, name: string, meters: number, collectedAt: string | null = '2025-10-31') {
  return { nodeId, name, lat: dLat(meters), lng: LNG, collectedAt };
}

describe('findNearbyBusStops', () => {
  beforeEach(() => vi.clearAllMocks());

  it('같은 이름은 최소 거리 행으로 합치고 반경 밖은 제외한다', async () => {
    mockBusFindMany.mockResolvedValue([
      row('a2', '개포고등학교', 130),
      row('a1', '개포고등학교', 5),
      row('a3', '개포고등학교', 40),
      row('b1', '구룡마을입구', 400),
      row('c1', '먼정류장', 1500),
    ]);
    const r = await findNearbyBusStops(LAT, LNG, 1000);
    expect(r.count).toBe(2);
    expect(r.items.map((i) => i.name)).toEqual(['개포고등학교', '구룡마을입구']);
    expect(r.items[0].id).toBe('a1');
    expect(r.items[0].distance).toBeLessThan(10);
    expect(r.collectedAt).toBe('2025-10-31');
  });

  it('이름은 trim 후 묶는다', async () => {
    mockBusFindMany.mockResolvedValue([row('a', '역삼역 ', 10), row('b', '역삼역', 20)]);
    const r = await findNearbyBusStops(LAT, LNG, 1000);
    expect(r.count).toBe(1);
  });

  it('서로 다른 이름 7개 → items 5개, count 7', async () => {
    mockBusFindMany.mockResolvedValue(
      Array.from({ length: 7 }, (_, i) => row(`n${i}`, `정류장${i}`, 50 * (i + 1))),
    );
    const r = await findNearbyBusStops(LAT, LNG, 1000);
    expect(r.items).toHaveLength(5);
    expect(r.count).toBe(7);
    expect(r.items[0].distance).toBeLessThanOrEqual(r.items[4].distance);
  });

  it('후보가 없으면 빈 결과', async () => {
    mockBusFindMany.mockResolvedValue([]);
    expect(await findNearbyBusStops(LAT, LNG, 1000)).toEqual({ items: [], count: 0, collectedAt: null });
  });
});
