import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchAllTagoRows,
  fetchTagoCityRows,
  kstToday,
  tagoItems,
  toBusStopRawRow,
} from '../../src/services/busStopTagoClient.js';
import { normalizeBusStopRows } from '../../src/services/busStopDataSource.js';

function ok(body: unknown) {
  return new Response(JSON.stringify({ response: { header: { resultCode: '00', resultMsg: 'OK' }, body } }), {
    status: 200,
  });
}

const stop = (id: string, nm = `정류소${id}`) => ({ nodeid: id, nodenm: nm, gpslati: 35.95, gpslong: 126.95, nodeno: 1 });

describe('tagoItems', () => {
  it('0건(빈 문자열)·1건(객체)·여러 건(배열)을 모두 배열로 만든다', () => {
    expect(tagoItems({ items: '' })).toEqual([]);
    expect(tagoItems({ items: { item: stop('A') } })).toHaveLength(1);
    expect(tagoItems({ items: { item: [stop('A'), stop('B')] } })).toHaveLength(2);
    expect(tagoItems(undefined)).toEqual([]);
  });
});

describe('toBusStopRawRow', () => {
  it('파일 데이터와 같은 한글 키로 바꿔 정규화를 그대로 통과한다', () => {
    const raw = toBusStopRawRow(stop('ISB1', '유강리'), { code: '35030', name: '익산시' }, '2026-10-30');
    const { records, skipped } = normalizeBusStopRows([raw]);
    expect(skipped).toBe(0);
    expect(records[0]).toMatchObject({
      nodeId: 'ISB1',
      name: '유강리',
      lat: 35.95,
      lng: 126.95,
      mobileId: '1',
      cityCode: '35030',
      cityName: '익산시',
      collectedAt: '2026-10-30',
    });
  });

  it('파일 행이 앞에 오면 같은 정류장번호는 파일 행이 남는다', () => {
    const fileRow = { 정류장번호: 'ISB1', 정류장명: '파일이름', 위도: 35.9, 경도: 126.9, 정보수집일: '2025-10-31' };
    const tagoRow = toBusStopRawRow(stop('ISB1', 'TAGO이름'), { code: '35030', name: '익산시' }, '2026-10-30');
    const { records, skipped } = normalizeBusStopRows([fileRow, tagoRow]);
    expect(records).toHaveLength(1);
    expect(records[0].name).toBe('파일이름');
    expect(skipped).toBe(1);
  });
});

describe('kstToday', () => {
  it('UTC 자정 전이라도 KST 날짜를 쓴다', () => {
    expect(kstToday(new Date('2026-10-30T16:00:00Z'))).toBe('2026-10-31');
  });
});

describe('TAGO fetch', () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('OPENAPI_SERVICE_KEY', 'test-key');
    fetchMock.mockReset();
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('totalCount 에 닿을 때까지 페이지를 넘긴다', async () => {
    fetchMock
      .mockResolvedValueOnce(ok({ totalCount: 3, items: { item: [stop('A'), stop('B')] } }))
      .mockResolvedValueOnce(ok({ totalCount: 3, items: { item: stop('C') } }));
    const rows = await fetchTagoCityRows({ code: '35030', name: '익산시' }, '2026-10-30');
    expect(rows.map((r) => r['정류장번호'])).toEqual(['A', 'B', 'C']);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1][0])).toContain('pageNo=2');
  });

  it('도시 하나가 계속 실패하면 그 도시만 건너뛴다', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes('getCtyCodeList')) {
        return ok({ items: { item: [{ citycode: 1, cityname: '갑' }, { citycode: 2, cityname: '을' }] } });
      }
      if (url.includes('cityCode=1')) return new Response('err', { status: 500 });
      return ok({ totalCount: 1, items: { item: stop('B') } });
    });
    const res = await fetchAllTagoRows();
    expect(res.cities).toBe(2);
    expect(res.failedCities).toEqual(['갑']);
    expect(res.rows.map((r) => r['정류장번호'])).toEqual(['B']);
  }, 30_000);

  it('인증 실패(403)면 보충 없이 빈 결과로 끝낸다', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes('getCtyCodeList')) return ok({ items: { item: [{ citycode: 1, cityname: '갑' }] } });
      return new Response('forbidden', { status: 403 });
    });
    const res = await fetchAllTagoRows();
    expect(res.rows).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('도시 목록 조회가 실패해도 throw 하지 않는다', async () => {
    fetchMock.mockResolvedValue(new Response('forbidden', { status: 403 }));
    await expect(fetchAllTagoRows()).resolves.toEqual({ rows: [], cities: 0, failedCities: [] });
  });
});
