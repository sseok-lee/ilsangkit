import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  transformEvChargerItem,
  fetchEvChargerPage,
  syncEvChargers,
  type EvChargerAPIItem,
} from '../../src/services/evChargerSyncService.js';
import { prisma } from '../../src/lib/prisma.js';

// syncEvChargers 페이지별 증분 upsert 검증용 — baseSyncService.batchUpsertRaw가 내부적으로
// 사용하는 prisma raw 호출($transaction/$executeRawUnsafe/$queryRawUnsafe)을 모킹해
// "페이지마다 upsert 호출" vs "끝에 한 번만 upsert"를 구분한다.
vi.mock('../../src/lib/prisma.js', () => ({
  prisma: {
    syncHistory: {
      create: vi.fn(),
      update: vi.fn(),
    },
    $queryRawUnsafe: vi.fn(),
    $transaction: vi.fn(),
  },
}));

describe('transformEvChargerItem', () => {
  const baseItem: EvChargerAPIItem = {
    statNm: '서울시청 충전소',
    statId: 'ME12345',
    chgerId: '01',
    chgerType: '7',
    addr: '서울특별시 중구 태평로1가 31',
    addrDetail: '지하주차장',
    location: 'B1 지하주차장',
    useTime: '평일 09:00~18:00',
    lat: '37.5665',
    lng: '126.9780',
    busiId: 'KT',
    bnm: 'KT',
    busiNm: 'KT EV 충전소',
    busiCall: '1588-0000',
    stat: '2',
    statUpdDt: '20240101120000',
    lastTsdt: '20240101110000',
    lastTedt: '20240101115959',
    nowTsdt: null,
    powerType: '1',
    output: '50',
    method: 'DC콤보',
    zcode: '11',
    zscode: '11140',
    kind: '11',
    kindDetail: '1101',
    parkingFree: 'Y',
    note: '테스트 안내',
    limitYn: 'N',
    limitDetail: null,
    delYn: 'N',
    delDetail: null,
    trafficYn: 'Y',
    year: '2022',
    floorNum: '1',
    floorType: 'B',
    maker: '현대일렉트릭',
  };

  it('should map fields correctly', () => {
    const result = transformEvChargerItem(baseItem);

    expect(result).not.toBeNull();
    expect(result!.name).toBe('서울시청 충전소');
    expect(result!.chgerType).toBe('7');
    expect(result!.busiNm).toBe('KT EV 충전소');
    expect(result!.busiCall).toBe('1588-0000');
    expect(result!.useTime).toBe('평일 09:00~18:00');
    expect(result!.output).toBe('50');
    expect(result!.method).toBe('DC콤보');
    expect(result!.parkingFree).toBe('Y');
    expect(result!.maker).toBe('현대일렉트릭');
    expect(result!.floorType).toBe('B');
    expect(result!.year).toBe('2022');
  });

  it('should generate sourceId as statId-chgerId', () => {
    const result = transformEvChargerItem(baseItem);

    expect(result).not.toBeNull();
    expect(result!.sourceId).toBe('ME12345-01');
    expect(result!.statId).toBe('ME12345');
    expect(result!.chgerId).toBe('01');
    expect(result!.id).toBe('ev-charger-ME12345-01');
  });

  it('should parse address to extract city and district', () => {
    const result = transformEvChargerItem(baseItem);

    expect(result).not.toBeNull();
    expect(result!.city).toBe('서울');
    expect(result!.district).toBe('중구');
    expect(result!.address).toBe('서울특별시 중구 태평로1가 31');
  });

  it('should validate coordinates within KOREA_BOUNDS', () => {
    const result = transformEvChargerItem(baseItem);

    expect(result).not.toBeNull();
    expect(result!.lat).toBeCloseTo(37.5665, 4);
    expect(result!.lng).toBeCloseTo(126.9780, 4);
  });

  it('should return null lat/lng for coordinates outside KOREA_BOUNDS', () => {
    const item: EvChargerAPIItem = {
      ...baseItem,
      lat: '10.0',
      lng: '100.0',
    };

    const result = transformEvChargerItem(item);
    expect(result).not.toBeNull();
    expect(result!.lat).toBeNull();
    expect(result!.lng).toBeNull();
  });

  it('should return null lat/lng for missing coordinates', () => {
    const item: EvChargerAPIItem = {
      ...baseItem,
      lat: '',
      lng: '',
    };

    const result = transformEvChargerItem(item);
    expect(result).not.toBeNull();
    expect(result!.lat).toBeNull();
    expect(result!.lng).toBeNull();
  });

  it('should convert "null" string to null', () => {
    const item: EvChargerAPIItem = {
      ...baseItem,
      limitDetail: 'null',
      delDetail: 'null',
      nowTsdt: 'null',
    };

    const result = transformEvChargerItem(item);
    expect(result).not.toBeNull();
    expect(result!.limitDetail).toBeNull();
    expect(result!.delDetail).toBeNull();
    expect(result!.nowTsdt).toBeNull();
  });

  it('should map output kW field', () => {
    const item: EvChargerAPIItem = {
      ...baseItem,
      output: '100',
    };

    const result = transformEvChargerItem(item);
    expect(result).not.toBeNull();
    expect(result!.output).toBe('100');
  });

  it('should return null when statId is missing', () => {
    const item: EvChargerAPIItem = {
      ...baseItem,
      statId: '',
    };

    const result = transformEvChargerItem(item);
    expect(result).toBeNull();
  });

  it('should return null when chgerId is missing', () => {
    const item: EvChargerAPIItem = {
      ...baseItem,
      chgerId: '',
    };

    const result = transformEvChargerItem(item);
    expect(result).toBeNull();
  });

  it('should return null when statNm is missing', () => {
    const item: EvChargerAPIItem = {
      ...baseItem,
      statNm: '',
    };

    const result = transformEvChargerItem(item);
    expect(result).toBeNull();
  });

  it('should return null when addr is missing', () => {
    const item: EvChargerAPIItem = {
      ...baseItem,
      addr: '',
    };

    const result = transformEvChargerItem(item);
    expect(result).toBeNull();
  });

  it('should handle numeric stat and powerType values', () => {
    const item: EvChargerAPIItem = {
      ...baseItem,
      stat: 2,
      powerType: 1,
      output: 50,
    };

    const result = transformEvChargerItem(item);
    expect(result).not.toBeNull();
    expect(result!.stat).toBe('2');
    expect(result!.powerType).toBe('1');
    expect(result!.output).toBe('50');
  });

  it('should handle empty optional fields as null', () => {
    const item: EvChargerAPIItem = {
      ...baseItem,
      note: '',
      addrDetail: '',
      location: '',
    };

    const result = transformEvChargerItem(item);
    expect(result).not.toBeNull();
    expect(result!.note).toBeNull();
    expect(result!.addrDetail).toBeNull();
    expect(result!.location).toBeNull();
  });
});

