import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockQueryRaw } = vi.hoisted(() => ({
  mockQueryRaw: vi.fn(),
}));

vi.mock('../../src/lib/prisma.js', () => ({
  prisma: { $queryRaw: mockQueryRaw },
  default: { $queryRaw: mockQueryRaw },
}));

// 기타 service 의존성은 호출되지 않지만 import 시 필요한 최소 스텁
vi.mock('../../src/services/facilityService.js', () => ({
  getAllIds: vi.fn(),
  getRegionCategoryCombinations: vi.fn(),
}));
vi.mock('../../src/services/wasteScheduleService.js', () => ({
  getAllIds: vi.fn(),
}));
vi.mock('../../src/services/categoryRegistry.js', () => ({
  ALL_CATEGORIES: [],
}));

import { getRealEstateBuildings } from '../../src/services/sitemapService.js';

function flattenSql(call: unknown[]): string {
  // tagged template literal 의 첫 인자는 TemplateStringsArray
  const strings = call[0] as unknown as readonly string[];
  return strings.join('?');
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getRealEstateBuildings', () => {
  it('apt/villa/offitel 세 UNION 블록 모두 HAVING SUM(cnt) >= 10 을 적용한다', async () => {
    mockQueryRaw.mockResolvedValue([]);
    await getRealEstateBuildings();

    const sql = flattenSql(mockQueryRaw.mock.calls[0]);
    const tenMatches = sql.match(/HAVING\s+SUM\(cnt\)\s*>=\s*10/g);
    expect(tenMatches).not.toBeNull();
    expect(tenMatches).toHaveLength(3);
    // 구 임계치가 잔존하지 않음
    expect(sql).not.toMatch(/SUM\(cnt\)\s*>=\s*50/);
  });

  it('3종 부동산 UNION (apt/villa/offitel)을 발행한다', async () => {
    mockQueryRaw.mockResolvedValue([]);
    await getRealEstateBuildings();

    const sql = flattenSql(mockQueryRaw.mock.calls[0]);
    expect(sql).toContain("'apt' AS propertyType");
    expect(sql).toContain("'villa' AS propertyType");
    expect(sql).toContain("'offitel' AS propertyType");
    expect(sql.match(/UNION ALL/g)?.length).toBeGreaterThanOrEqual(5); // 외부 3-1 + 내부 3 = 6
  });

  it('buildingName 품질 필터(길이/지번 폴백/숫자-only)를 포함한다', async () => {
    mockQueryRaw.mockResolvedValue([]);
    await getRealEstateBuildings();

    const sql = flattenSql(mockQueryRaw.mock.calls[0]);
    // 6개 raw select 블록 전부에 동일 필터가 들어있어야 함
    const charLenMatches = sql.match(/CHAR_LENGTH\(buildingName\)\s*>=\s*2/g);
    expect(charLenMatches?.length).toBe(6);

    const parenGuardMatches = sql.match(/buildingName\s+NOT\s+REGEXP\s+'\^\[\[:space:\]\]\*\[\(\]'/g);
    expect(parenGuardMatches?.length).toBe(6);

    const numericOnlyMatches = sql.match(/buildingName\s+NOT\s+REGEXP\s+'\^\[0-9\(\)\[:space:\]-\]\+\$'/g);
    expect(numericOnlyMatches?.length).toBe(6);
  });

  it('기본 buildingName NOT NULL / != "" 조건도 유지된다', async () => {
    mockQueryRaw.mockResolvedValue([]);
    await getRealEstateBuildings();

    const sql = flattenSql(mockQueryRaw.mock.calls[0]);
    const notNullMatches = sql.match(/buildingName\s+IS\s+NOT\s+NULL/g);
    expect(notNullMatches?.length).toBe(6);
    const notEmptyMatches = sql.match(/buildingName\s*!=\s*''/g);
    expect(notEmptyMatches?.length).toBe(6);
  });
});
