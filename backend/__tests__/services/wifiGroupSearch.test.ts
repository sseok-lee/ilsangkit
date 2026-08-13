import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockQueryRawUnsafe } = vi.hoisted(() => ({ mockQueryRawUnsafe: vi.fn() }));

vi.mock('../../src/lib/prisma.js', () => {
  const client = { $queryRawUnsafe: mockQueryRawUnsafe };
  return { default: client, prisma: client };
});

import { wifiGroupSearch } from '../../src/services/wifiService.js';

/** 호출 순서: [0]=count, [1]=rows */
function sqlOf(callIndex: number): string {
  return String(mockQueryRawUnsafe.mock.calls[callIndex][0]);
}
function paramsOf(callIndex: number): unknown[] {
  return mockQueryRawUnsafe.mock.calls[callIndex].slice(1);
}

const ROW = (over: Record<string, unknown> = {}) => ({
  groupKey: 'wifi-gaaa', name: '서울식물원',
  address: '서울특별시 강서구 마곡동로 161', roadAddress: null,
  lat: 37.5, lng: 127.0, city: '서울', district: '강서구',
  ssid: 'SEOUL', installLocation: '관광', accessPointCount: 154,
  ...over,
});

beforeEach(() => {
  mockQueryRawUnsafe.mockReset();
  mockQueryRawUnsafe.mockResolvedValueOnce([{ cnt: 1 }]).mockResolvedValueOnce([ROW()]);
});

describe('wifiGroupSearch', () => {
  it('장소 단위로 접어서 돌려준다 — id 는 그룹 id, AP 대수는 extras 에', async () => {
    const result = await wifiGroupSearch({ page: 1, limit: 20 });

    expect(result.total).toBe(1);
    expect(result.items).toEqual([
      expect.objectContaining({
        id: 'wifi-gaaa',
        category: 'wifi',
        name: '서울식물원',
        lat: 37.5,
        lng: 127.0,
        extras: expect.objectContaining({ accessPointCount: 154 }),
      }),
    ]);
  });

  it('groupId 가 NULL 인 행은 자기 id 로 떨어진다 — 백필 전 배포에서 전부 한 덩어리로 뭉치지 않게', async () => {
    await wifiGroupSearch({ page: 1, limit: 20 });
    // NULL 을 그대로 GROUP BY 하면 groupId 없는 행이 전부 한 그룹이 된다.
    expect(sqlOf(1)).toContain('COALESCE(groupId, id)');
    expect(sqlOf(0)).toContain('COALESCE(groupId, id)');
  });

  it('개수도 그룹 기준으로 센다', async () => {
    await wifiGroupSearch({ page: 1, limit: 20 });
    expect(sqlOf(0)).toMatch(/COUNT\(\*\)[\s\S]*FROM \(SELECT DISTINCT COALESCE\(groupId, id\)/);
  });

  it('시·도 변종을 양쪽 다 매칭한다 — DB 에 서울/서울특별시가 혼재', async () => {
    await wifiGroupSearch({ city: '서울', page: 1, limit: 20 });
    expect(sqlOf(1)).toContain('city IN');
    const params = paramsOf(1);
    expect(params).toContain('서울');
    expect(params).toContain('서울특별시');
  });

  it('구·군 필터는 파라미터로만 넣는다', async () => {
    await wifiGroupSearch({ city: '서울', district: '강서구', page: 1, limit: 20 });
    expect(sqlOf(1)).toContain('district = ?');
    expect(paramsOf(1)).toContain('강서구');
  });

  it('키워드는 값 보간 없이 파라미터로 넣는다', async () => {
    await wifiGroupSearch({ keyword: "a' OR 1=1 --", page: 1, limit: 20 });
    expect(sqlOf(1)).not.toContain('OR 1=1');
    expect(paramsOf(1).some((p) => String(p).includes('1=1'))).toBe(true);
  });

  it('좌표 검색이면 바운딩박스로 좁히고 거리순으로 돌려준다', async () => {
    mockQueryRawUnsafe.mockReset();
    mockQueryRawUnsafe
      .mockResolvedValueOnce([{ cnt: 2 }])
      .mockResolvedValueOnce([
        ROW({ groupKey: 'far', lat: 37.51, lng: 127.0 }),
        ROW({ groupKey: 'near', lat: 37.5001, lng: 127.0 }),
      ]);

    const result = await wifiGroupSearch({ lat: 37.5, lng: 127.0, radius: 2000, page: 1, limit: 20 });

    expect(sqlOf(1)).toContain('lat BETWEEN ? AND ?');
    expect(result.items.map((i) => i.id)).toEqual(['near', 'far']);
    expect(result.items[0].distance).toBeLessThan(result.items[1].distance!);
  });

  it('반경 밖은 버린다', async () => {
    mockQueryRawUnsafe.mockReset();
    mockQueryRawUnsafe
      .mockResolvedValueOnce([{ cnt: 1 }])
      .mockResolvedValueOnce([ROW({ groupKey: 'x', lat: 37.6, lng: 127.0 })]);

    const result = await wifiGroupSearch({ lat: 37.5, lng: 127.0, radius: 300, page: 1, limit: 20 });
    expect(result.items).toEqual([]);
  });

  it('페이지네이션은 limit/offset 파라미터로 넘긴다', async () => {
    await wifiGroupSearch({ page: 3, limit: 20 });
    const params = paramsOf(1);
    expect(params.slice(-2)).toEqual([20, 40]);
  });
});

describe('wifiGroupSearch — 좌표 검색은 이름순으로 미리 자르면 안 된다', () => {
  it('이름이 뒤로 밀리는 장소라도 가까우면 결과에 들어온다', async () => {
    mockQueryRawUnsafe.mockReset();
    mockQueryRawUnsafe
      .mockResolvedValueOnce([{ cnt: 3 }])
      .mockResolvedValueOnce([
        // 이름순(가나다)으로는 앞이지만 먼 곳들
        ROW({ groupKey: 'g1', name: '가양1동', lat: 37.5750, lng: 126.8336 }),
        ROW({ groupKey: 'g2', name: '나양1동', lat: 37.5760, lng: 126.8336 }),
        // 이름순으로는 뒤지만 바로 그 자리
        ROW({ groupKey: 'g3', name: '서울식물원', lat: 37.5695, lng: 126.8336 }),
      ]);

    const result = await wifiGroupSearch({ lat: 37.5695, lng: 126.8336, radius: 1000, page: 1, limit: 2 });

    // 가장 가까운 곳이 빠지면 상세의 "주변 시설"이 엉뚱해진다
    expect(result.items[0].name).toBe('서울식물원')
    expect(result.items[0].distance).toBeLessThan(50)
  });

  it('좌표 검색에서는 SQL 에 OFFSET 페이지네이션을 걸지 않는다', async () => {
    mockQueryRawUnsafe.mockReset();
    mockQueryRawUnsafe
      .mockResolvedValueOnce([{ cnt: 1 }])
      .mockResolvedValueOnce([ROW({ groupKey: 'g', lat: 37.5695, lng: 126.8336 })]);

    await wifiGroupSearch({ lat: 37.5695, lng: 126.8336, radius: 1000, page: 2, limit: 10 });

    // 이름순 LIMIT/OFFSET 으로 미리 자르면 거리 정렬 대상 자체가 어긋난다
    expect(sqlOf(1)).not.toContain('OFFSET');
  });
});
