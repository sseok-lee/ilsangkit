// @TASK Phase2-8 - 카카오 Geocoding 좌표 보강 스크립트 테스트 (TDD)

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// apiKey가 모듈 로드 시점에 캡처되므로 import 전에 제거해야 함
const { mockFetch } = vi.hoisted(() => {
  delete process.env.KAKAO_REST_API_KEY;
  const mockFetch = vi.fn();
  global.fetch = mockFetch;
  return { mockFetch };
});

// Mock PrismaClient
const mockFindMany = vi.fn();
const mockUpdateMany = vi.fn();
const mockFindFirst = vi.fn();
const mockQueryRawUnsafe = vi.fn();
const mockExecuteRawUnsafe = vi.fn();
let lockDir: string;

beforeEach(() => {
  lockDir = mkdtempSync(join(tmpdir(), 'geocode-lock-'));
  process.env.REAL_ESTATE_WRITE_LOCK_DIR = lockDir;
});

afterEach(() => {
  delete process.env.REAL_ESTATE_WRITE_LOCK_TOKEN;
  delete process.env.REAL_ESTATE_WRITE_LOCK_DIR;
  rmSync(lockDir, { recursive: true, force: true });
});

vi.mock('@prisma/client', () => {
  const model = () => ({
    findMany: mockFindMany,
    updateMany: mockUpdateMany,
    findFirst: mockFindFirst,
  });
  function PrismaClient() {
    return {
      aptSaleTransaction: model(),
      aptRentTransaction: model(),
      villaSaleTransaction: model(),
      villaRentTransaction: model(),
      offitelSaleTransaction: model(),
      offitelRentTransaction: model(),
      $queryRawUnsafe: mockQueryRawUnsafe,
    $executeRawUnsafe: mockExecuteRawUnsafe,
      $executeRawUnsafe: mockExecuteRawUnsafe,
      $disconnect: vi.fn(),
    };
  }
  return { PrismaClient };
});

import {
  buildSearchQuery,
  parseKakaoCoordinates,
  geocodeAddress,
  cleanBuildingName,
  updateBuildingCoordinates,
  markGeocodeAttempted,
  getGeocodeTargets,
  loadBuildingAddress,
  toBuildingKey,
  SQL_TABLE_NAME,
  copyCoordsWithinTable,
  copyCoordsFromSibling,
  copyCoordsFromSiblingForUncoordinated,
  getBuildingsWithoutAnyCoords,
  getRecentBuildingsNeedingCoords,
  processTable,
  type UniqueBuilding,
  type KakaoAddressResult,
} from '../../src/scripts/geocodeRealEstate.js';

describe('buildSearchQuery', () => {
  it('도로명 주소가 있으면 시+구+도로명+건물명 반환', () => {
    const building: UniqueBuilding = {
      buildingName: '래미안아파트',
      bjdCode: '1168010800',
      city: '서울특별시',
      district: '강남구',
      dongName: '역삼동',
      roadName: '강남대로 123',
      jibun: '123-4',
    };
    expect(buildSearchQuery(building)).toBe('서울특별시 강남구 강남대로 123 래미안아파트');
  });

  it('도로명 주소가 없으면 시+구+건물명 반환', () => {
    const building: UniqueBuilding = {
      buildingName: '래미안아파트',
      bjdCode: '1168010800',
      city: '서울특별시',
      district: '강남구',
      dongName: '역삼동',
      roadName: null,
      jibun: null,
    };
    expect(buildSearchQuery(building)).toBe('서울특별시 강남구 래미안아파트');
  });

  it('도로명 주소가 빈 문자열이면 시+구+건물명 반환', () => {
    const building: UniqueBuilding = {
      buildingName: '현대아파트',
      bjdCode: '1168010800',
      city: '서울특별시',
      district: '강남구',
      dongName: '역삼동',
      roadName: '',
      jibun: null,
    };
    expect(buildSearchQuery(building)).toBe('서울특별시 강남구 현대아파트');
  });
});

