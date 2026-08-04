import { describe, it, expect, vi, beforeEach } from 'vitest';

const queryRawUnsafe = vi.fn();
vi.mock('../../src/lib/prisma.js', () => ({
  prisma: { $queryRawUnsafe: (...a: unknown[]) => queryRawUnsafe(...a) },
  default: { $queryRawUnsafe: (...a: unknown[]) => queryRawUnsafe(...a) },
}));

import {
  fetchRegions,
  __resetMapCacheForTest,
  sortRegionsByDistance,
} from '../../src/services/realEstateMapService.js';

// 페이지의 SSR 호출이 실제로 쓰는 전국 bbox(schemas/realEstateMap.ts 의 KOREA_BOUNDS 와 동일).
// 이 안에 들어오면 필터가 아무것도 제외하지 않아야 한다.
const KOREA_BOUNDS = { swLat: 33, swLng: 124, neLat: 39, neLng: 132 };
const SEOUL_BOUNDS = { swLat: 37.4, swLng: 126.8, neLat: 37.7, neLng: 127.2 };

const SEOUL_ROW = { name: '서울특별시', district: '강남구', lat: '37.5172', lng: '127.0473', avgPricePerPyeong: 5000n, transactionCount: 10n };
const BUSAN_ROW = { name: '부산광역시', district: '서구', lat: '35.0975', lng: '129.0242', avgPricePerPyeong: 3000n, transactionCount: 5n };

