// getNearbyByBjd 는 apt/villa/offitel 3종을 병렬로 조회해야 한다.
//
// 배경(2026-08 프로덕션 실측): sale·rent 두 경로 모두 `for (const key of NEARBY_PROPERTY_KEYS)`
// 안에서 순차 await 이라 벽시계가 max 가 아니라 합계였다.
//   sale  0.096 + 0.196 + 0.037 = 0.329s
//   rent  0.083 + 0.037 + 0.027 = 0.147s
// 이 0.3s 가 부동산 상세 SSR(p50 0.456s)의 남은 최대 비용이었다.
//
// 고정 불변식: 세 조회가 서로의 완료를 기다리지 않고 모두 착수돼야 한다.
// (개수만 세면 순차 구현도 통과하므로, 아무것도 resolve 하지 않은 시점에 3건이
//  모두 시작됐는지로 검사한다 — 순차라면 그 시점에 1건만 시작돼 있다.)

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockQueryRaw, mockFindMany } = vi.hoisted(() => ({
  mockQueryRaw: vi.fn(),
  mockFindMany: vi.fn(),
}));

vi.mock('../../src/lib/prisma.js', () => ({
  prisma: { $queryRaw: mockQueryRaw, realEstateBuildingSummary: { findMany: mockFindMany } },
  default: { $queryRaw: mockQueryRaw, realEstateBuildingSummary: { findMany: mockFindMany } },
}));

import { getNearbyByBjd } from '../../src/services/realEstateService.js';

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
}

/** 보류 중인 마이크로태스크를 소진시킨다. */
const flush = () => new Promise((r) => setImmediate(r));

beforeEach(() => {
  mockQueryRaw.mockReset();
  mockFindMany.mockReset();
});

describe('getNearbyByBjd 병렬 조회', () => {
  it('sale: 3종을 아무것도 resolve 되기 전에 모두 착수한다', async () => {
    const gates = [deferred<unknown[]>(), deferred<unknown[]>(), deferred<unknown[]>()];
    let started = 0;
    mockFindMany.mockImplementation(() => gates[started++].promise);

    const pending = getNearbyByBjd('11680', 'sale', { limitPerType: 4 });
    await flush();

    // 순차 구현이면 여기서 1 이다.
    expect(started).toBe(3);

    gates.forEach((g) => g.resolve([]));
    await expect(pending).resolves.toEqual({ apt: [], villa: [], offitel: [] });
  });

  it('rent(all→summary): 3종을 아무것도 resolve 되기 전에 모두 착수한다', async () => {
    // rentType 기본값 'all' 은 2026-08-03 부터 summary 경로다(findMany).
    const gates = [deferred<unknown[]>(), deferred<unknown[]>(), deferred<unknown[]>()];
    let started = 0;
    mockFindMany.mockImplementation(() => gates[started++].promise);

    const pending = getNearbyByBjd('11680', 'rent', { limitPerType: 4 });
    await flush();

    expect(started).toBe(3);
    expect(mockQueryRaw).not.toHaveBeenCalled();

    gates.forEach((g) => g.resolve([]));
    await expect(pending).resolves.toEqual({ apt: [], villa: [], offitel: [] });
  });

  it('rent(전세/월세→raw): 3종을 아무것도 resolve 되기 전에 모두 착수한다', async () => {
    const gates = [deferred<unknown[]>(), deferred<unknown[]>(), deferred<unknown[]>()];
    let started = 0;
    mockQueryRaw.mockImplementation(() => gates[started++].promise);

    const pending = getNearbyByBjd('11680', 'rent', { limitPerType: 4, rentType: 'jeonse' });
    await flush();

    expect(started).toBe(3);
    expect(mockFindMany).not.toHaveBeenCalled();

    gates.forEach((g) => g.resolve([]));
    await expect(pending).resolves.toEqual({ apt: [], villa: [], offitel: [] });
  });

  it('병렬로 바꿔도 결과가 키별로 올바르게 매핑된다 (순서 뒤바뀜 내성)', async () => {
    // 늦게 끝난 응답이 다른 키에 붙지 않아야 한다.
    const row = (name: string) => ({
      buildingName: name, bjdCode: '11680', city: '서울특별시', district: '강남구',
      dongName: '역삼동', buildYear: 2010, transactionCount: 1,
      latestPrice: 1000, latestDealYear: 2026, latestDealMonth: 6, lat: null, lng: null,
    });
    const gates = [deferred<unknown[]>(), deferred<unknown[]>(), deferred<unknown[]>()];
    let started = 0;
    mockFindMany.mockImplementation(() => gates[started++].promise);

    const pending = getNearbyByBjd('11680', 'sale', { limitPerType: 4 });
    await flush();

    // 착수 순서(apt, villa, offitel)와 반대로 완료시킨다
    gates[2].resolve([row('오피스텔')]);
    gates[1].resolve([row('빌라')]);
    gates[0].resolve([row('아파트')]);

    const result = await pending;
    expect(result.apt[0].buildingName).toBe('아파트');
    expect(result.villa[0].buildingName).toBe('빌라');
    expect(result.offitel[0].buildingName).toBe('오피스텔');
  });

  it('sale 조회에 type·bjdCode 필터와 정렬이 그대로 유지된다 (인덱스 전제)', async () => {
    // 추가한 @@index([type, bjdCode, latestDealYear, latestDealMonth, transactionCount]) 가
    // 실제로 쓰이려면 이 where/orderBy 형태가 유지돼야 한다.
    mockFindMany.mockResolvedValue([]);

    await getNearbyByBjd('11680', 'sale', { limitPerType: 4, dongName: '역삼동' });

    const call = mockFindMany.mock.calls[0][0];
    expect(call.where).toMatchObject({ type: 'apt-sale', bjdCode: '11680', dongName: '역삼동' });
    expect(call.orderBy).toEqual([
      { latestDealYear: 'desc' },
      { latestDealMonth: 'desc' },
      { transactionCount: 'desc' },
    ]);
    expect(call.take).toBe(4);
  });
});