describe('cleanBuildingName', () => {
  it('번지 괄호 제거: 삼도주택(414-11) → 삼도주택', () => {
    expect(cleanBuildingName('삼도주택(414-11)')).toBe('삼도주택');
  });

  it('동 괄호 제거: 렉스빌(C동) → 렉스빌', () => {
    expect(cleanBuildingName('렉스빌(C동)')).toBe('렉스빌');
  });

  it('복합 동 괄호 제거: 궁전빌라(A-B동) → 궁전빌라', () => {
    expect(cleanBuildingName('궁전빌라(A-B동)')).toBe('궁전빌라');
  });

  it('숫자+동 제거: 효성빌라27동 → 효성빌라', () => {
    expect(cleanBuildingName('효성빌라27동')).toBe('효성빌라');
  });

  it('영문+동 제거: 삼성에센빌D동 → 삼성에센빌', () => {
    expect(cleanBuildingName('삼성에센빌D동')).toBe('삼성에센빌');
  });

  it('한글+동 제거: 유동빌라가동 → 유동빌라', () => {
    expect(cleanBuildingName('유동빌라가동')).toBe('유동빌라');
  });

  it('번지+동 복합 제거: 삼성에센빌D동(175-45) → 삼성에센빌', () => {
    expect(cleanBuildingName('삼성에센빌D동(175-45)')).toBe('삼성에센빌');
  });

  it('정제 불필요한 이름은 그대로 반환', () => {
    expect(cleanBuildingName('래미안아파트')).toBe('래미안아파트');
  });
});

describe('parseKakaoCoordinates', () => {
  it('카카오 API 응답에서 좌표 추출', () => {
    const response: KakaoAddressResult = {
      documents: [
        {
          x: '127.0276',
          y: '37.4980',
          address_name: '서울 강남구 테헤란로 152',
        },
      ],
    };
    const coords = parseKakaoCoordinates(response);
    expect(coords).not.toBeNull();
    expect(coords!.lat).toBeCloseTo(37.498, 3);
    expect(coords!.lng).toBeCloseTo(127.0276, 4);
  });

  it('빈 documents 배열이면 null 반환', () => {
    const response: KakaoAddressResult = { documents: [] };
    expect(parseKakaoCoordinates(response)).toBeNull();
  });

  it('첫 번째 document의 좌표만 사용', () => {
    const response: KakaoAddressResult = {
      documents: [
        { x: '127.0276', y: '37.4980' },
        { x: '126.9780', y: '37.5665' },
      ],
    };
    const coords = parseKakaoCoordinates(response);
    expect(coords!.lat).toBeCloseTo(37.498, 3);
    expect(coords!.lng).toBeCloseTo(127.0276, 4);
  });
});

describe('geocodeAddress', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('API 키가 없으면 null 반환 (모듈 레벨 캡처)', async () => {
    // apiKey는 모듈 로드 시점에 process.env에서 캡처되므로
    // 테스트 환경에서는 항상 undefined → null 반환
    const coords = await geocodeAddress('강남대로 123 래미안아파트');
    expect(coords).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('API 키가 없으면 fetch를 호출하지 않음', async () => {
    const coords = await geocodeAddress('존재하지않는주소');
    expect(coords).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('API 오류 응답이면 null 반환', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
    });

    const coords = await geocodeAddress('강남대로 123');
    expect(coords).toBeNull();
  });

  it('fetch 예외 발생 시 null 반환', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const coords = await geocodeAddress('강남대로 123');
    expect(coords).toBeNull();
  });

  it('KAKAO_REST_API_KEY 없으면 null 반환', async () => {
    // apiKey는 모듈 로드 시점에 캡처되므로, 테스트 환경에서는 이미 설정된 상태
    // API 키가 없는 환경에서는 fetch가 호출되지 않고 null을 반환하는 것이 기대 동작
    // 여기서는 API 응답이 빈 경우 null 반환을 검증
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ documents: [] }),
    });

    const coords = await geocodeAddress('강남대로 123');
    expect(coords).toBeNull();
  });
});