describe('fetchRegions', () => {
  beforeEach(() => {
    queryRawUnsafe.mockReset();
    __resetMapCacheForTest();
  });

  it('sargable 날짜 조건을 쓴다 — dealYear 에 연산을 걸지 않는다', async () => {
    queryRawUnsafe.mockResolvedValue([]);
    await fetchRegions('apt-sale', 'city', KOREA_BOUNDS);
    const sql = queryRawUnsafe.mock.calls[0][0] as string;
    expect(sql).not.toMatch(/dealYear\s*\*/);
    expect(sql).toContain('(dealYear = ? AND dealMonth >= ?) OR dealYear > ?');
  });

  it('매매는 dealAmount 를 쓴다', async () => {
    queryRawUnsafe.mockResolvedValue([]);
    await fetchRegions('apt-sale', 'city', KOREA_BOUNDS);
    expect(queryRawUnsafe.mock.calls[0][0]).toContain('dealAmount');
  });

  it('전월세는 deposit 을 쓰고 전세(monthlyRent=0)만 집계한다', async () => {
    queryRawUnsafe.mockResolvedValue([]);
    await fetchRegions('apt-rent', 'city', KOREA_BOUNDS);
    const sql = queryRawUnsafe.mock.calls[0][0] as string;
    expect(sql).toContain('deposit');
    expect(sql).toContain('monthlyRent = 0');
  });

  it('같은 (type, level) 두 번째 호출은 캐시를 쓴다', async () => {
    queryRawUnsafe.mockResolvedValue([]);
    await fetchRegions('apt-sale', 'city', KOREA_BOUNDS);
    await fetchRegions('apt-sale', 'city', KOREA_BOUNDS);
    expect(queryRawUnsafe).toHaveBeenCalledTimes(1);
  });

  it('동시 호출을 한 번의 쿼리로 합친다 (in-flight)', async () => {
    let resolve!: (v: unknown) => void;
    queryRawUnsafe.mockReturnValueOnce(new Promise((r) => { resolve = r; }));
    const p1 = fetchRegions('villa-sale', 'district', KOREA_BOUNDS);
    const p2 = fetchRegions('villa-sale', 'district', KOREA_BOUNDS);
    resolve([]);
    await Promise.all([p1, p2]);
    expect(queryRawUnsafe).toHaveBeenCalledTimes(1);
  });

  it('쿼리가 실패하면 빈 배열을 주고 캐시하지 않는다 (fail-open)', async () => {
    queryRawUnsafe.mockRejectedValueOnce(new Error('db down'));
    expect(await fetchRegions('apt-sale', 'city', KOREA_BOUNDS)).toEqual([]);
    queryRawUnsafe.mockResolvedValueOnce([]);
    await fetchRegions('apt-sale', 'city', KOREA_BOUNDS);
    expect(queryRawUnsafe).toHaveBeenCalledTimes(2);
  });

  it('BigInt/Decimal 을 Number 로 바꾼다', async () => {
    queryRawUnsafe.mockResolvedValue([
      { name: '서울', district: null, lat: '37.5513', lng: '126.9891', avgPricePerPyeong: 7732n, transactionCount: 12043n },
    ]);
    const r = await fetchRegions('apt-sale', 'city', KOREA_BOUNDS);
    expect(r[0]).toEqual({
      name: '서울', district: null, dong: null, lat: 37.5513, lng: 126.9891,
      avgPricePerPyeong: 7732, transactionCount: 12043,
    });
  });

  describe('뷰포트(bbox) 필터', () => {
    it('서울 bbox 는 서울 지역만 반환하고 부산은 제외한다', async () => {
      queryRawUnsafe.mockResolvedValue([SEOUL_ROW, BUSAN_ROW]);
      const r = await fetchRegions('apt-sale', 'district', SEOUL_BOUNDS);
      expect(r.map((x) => x.name)).toEqual(['서울특별시']);
    });

    it('전국(whole-Korea) bbox 는 16개 시/도를 전부 포함해 여전히 다 받는다', async () => {
      // 페이지 SSR 은 이 bbox 로 호출한다 — 필터가 있어도 크롤러블 콘텐츠(16 시/도)가
      // 하나도 빠지면 안 된다.
      queryRawUnsafe.mockResolvedValue([SEOUL_ROW, BUSAN_ROW]);
      const r = await fetchRegions('apt-sale', 'district', KOREA_BOUNDS);
      expect(r.map((x) => x.name).sort()).toEqual(['부산광역시', '서울특별시']);
    });

    it('서로 다른 bbox 로 두 번 호출해도 캐시 키는 (type, level) 뿐이라 쿼리는 한 번만 나간다', async () => {
      queryRawUnsafe.mockResolvedValue([SEOUL_ROW, BUSAN_ROW]);
      await fetchRegions('apt-sale', 'district', SEOUL_BOUNDS);
      await fetchRegions('apt-sale', 'district', KOREA_BOUNDS);
      expect(queryRawUnsafe).toHaveBeenCalledTimes(1);
    });

    it('필터된 결과 개수가 곧 total 이다 (라우트가 items.length 를 total 로 쓴다)', async () => {
      queryRawUnsafe.mockResolvedValue([SEOUL_ROW, BUSAN_ROW]);
      const r = await fetchRegions('apt-sale', 'district', SEOUL_BOUNDS);
      expect(r.length).toBe(1);
    });

    it('좌표가 null 인 항목은 크래시 없이 필터에서 제외된다', async () => {
      queryRawUnsafe.mockResolvedValue([
        { name: '좌표없음', district: '어딘가', lat: null, lng: null, avgPricePerPyeong: null, transactionCount: 1n },
        SEOUL_ROW,
      ]);
      const r = await fetchRegions('apt-sale', 'district', SEOUL_BOUNDS);
      expect(r.map((x) => x.name)).toEqual(['서울특별시']);
    });
  });

  describe('뷰포트 중심 정렬', () => {
    // SEOUL_BOUNDS 의 중심은 { lat: 37.55, lng: 127.0 } 다.
    const CENTER_ROW = { name: '서울특별시', district: '중구', lat: '37.55', lng: '127.0', avgPricePerPyeong: 5000n, transactionCount: 1n }; // 거리 0
    const MID_ROW = { name: '서울특별시', district: '마포구', lat: '37.6', lng: '127.1', avgPricePerPyeong: 5000n, transactionCount: 1n }; // 거리제곱 0.0125
    const FAR_ROW = { name: '서울특별시', district: '강서구', lat: '37.41', lng: '126.81', avgPricePerPyeong: 5000n, transactionCount: 1n }; // 거리제곱 ≈0.0557

    it('결과가 뷰포트 중심에서 가까운 순으로 정렬된다 — DB 는 알파벳순으로 줘도 무관하다', async () => {
      // group by 결과 순서를 흉내내 일부러 거리 순서와 무관하게(강서<마포<중 알파벳순) 준다.
      queryRawUnsafe.mockResolvedValue([FAR_ROW, MID_ROW, CENTER_ROW]);
      const r = await fetchRegions('apt-sale', 'district', SEOUL_BOUNDS);
      expect(r.map((x) => x.district)).toEqual(['중구', '마포구', '강서구']);
    });

    it('좌표가 null 인 항목이 섞여도 정렬이 크래시하지 않고 결정론적으로 맨 뒤로 간다', () => {
      // fetchRegions 를 거치면 null 좌표 항목은 이미 filterRegionsByBounds 가 걸러내
      // sortRegionsByDistance 에 도달하지 않는다(위 '좌표가 null 인 항목은...' 테스트가 그걸
      // 확인한다). 이 테스트는 그 방어 코드 자체 — sortRegionsByDistance 가 필터를 거치지
      // 않은 목록에 단독으로 호출되는 경우에도 안전한지 — 를 직접 검증한다.
      const nullRow = { name: '좌표없음', district: '어딘가', dong: null, lat: null, lng: null, avgPricePerPyeong: null, transactionCount: 1 };
      const near = { name: '서울특별시', district: '강남구', dong: null, lat: 37.55, lng: 127.0, avgPricePerPyeong: 1000, transactionCount: 1 };
      const far = { name: '서울특별시', district: '강북구', dong: null, lat: 37.41, lng: 126.81, avgPricePerPyeong: 1000, transactionCount: 1 };

      let result: typeof near[] = [];
      expect(() => {
        result = sortRegionsByDistance([nullRow, far, near], SEOUL_BOUNDS) as typeof near[];
      }).not.toThrow();
      expect(result.map((x) => x.district)).toEqual(['강남구', '강북구', '어딘가']);
    });

    it('거리가 같은 두 항목은 name→district 로 결정론적 순서를 유지한다 — 입력 순서를 뒤집어도 같다', async () => {
      // 중심이 (0,0) 인 bbox 를 써서 축을 하나씩만 어긋나게 한다 — lat/lng 를 둘 다
      // 움직이면(예: SEOUL_BOUNDS 중심 기준 대칭점) "37.6-37.55" 와 "37.5-37.55" 처럼
      // 서로 다른 뺄셈에서 나온 부동소수라 마지막 비트가 미세하게 달라 실제로는 같지
      // 않은 "37.6"===equal 이 아닌 경우가 생긴다(실측: 7e-16 차이로 이 테스트가 깨졌었다).
      // (0,0) 중심 + 한 축만 0.1 로 어긋나게 하면 두 항목 모두 동일한 리터럴 0.1 을 그대로
      // 제곱하므로 부동소수 오차 없이 정확히 같은 거리가 나온다.
      const ZERO_CENTER_BOUNDS = { swLat: -1, swLng: -1, neLat: 1, neLng: 1 };
      const gangnam = { name: '서울특별시', district: '강남구', lat: '0.1', lng: '0', avgPricePerPyeong: 5000n, transactionCount: 1n };
      const gangbuk = { name: '서울특별시', district: '강북구', lat: '0', lng: '0.1', avgPricePerPyeong: 5000n, transactionCount: 1n };

      queryRawUnsafe.mockResolvedValueOnce([gangbuk, gangnam]);
      const r1 = await fetchRegions('apt-sale', 'district', ZERO_CENTER_BOUNDS);

      __resetMapCacheForTest();
      queryRawUnsafe.mockResolvedValueOnce([gangnam, gangbuk]);
      const r2 = await fetchRegions('apt-sale', 'district', ZERO_CENTER_BOUNDS);

      expect(r1.map((x) => x.district)).toEqual(['강남구', '강북구']);
      expect(r2.map((x) => x.district)).toEqual(['강남구', '강북구']);
    });

    it('캐시는 여전히 (type, level) 로만 키가 잡힌다 — 다른 bbox(다른 중심)로 다시 불러도 쿼리는 한 번만 나간다', async () => {
      const OTHER_BOUNDS = { swLat: 34.8, swLng: 128.4, neLat: 35.4, neLng: 129.4 }; // 부산 근방, 중심이 SEOUL_BOUNDS 와 다르다
      queryRawUnsafe.mockResolvedValue([FAR_ROW, MID_ROW, CENTER_ROW]);
      await fetchRegions('apt-sale', 'district', SEOUL_BOUNDS);
      await fetchRegions('apt-sale', 'district', OTHER_BOUNDS);
      expect(queryRawUnsafe).toHaveBeenCalledTimes(1);
    });
  });
});

