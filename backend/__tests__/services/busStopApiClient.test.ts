import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  parseBusStopVersions,
  fetchAllBusStopRows,
  fetchLatestBusStopVersion,
} from '../../src/services/busStopApiClient.js';

const oas = JSON.parse(
  readFileSync(new URL('../fixtures/busStop/oas.json', import.meta.url), 'utf-8'),
);
const VER = { path: '/15067528/v1/uddi:test', version: '20251031' };

function jsonRes(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

function pageBody(page: number, perPage: number, totalCount: number) {
  const start = (page - 1) * perPage;
  const count = Math.max(0, Math.min(perPage, totalCount - start));
  return {
    totalCount,
    currentCount: count,
    page,
    perPage,
    data: Array.from({ length: count }, (_, i) => ({ 정류장번호: `N${start + i}` })),
  };
}

describe('parseBusStopVersions', () => {
  it('paths에서 버전을 뽑아 오름차순으로 반환한다', () => {
    const vers = parseBusStopVersions(oas);
    expect(vers).toHaveLength(3);
    expect(vers[2]).toEqual({
      path: '/15067528/v1/uddi:f74b9799-9db1-4754-a5d0-b66e2ae705f3',
      version: '20251031',
    });
    expect(vers.map((v) => v.version)).toEqual([...vers.map((v) => v.version)].sort());
  });

  it('summary에 _YYYYMMDD가 없는 path는 제외한다', () => {
    const vers = parseBusStopVersions({
      paths: {
        '/a': { get: { summary: '국토교통부_전국 버스정류장 위치정보_20251031' } },
        '/b': { get: { summary: '날짜 없는 요약' } },
        '/c': {},
      },
    });
    expect(vers).toEqual([{ path: '/a', version: '20251031' }]);
  });
});

describe('fetchLatestBusStopVersion', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonRes(oas)));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('가장 최신 판을 반환한다', async () => {
    const v = await fetchLatestBusStopVersion();
    expect(v.version).toBe('20251031');
  });
});

describe('fetchAllBusStopRows', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    process.env.OPENAPI_SERVICE_KEY = 'test+key/==';
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('totalCount 2500, perPage 1000이면 3페이지를 받아 합친다', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      const page = Number(new URL(url).searchParams.get('page'));
      return jsonRes(pageBody(page, 1000, 2500));
    });
    const onPage = vi.fn();
    const rows = await fetchAllBusStopRows(VER, { perPage: 1000, onPage });
    expect(rows).toHaveLength(2500);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain('returnType=JSON');
    expect(url).toContain(`serviceKey=${encodeURIComponent('test+key/==')}`);
    expect(url).toContain('/api/15067528/v1/uddi:test');
    expect(onPage).toHaveBeenCalledTimes(3);
  });

  it('OPENAPI_SERVICE_KEY가 없으면 즉시 throw한다', async () => {
    delete process.env.OPENAPI_SERVICE_KEY;
    await expect(fetchAllBusStopRows(VER)).rejects.toThrow('OPENAPI_SERVICE_KEY');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('중간 페이지 data가 비어 합계 미달이면 reject한다', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      const page = Number(new URL(url).searchParams.get('page'));
      if (page === 2) return jsonRes({ totalCount: 2500, page: 2, perPage: 1000, data: [] });
      return jsonRes(pageBody(page, 1000, 2500));
    });
    await expect(fetchAllBusStopRows(VER, { perPage: 1000 })).rejects.toThrow();
  });

  it('페이지가 1회 실패한 뒤 성공하면 재시도해 정상 반환한다', async () => {
    let failed = false;
    fetchMock.mockImplementation(async (url: string) => {
      const page = Number(new URL(url).searchParams.get('page'));
      if (page === 2 && !failed) {
        failed = true;
        return new Response('upstream error', { status: 502 });
      }
      return jsonRes(pageBody(page, 1000, 2500));
    });
    const rows = await fetchAllBusStopRows(VER, { perPage: 1000 });
    expect(rows).toHaveLength(2500);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('받은 합계가 totalCount와 다르면 reject한다', async () => {
    // 마지막 페이지가 남은 건수보다 많이 와서 합계가 초과하는 경우
    fetchMock.mockImplementation(async (url: string) => {
      const page = Number(new URL(url).searchParams.get('page'));
      if (page === 3) {
        return jsonRes({ totalCount: 2500, page: 3, perPage: 1000, data: Array.from({ length: 600 }, () => ({ a: 1 })) });
      }
      return jsonRes(pageBody(page, 1000, 2500));
    });
    await expect(fetchAllBusStopRows(VER, { perPage: 1000 })).rejects.toThrow(/다릅니다.*totalCount|totalCount.*다릅니다/);
  });

  it('401 인증키 오류는 재시도 없이 reject한다', async () => {
    fetchMock.mockImplementation(async () =>
      jsonRes({ code: -4, msg: '등록되지 않은 인증키 입니다.' }, 401),
    );
    await expect(fetchAllBusStopRows(VER, { perPage: 1000 })).rejects.toThrow('인증키');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