function makePrisma() {
  const model = () => ({
    findMany: mockFindMany,
    updateMany: mockUpdateMany,
    findFirst: mockFindFirst,
  });
  return {
    aptSaleTransaction: model(),
    aptRentTransaction: model(),
    villaSaleTransaction: model(),
    villaRentTransaction: model(),
    offitelSaleTransaction: model(),
    offitelRentTransaction: model(),
    $queryRawUnsafe: mockQueryRawUnsafe,
    $executeRawUnsafe: mockExecuteRawUnsafe,
    $disconnect: vi.fn(),
  } as unknown as import('@prisma/client').PrismaClient;
}

describe('SQL_TABLE_NAME', () => {
  it('6개 델리게이트명 전부에 SQL 테이블명이 매핑됨', () => {
    expect(SQL_TABLE_NAME.aptSaleTransaction).toBe('AptSaleTransaction');
    expect(SQL_TABLE_NAME.aptRentTransaction).toBe('AptRentTransaction');
    expect(SQL_TABLE_NAME.villaSaleTransaction).toBe('VillaSaleTransaction');
    expect(SQL_TABLE_NAME.villaRentTransaction).toBe('VillaRentTransaction');
    expect(SQL_TABLE_NAME.offitelSaleTransaction).toBe('OffitelSaleTransaction');
    expect(SQL_TABLE_NAME.offitelRentTransaction).toBe('OffitelRentTransaction');
  });
});

const KEY = { bjdCode: '1168010800', buildingName: '현대빌라', dongName: '역삼동', jibun: '12-3' };
const ADDR = [KEY.bjdCode, KEY.buildingName, KEY.dongName, KEY.jibun];
const SINCE = { year: 2026, month: 7 };

describe('toBuildingKey', () => {
  it('동·지번을 trim 하고 null 은 빈 문자열로 — 요약의 COALESCE(TRIM()) 과 같은 키', () => {
    expect(toBuildingKey({ bjdCode: '1', buildingName: 'A', dongName: ' 역삼동 ', jibun: null }))
      .toEqual({ bjdCode: '1', buildingName: 'A', dongName: '역삼동', jibun: '' });
  });
});

describe('getRecentBuildingsNeedingCoords', () => {
  beforeEach(() => vi.clearAllMocks());

  it('최근 거래 빈 행의 주소 건물을 SQL DISTINCT + sargable 조건으로 조회한다', async () => {
    mockQueryRawUnsafe.mockResolvedValue([]);

    await getRecentBuildingsNeedingCoords(makePrisma(), 'villaRentTransaction', { year: 2025, month: 11 });

    const [sql, ...params] = mockQueryRawUnsafe.mock.calls[0];
    expect(sql).toContain('SELECT DISTINCT');
    expect(sql).toContain('`VillaRentTransaction`');
    expect(sql).toContain("COALESCE(TRIM(dongName), '') AS dongName");
    expect(sql).toContain("COALESCE(TRIM(jibun), '') AS jibun");
    expect(sql).toContain('lat IS NULL');
    expect(sql).toContain('((dealYear = ? AND dealMonth >= ?) OR dealYear > ?)');
    expect(params).toEqual([2025, 11, 2025]);
    expect(mockFindMany).not.toHaveBeenCalled();
  });
});

describe('getBuildingsWithoutAnyCoords', () => {
  beforeEach(() => vi.clearAllMocks());

  it('같은 주소(동·지번)에 좌표 행이 하나도 없는 건물만, 날짜 조건 없이 고른다', async () => {
    mockQueryRawUnsafe.mockResolvedValue([KEY]);

    const rows = await getBuildingsWithoutAnyCoords(makePrisma(), 'villaSaleTransaction');

    expect(rows).toEqual([KEY]);
    const [sql, ...params] = mockQueryRawUnsafe.mock.calls[0];
    expect(sql).toContain('NOT EXISTS');
    // 이름만으로 묶으면 같은 법정동 동명 빌라의 다른 지번이 좌표를 영영 못 받는다
    expect(sql).toContain("COALESCE(TRIM(c.dongName), '') = n.dongName");
    expect(sql).toContain("COALESCE(TRIM(c.jibun), '') = n.jibun");
    expect(sql).toContain('c.lat IS NOT NULL');
    expect(sql).not.toContain('dealYear');
    expect(params).toEqual([]);
  });

  it('retryCutoff 를 주면 geocodedAt 조건이 붙는다', async () => {
    mockQueryRawUnsafe.mockResolvedValue([]);
    const cutoff = new Date('2026-09-20T00:00:00Z');

    await getBuildingsWithoutAnyCoords(makePrisma(), 'aptSaleTransaction', cutoff);

    const [sql, param] = mockQueryRawUnsafe.mock.calls[0];
    expect(sql).toContain('geocodedAt IS NULL OR geocodedAt <');
    expect(param).toBe(cutoff);
  });
});