describe('fetchEvChargerPage 재시도 (일시적 상류 오류 복원력)', () => {
  const OLD_KEY = process.env.OPENAPI_SERVICE_KEY;

  beforeEach(() => {
    process.env.OPENAPI_SERVICE_KEY = 'test-key';
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    if (OLD_KEY === undefined) delete process.env.OPENAPI_SERVICE_KEY;
    else process.env.OPENAPI_SERVICE_KEY = OLD_KEY;
  });

  it('일시적 502 후 재시도로 성공한다', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 502, statusText: 'Bad Gateway' })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ totalCount: 1, items: { item: [{ statId: 'X', chgerId: '01' }] } }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const p = fetchEvChargerPage(1, 10);
    await vi.runAllTimersAsync();
    const res = await p;

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(res.totalCount).toBe(1);
    expect(res.items).toHaveLength(1);
  });

  it('MAX_RETRIES(3)회 모두 실패하면 마지막 에러를 던진다', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 502, statusText: 'Bad Gateway' });
    vi.stubGlobal('fetch', fetchMock);

    const p = fetchEvChargerPage(1, 10);
    const assertion = expect(p).rejects.toThrow('502');
    await vi.runAllTimersAsync();
    await assertion;

    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('30s 내 응답이 없으면 abort하고 재시도한다 (signal 전달 + 타임아웃 배선 검증)', async () => {
    let calls = 0;
    const fetchMock = vi.fn((_url: string, opts: { signal: AbortSignal }) => {
      calls += 1;
      if (calls === 1) {
        // 첫 시도: 응답 없이 매달림 → 30s 타임아웃의 abort로만 reject됨
        return new Promise((_resolve, reject) => {
          opts.signal.addEventListener('abort', () =>
            reject(Object.assign(new Error('The operation was aborted'), { name: 'AbortError' })));
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ totalCount: 1, items: { item: [{ statId: 'X', chgerId: '01' }] } }),
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const p = fetchEvChargerPage(1, 10);
    await vi.runAllTimersAsync();
    const res = await p;

    expect(fetchMock).toHaveBeenCalledTimes(2); // 타임아웃 abort → 재시도 → 성공
    expect(res.totalCount).toBe(1);
  });

  it('단일 item(비배열)도 배열로 정규화한다', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ totalCount: 1, items: { item: { statId: 'S', chgerId: '01' } } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const res = await fetchEvChargerPage(1, 10);
    expect(Array.isArray(res.items)).toBe(true);
    expect(res.items).toHaveLength(1);
  });
});