describe('동 집계', () => {
  // 이 describe 는 'fetchRegions' 블록의 beforeEach(mockReset) 를 상속받지 않는
  // 형제 describe 다 — 목 호출 로그를 매 테스트 시작 시 직접 비워야
  // `queryRawUnsafe.mock.calls[0][0]` 이 이전 테스트의 호출을 가리키지 않는다.
  beforeEach(() => {
    queryRawUnsafe.mockReset();
  });

  it("level='dong' 이면 dongName 으로 GROUP BY 하고 거래 좌표 평균을 쓴다", async () => {
    // Region 테이블에는 동이 없다(@@unique([city, district])). JOIN 으로 좌표를
    // 얻으려 하면 0행이 나오므로 거래의 AVG(lat)/AVG(lng) 를 써야 한다.
    __resetMapCacheForTest();
    queryRawUnsafe.mockResolvedValue([]);
    await fetchRegions('apt-sale', 'dong', KOREA_BOUNDS);

    const sql = queryRawUnsafe.mock.calls[0][0] as string;
    expect(sql).toMatch(/GROUP BY[\s\S]*t\.dongName/);
    expect(sql).toMatch(/AVG\(t\.lat\)/);
    expect(sql).toMatch(/AVG\(t\.lng\)/);
    expect(sql).not.toMatch(/JOIN Region/);
    // dong 은 JOIN Region 이 없어 별칭 r 이 존재하지 않는다. GROUP BY 꼬리에 r.lat 이
    // 섞이면 "unknown column 'r.lat'" 로 런타임에 죽는다 — groupTail 이 dong 에서 비어
    // 있어야 하는 이유를 직접 고정한다.
    expect(sql).not.toMatch(/GROUP BY[\s\S]*r\.lat/);
  });

  it('district 레벨에는 좌표 NULL 필터가 없다 — 있으면 미지오코딩 거래가 평균가 집계에서도 빠진다', async () => {
    // city/district 는 좌표를 Region JOIN 에서 가져오므로 거래 좌표(t.lat/t.lng)와
    // 무관하다. coordFilter 가 여기까지 적용되면 좌표 없는 0.1% 거래가 평당가 평균
    // (avgPricePerPyeong) 에서도 조용히 빠지는, 의도하지 않은 변경이 된다.
    __resetMapCacheForTest();
    queryRawUnsafe.mockResolvedValue([]);
    await fetchRegions('apt-sale', 'district', KOREA_BOUNDS);

    const sql = queryRawUnsafe.mock.calls[0][0] as string;
    expect(sql).not.toMatch(/t\.lat IS NOT NULL/);
  });

  it('좌표 없는 거래를 평균에서 제외한다', async () => {
    // 거래의 0.1% 는 지오코딩이 안 돼 lat/lng 가 NULL 이다. 걸러내지 않으면
    // 동 중심이 흔들린다.
    __resetMapCacheForTest();
    queryRawUnsafe.mockResolvedValue([]);
    await fetchRegions('apt-sale', 'dong', KOREA_BOUNDS);

    const sql = queryRawUnsafe.mock.calls[0][0] as string;
    expect(sql).toMatch(/t\.lat IS NOT NULL/);
    expect(sql).toMatch(/t\.lng IS NOT NULL/);
  });

  it('dong 필드를 채워 반환한다', async () => {
    __resetMapCacheForTest();
    queryRawUnsafe.mockResolvedValue([
      { name: '서울', district: '강북구', dong: '미아동', lat: '37.63', lng: '127.02',
        avgPricePerPyeong: 3225n, transactionCount: 42n },
    ]);
    const items = await fetchRegions('apt-sale', 'dong', KOREA_BOUNDS);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ name: '서울', district: '강북구', dong: '미아동' });
  });

  it('city/district 레벨의 dong 은 null 이다', async () => {
    __resetMapCacheForTest();
    queryRawUnsafe.mockResolvedValue([
      { name: '서울', district: null, lat: '37.55', lng: '126.99', avgPricePerPyeong: 5164n, transactionCount: 100n },
    ]);
    const items = await fetchRegions('apt-sale', 'city', KOREA_BOUNDS);
    expect(items[0].dong).toBeNull();
  });

  it('캐시 키는 (type, level) 뿐 — 다른 bbox 는 재조회하지 않는다', async () => {
    __resetMapCacheForTest();
    queryRawUnsafe.mockResolvedValue([]);
    await fetchRegions('apt-sale', 'dong', KOREA_BOUNDS);
    await fetchRegions('apt-sale', 'dong', SEOUL_BOUNDS);
    expect(queryRawUnsafe).toHaveBeenCalledTimes(1);
  });

  it('전월세 동 집계는 전세만 본다 (구·군과 동일 규칙)', async () => {
    __resetMapCacheForTest();
    queryRawUnsafe.mockResolvedValue([]);
    await fetchRegions('apt-rent', 'dong', KOREA_BOUNDS);

    const sql = queryRawUnsafe.mock.calls[0][0] as string;
    expect(sql).toMatch(/t\.monthlyRent = 0/);
    expect(sql).toMatch(/deposit/);
  });
});