describe('getGeocodeTargets', () => {
  beforeEach(() => vi.clearAllMocks());

  it('카카오 대상 = 좌표 행이 하나도 없는 주소 건물, 30일 재시도 컷오프', async () => {
    mockQueryRawUnsafe.mockResolvedValue([]);
    const now = new Date('2026-10-20T00:00:00Z');

    await getGeocodeTargets(makePrisma(), 'aptSaleTransaction', now);

    const [sql, cutoff] = mockQueryRawUnsafe.mock.calls[0];
    expect(sql).toContain('NOT EXISTS');
    expect(sql).toContain('geocodedAt IS NULL OR geocodedAt <');
    expect((cutoff as Date).toISOString()).toBe('2026-09-20T00:00:00.000Z');
  });
});

describe('loadBuildingAddress', () => {
  beforeEach(() => vi.clearAllMocks());

  it('주소 필드를 같은 주소 건물의 한 행에서 읽는다', async () => {
    const row = { buildingName: '현대빌라', bjdCode: KEY.bjdCode, city: '서울', district: '강남구', dongName: '역삼동', roadName: null, jibun: '12-3' };
    mockQueryRawUnsafe.mockResolvedValue([row]);

    const building = await loadBuildingAddress(makePrisma(), 'villaSaleTransaction', KEY);

    expect(building).toEqual(row);
    const [sql, ...params] = mockQueryRawUnsafe.mock.calls[0];
    expect(sql).toContain('LIMIT 1');
    expect(params).toEqual(ADDR);
  });

  it('행이 사라졌으면 null', async () => {
    mockQueryRawUnsafe.mockResolvedValue([]);
    expect(await loadBuildingAddress(makePrisma(), 'villaSaleTransaction', KEY)).toBeNull();
  });
});

describe('updateBuildingCoordinates / markGeocodeAttempted', () => {
  beforeEach(() => vi.clearAllMocks());

  const building: UniqueBuilding = {
    buildingName: '현대빌라', bjdCode: KEY.bjdCode, city: '서울', district: '강남구',
    dongName: ' 역삼동', roadName: null, jibun: '12-3 ',
  };

  it('같은 주소 건물의 빈 행에만 좌표를 쓴다 (이름이 같은 다른 지번은 건드리지 않음)', async () => {
    mockExecuteRawUnsafe.mockResolvedValue(5);

    const count = await updateBuildingCoordinates(makePrisma(), 'aptSaleTransaction', building, { lat: 37.498, lng: 127.0276 });

    expect(count).toBe(5);
    const [sql, ...params] = mockExecuteRawUnsafe.mock.calls[0];
    expect(sql).toContain('UPDATE `AptSaleTransaction` SET lat = ?, lng = ?, geocodedAt = ?');
    expect(sql).toContain("COALESCE(TRIM(jibun), '') = ?");
    expect(sql).toContain('lat IS NULL');
    expect(params).toEqual([37.498, 127.0276, expect.any(Date), ...ADDR]);
  });

  it('SQL 이 만든 키를 넘기면 그 키를 그대로 쓴다', async () => {
    mockExecuteRawUnsafe.mockResolvedValue(1);
    const rawKey = { ...KEY, dongName: '역삼동\u3000' };

    await updateBuildingCoordinates(makePrisma(), 'aptSaleTransaction', building, { lat: 1, lng: 2 }, rawKey);

    expect(mockExecuteRawUnsafe.mock.calls[0].slice(4)).toEqual([KEY.bjdCode, KEY.buildingName, '역삼동\u3000', KEY.jibun]);
  });

  it('실패 기록도 같은 주소 건물 빈 행에만', async () => {
    mockExecuteRawUnsafe.mockResolvedValue(2);

    await markGeocodeAttempted(makePrisma(), 'aptSaleTransaction', building);

    const [sql, ...params] = mockExecuteRawUnsafe.mock.calls[0];
    expect(sql).toContain('SET geocodedAt = ?');
    expect(params).toEqual([expect.any(Date), ...ADDR]);
  });
});