describe('syncEvChargers 페이지별 증분 upsert (메모리 바운드 + 부분 내구성)', () => {
  const OLD_KEY = process.env.OPENAPI_SERVICE_KEY;

  beforeEach(() => {
    process.env.OPENAPI_SERVICE_KEY = 'test-key';
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (OLD_KEY === undefined) delete process.env.OPENAPI_SERVICE_KEY;
    else process.env.OPENAPI_SERVICE_KEY = OLD_KEY;
  });

  it('페이지마다 즉시 upsert하고(끝에 한 번이 아님), 페이지 내 dedup + 통계 누적이 정확하다', async () => {
    vi.mocked(prisma.syncHistory.create).mockResolvedValue({ id: 1 } as never);
    vi.mocked(prisma.syncHistory.update).mockResolvedValue({} as never);
    // exactStats 사전 SELECT: 기존 행 없음 → 전부 new로 집계
    vi.mocked(prisma.$queryRawUnsafe).mockResolvedValue([] as never);
    vi.mocked(prisma.$transaction).mockImplementation((async (cb: (tx: unknown) => unknown) =>
      cb({ $executeRawUnsafe: vi.fn().mockResolvedValue(0) })) as never);

    // totalCount=1001, NUM_OF_ROWS(기본 1000) 기준 totalPages=2가 되도록 구성.
    // page1: 유효1건 + 페이지내 중복(sourceId 'A-01') 1건 + 변환실패(statId 누락) 1건 = 3 items
    // page2: 유효 1건
    const fetchMock = vi.fn(async (url: string) => {
      const pageNo = new URL(url).searchParams.get('pageNo');
      if (pageNo === '1') {
        return {
          ok: true,
          json: async () => ({
            totalCount: 1001,
            items: {
              item: [
                { statId: 'A', chgerId: '01', statNm: '충전소A', addr: '서울특별시 중구 세종대로 1' },
                { statId: 'A', chgerId: '01', statNm: '충전소A-dup', addr: '서울특별시 중구 세종대로 1' },
                { statId: '', chgerId: '02', statNm: '무효', addr: '서울특별시 중구 1' },
              ],
            },
          }),
        };
      }
      if (pageNo === '2') {
        return {
          ok: true,
          json: async () => ({
            totalCount: 1001,
            items: { item: [{ statId: 'B', chgerId: '01', statNm: '충전소B', addr: '서울특별시 종로구 1' }] },
          }),
        };
      }
      throw new Error(`unexpected pageNo ${pageNo}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const stats = await syncEvChargers();

    // page1 fetch(totalCount 파악 겸용, 재사용) + page2 fetch만 — page1 재조회 없음
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // 페이지마다 즉시 upsert됨을 증명: $transaction(=batchUpsertRaw의 실제 INSERT)이 페이지 수만큼(2회) 호출.
    // 만약 예전처럼 끝에 한 번만 upsert했다면 이 값은 1이 된다.
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    expect(prisma.$queryRawUnsafe).toHaveBeenCalledTimes(2);

    // 통계: totalRecords=4(3+1), skipped=2(변환실패1+페이지내중복1), new=2(고유 sourceId 2건, 기존 없음), updated=0
    expect(stats.totalRecords).toBe(4);
    expect(stats.skippedRecords).toBe(2);
    expect(stats.newRecords).toBe(2);
    expect(stats.updatedRecords).toBe(0);

    // 최종 성공 히스토리 업데이트가 누적된 stats로 기록됨
    expect(prisma.syncHistory.update).toHaveBeenLastCalledWith({
      where: { id: 1 },
      data: expect.objectContaining({
        status: 'success',
        totalRecords: 4,
        newRecords: 2,
        updatedRecords: 0,
      }),
    });
  });
});

describe('syncEvChargers 페이지 영구 실패 skip-continue (부분 내구성, Task 2)', () => {
  const OLD_KEY = process.env.OPENAPI_SERVICE_KEY;
  // totalCount=10000, NUM_OF_ROWS(기본 1000) 기준 totalPages=10 → failureThreshold=ceil(10*0.2)=2
  const TOTAL_COUNT = 10000;

  beforeEach(() => {
    process.env.OPENAPI_SERVICE_KEY = 'test-key';
    vi.clearAllMocks();
    vi.useFakeTimers();

    vi.mocked(prisma.syncHistory.create).mockResolvedValue({ id: 1 } as never);
    vi.mocked(prisma.syncHistory.update).mockResolvedValue({} as never);
    vi.mocked(prisma.$queryRawUnsafe).mockResolvedValue([] as never);
    vi.mocked(prisma.$transaction).mockImplementation((async (cb: (tx: unknown) => unknown) =>
      cb({ $executeRawUnsafe: vi.fn().mockResolvedValue(0) })) as never);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    if (OLD_KEY === undefined) delete process.env.OPENAPI_SERVICE_KEY;
    else process.env.OPENAPI_SERVICE_KEY = OLD_KEY;
  });

  /** pageNo가 failPages에 속하면 항상 502(재시도 소진까지), 아니면 유효 item 1건으로 성공. */
  function makeFetchMock(failPages: Set<number>) {
    return vi.fn(async (url: string) => {
      const pageNo = Number(new URL(url).searchParams.get('pageNo'));
      if (failPages.has(pageNo)) {
        return { ok: false, status: 502, statusText: 'Bad Gateway' };
      }
      return {
        ok: true,
        json: async () => ({
          totalCount: TOTAL_COUNT,
          items: {
            item: [{ statId: `S${pageNo}`, chgerId: '01', statNm: `충전소${pageNo}`, addr: '서울특별시 중구 세종대로 1' }],
          },
        }),
      };
    });
  }

  it('중간 페이지가 영구 실패해도 전체 throw 없이 나머지 페이지를 upsert하고, 부분 성공을 errorMessage에 기록한다', async () => {
    const failPages = new Set([5]); // 1개 실패 < threshold(2) → 부분 성공
    vi.stubGlobal('fetch', makeFetchMock(failPages));

    const p = syncEvChargers();
    await vi.runAllTimersAsync();
    const stats = await p;

    // 실패한 페이지를 제외한 9개 페이지는 여전히 즉시 upsert됨(부분 내구성 증명)
    expect(prisma.$transaction).toHaveBeenCalledTimes(9);
    expect(stats.errors).toHaveLength(0); // throw 없이 정상 반환 — stats.errors에 쌓이지 않음

    expect(prisma.syncHistory.update).toHaveBeenLastCalledWith({
      where: { id: 1 },
      data: expect.objectContaining({
        status: 'success',
        errorMessage: expect.stringContaining('부분 성공'),
      }),
    });
    const lastCall = vi.mocked(prisma.syncHistory.update).mock.calls.at(-1)![0];
    expect(lastCall.data.errorMessage).toContain('1/10');
    expect(lastCall.data.errorMessage).toContain('5');
  });

  it('첫 페이지(totalCount 확보용) 실패는 전체 sync를 failed로 중단한다', async () => {
    const failPages = new Set([1]);
    vi.stubGlobal('fetch', makeFetchMock(failPages));

    const p = syncEvChargers();
    const assertion = expect(p).rejects.toThrow('첫 페이지');
    await vi.runAllTimersAsync();
    await assertion;

    // 첫 페이지 실패 시 페이지 루프에 진입조차 못하므로 upsert가 전혀 일어나지 않음
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.syncHistory.update).toHaveBeenLastCalledWith({
      where: { id: 1 },
      data: expect.objectContaining({ status: 'failed' }),
    });
    const lastCall = vi.mocked(prisma.syncHistory.update).mock.calls.at(-1)![0];
    expect(lastCall.data.errorMessage).toContain('첫 페이지');
  });

  it('실패 페이지 수가 임계값(20%) 이상이면 이미 처리된 페이지는 durable하되 최종 status는 failed다', async () => {
    const failPages = new Set([5, 6]); // 2개 실패 >= threshold(2) → failed
    vi.stubGlobal('fetch', makeFetchMock(failPages));

    const p = syncEvChargers();
    const assertion = expect(p).rejects.toThrow(/임계값/);
    await vi.runAllTimersAsync();
    await assertion;

    // 실패한 2페이지를 제외한 8개 페이지는 throw 전에 이미 upsert 완료(부분 내구성)
    expect(prisma.$transaction).toHaveBeenCalledTimes(8);
    expect(prisma.syncHistory.update).toHaveBeenLastCalledWith({
      where: { id: 1 },
      data: expect.objectContaining({ status: 'failed' }),
    });
    const lastCall = vi.mocked(prisma.syncHistory.update).mock.calls.at(-1)![0];
    expect(lastCall.data.errorMessage).toContain('5');
    expect(lastCall.data.errorMessage).toContain('6');
  });
});