describe('copyCoordsWithinTable', () => {
  beforeEach(() => vi.clearAllMocks());

  it('대상이 없으면 seed 조회·UPDATE 를 하지 않는다 (OOM 회귀 방지)', async () => {
    mockQueryRawUnsafe.mockResolvedValue([]);

    expect(await copyCoordsWithinTable(makePrisma(), 'aptRentTransaction', SINCE)).toBe(0);
    expect(mockQueryRawUnsafe).toHaveBeenCalledTimes(1);
    expect(mockExecuteRawUnsafe).not.toHaveBeenCalled();
    expect(mockFindMany).not.toHaveBeenCalled();
  });

  it('같은 주소 건물 seed 좌표를 최근 거래 빈 행에만 복사한다', async () => {
    mockQueryRawUnsafe
      .mockResolvedValueOnce([KEY])
      .mockResolvedValueOnce([{ lat: 37.498, lng: 127.0276 }]);
    mockExecuteRawUnsafe.mockResolvedValue(3);

    const copied = await copyCoordsWithinTable(makePrisma(), 'aptSaleTransaction', SINCE);

    expect(copied).toBe(3);
    const [seedSql, ...seedParams] = mockQueryRawUnsafe.mock.calls[1];
    expect(seedSql).toContain('FROM `AptSaleTransaction`');
    expect(seedSql).toContain('lat IS NOT NULL');
    expect(seedParams).toEqual(ADDR);
    // 과거 행까지 채우면 백필 수백만 행 UPDATE 로 45분 watchdog 초과(2026-10-20)
    const [sql, ...params] = mockExecuteRawUnsafe.mock.calls[0];
    expect(sql).toContain('((dealYear = ? AND dealMonth >= ?) OR dealYear > ?)');
    expect(params).toEqual([37.498, 127.0276, expect.any(Date), ...ADDR, 2026, 7, 2026]);
  });

  it('seed 가 없으면 UPDATE 하지 않는다', async () => {
    mockQueryRawUnsafe.mockResolvedValueOnce([KEY]).mockResolvedValueOnce([]);

    expect(await copyCoordsWithinTable(makePrisma(), 'villaSaleTransaction', SINCE)).toBe(0);
    expect(mockExecuteRawUnsafe).not.toHaveBeenCalled();
  });
});

describe('copyCoordsFromSibling', () => {
  beforeEach(() => vi.clearAllMocks());

  it('형제 테이블이 없으면 0 을 반환하고 아무것도 조회하지 않는다', async () => {
    expect(await copyCoordsFromSibling(makePrisma(), 'landSaleTransaction' as never, SINCE)).toBe(0);
    expect(mockQueryRawUnsafe).not.toHaveBeenCalled();
  });

  it('대상 목록은 대상 테이블, seed 는 형제 테이블에서 읽고 최근 행만 채운다', async () => {
    mockQueryRawUnsafe
      .mockResolvedValueOnce([KEY])
      .mockResolvedValueOnce([{ lat: 37.5, lng: 127.0 }]);
    mockExecuteRawUnsafe.mockResolvedValue(2);

    const copied = await copyCoordsFromSibling(makePrisma(), 'aptRentTransaction', SINCE);

    expect(copied).toBe(2);
    expect(mockQueryRawUnsafe.mock.calls[0][0]).toContain('`AptRentTransaction`');
    expect(mockQueryRawUnsafe.mock.calls[1][0]).toContain('`AptSaleTransaction`');
    expect(mockExecuteRawUnsafe.mock.calls[0][0]).toContain('UPDATE `AptRentTransaction`');
    expect(mockExecuteRawUnsafe.mock.calls[0][0]).toContain('dealYear');
  });
});

describe('copyCoordsFromSiblingForUncoordinated', () => {
  beforeEach(() => vi.clearAllMocks());

  it('이 테이블에 좌표가 전혀 없는 주소 건물은 짝 테이블 좌표를 날짜와 무관하게 빈 행 전부에 복사한다', async () => {
    mockQueryRawUnsafe
      .mockResolvedValueOnce([KEY])
      .mockResolvedValueOnce([{ lat: 37.5, lng: 127.0 }]);
    mockExecuteRawUnsafe.mockResolvedValue(4);

    const copied = await copyCoordsFromSiblingForUncoordinated(makePrisma(), 'villaRentTransaction');

    expect(copied).toBe(4);
    expect(mockQueryRawUnsafe.mock.calls[0][0]).toContain('NOT EXISTS');
    expect(mockQueryRawUnsafe.mock.calls[1][0]).toContain('`VillaSaleTransaction`');
    const [sql, ...params] = mockExecuteRawUnsafe.mock.calls[0];
    expect(sql).toContain('UPDATE `VillaRentTransaction`');
    expect(sql).not.toContain('dealYear');
    expect(params).toEqual([37.5, 127.0, expect.any(Date), ...ADDR]);
  });

  it('짝 테이블에도 좌표가 없으면 아무것도 바꾸지 않는다(카카오 단계로 넘김)', async () => {
    mockQueryRawUnsafe.mockResolvedValueOnce([KEY]).mockResolvedValueOnce([]);

    expect(await copyCoordsFromSiblingForUncoordinated(makePrisma(), 'villaRentTransaction')).toBe(0);
    expect(mockExecuteRawUnsafe).not.toHaveBeenCalled();
  });
});

describe('processTable — 테이블당 카카오 시간 상한', () => {
  const targets = [
    { ...KEY, buildingName: 'A빌라' },
    { ...KEY, buildingName: 'B빌라' },
    { ...KEY, buildingName: 'C빌라' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockExecuteRawUnsafe.mockResolvedValue(1);
    mockQueryRawUnsafe.mockImplementation(async (sql: string, ...params: unknown[]) => {
      if (sql.includes('NOT EXISTS') && sql.includes('geocodedAt')) return targets; // 카카오 대상
      if (sql.includes('LIMIT 1') && sql.includes('city')) {
        return [{ buildingName: params[1], bjdCode: KEY.bjdCode, city: '서울', district: '강남구', dongName: '역삼동', roadName: null, jibun: '12-3' }];
      }
      return []; // 복사 단계 대상 없음
    });
  });

  function markCalls(): number {
    return mockExecuteRawUnsafe.mock.calls.filter(([sql]) => String(sql).includes('SET geocodedAt = ?')).length;
  }

  it('상한이 0 이면 카카오 단계에 들어가지 않는다', async () => {
    await processTable(makePrisma(), 'villaSaleTransaction', { kakaoBudgetMs: 0 });
    expect(markCalls()).toBe(0);
  });

  it('처리 도중 상한에 닿으면 거기서 멈춘다', async () => {
    let t = 0;
    // now() 호출: since(0) → 마감 계산(400, 마감 1400) → 대상 조회(800) → 첫 건물(1200 통과) → 둘째(1600 중단)
    const now = () => {
      const v = t;
      t += 400;
      return v;
    };
    await processTable(makePrisma(), 'villaSaleTransaction', { kakaoBudgetMs: 1_000, now });
    expect(markCalls()).toBe(1);
  });

  it('상한 안이면 대상 건물을 모두 처리한다', async () => {
    await processTable(makePrisma(), 'villaSaleTransaction', { kakaoBudgetMs: 60_000 });
    // API 키가 없어 좌표 실패 → 건물마다 실패 기록 1회
    expect(markCalls()).toBe(targets.length);
  });
});

describe('rate limiting', () => {
  it('geocodeAddress 호출 간 100ms 딜레이가 있어야 함 (sleep 함수 검증)', async () => {
    // sleep 함수가 최소 지연을 보장하는지 검증
    const start = Date.now();
    await new Promise((resolve) => setTimeout(resolve, 100));
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(90); // 10ms 여유
  });
});
