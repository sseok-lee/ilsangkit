import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Prisma mock ────────────────────────────────────────────────────────────
const { mockQueryRawUnsafe } = vi.hoisted(() => ({
  mockQueryRawUnsafe: vi.fn(),
}));

vi.mock('../../src/lib/prisma.js', () => {
  const prismaClient = {
    // searchComplexesByKeyword는 summary 테이블을 raw SQL(paginated + COUNT)로 조회한다.
    $queryRawUnsafe: mockQueryRawUnsafe,
  };
  return { default: prismaClient, prisma: prismaClient };
});

// ─── Parser region index mock — DB 의존 제거 ────────────────────────────────
vi.mock('../../src/services/search/searchRegionIndex.js', async (orig) => {
  const actual = await orig() as typeof import('../../src/services/search/searchRegionIndex.js');
  return {
    ...actual,
    getRegionIndex: async () =>
      actual.buildRegionIndex([
        { city: '서울특별시', district: '강남구' },
        { city: '부산광역시', district: '해운대구' },
      ]),
  };
});

import { searchComplexesByKeyword } from '../../src/services/realEstateService.js';

// SELECT(paginated) 호출을 찾아 SQL + 바인딩 파라미터를 돌려준다.
function selectCall() {
  const call = mockQueryRawUnsafe.mock.calls.find((c) =>
    String(c[0]).includes('ORDER BY transactionCount'),
  );
  return { sql: String(call?.[0] ?? ''), params: (call ?? []).slice(1) };
}

beforeEach(() => {
  vi.clearAllMocks();
  // COUNT은 total 0, SELECT는 빈 배열이 기본값 — 명시 안 하면 DB-free.
  mockQueryRawUnsafe.mockImplementation((sql: string) => {
    if (String(sql).includes('COUNT(*)')) return Promise.resolve([{ total: 0n }]);
    return Promise.resolve([]);
  });
});

describe('searchComplexesByKeyword (드릴다운 지역 해석)', () => {
  it('(a) 지역 키워드는 지역 WHERE 절을 만들고 buildingName LIKE는 없다', async () => {
    await searchComplexesByKeyword('apt-sale', '강남');
    const { sql, params } = selectCall();
    // 지역 스코프 — city IN + district = ? 주입
    expect(sql).toContain('city IN');
    expect(sql).toContain('district = ?');
    // 이름 필터(LIKE)는 없어야 한다 — 지역 키워드를 건물명으로 오해하지 않음
    expect(sql).not.toContain('buildingName LIKE');
    // type이 첫 파라미터, district '강남구'가 바인딩됨
    expect(params[0]).toBe('apt-sale');
    expect(params).toContain('강남구');
  });

  it('(b) 건물명 키워드는 buildingName LIKE CONCAT(?, \'%\') 절을 만든다', async () => {
    await searchComplexesByKeyword('apt-sale', '래미안');
    const { sql, params } = selectCall();
    expect(sql).toContain("buildingName LIKE CONCAT(?, '%')");
    // 순수 이름이므로 지역 절은 없어야 한다
    expect(sql).not.toContain('city IN');
    expect(sql).not.toContain('district = ?');
    expect(params).toContain('래미안');
  });

  it('(c) 지역도 이름도 아니면 DB 접근 없이 빈 결과를 반환한다', async () => {
    const res = await searchComplexesByKeyword('apt-sale', '화장실');
    expect(res).toEqual({ items: [], total: 0, page: 1, totalPages: 0 });
    expect(mockQueryRawUnsafe).not.toHaveBeenCalled();
  });

  it('SQL은 파라미터 바인딩만 사용한다 (인젝션 안전, type=?)', async () => {
    await searchComplexesByKeyword('apt-sale', '강남 래미안');
    const { sql, params } = selectCall();
    expect(sql).toContain('type = ?');
    // 지역 + 이름 둘 다: district = ? AND buildingName LIKE
    expect(sql).toContain('district = ?');
    expect(sql).toContain("buildingName LIKE CONCAT(?, '%')");
    expect(params).toContain('apt-sale');
    expect(params).toContain('강남구');
    expect(params).toContain('래미안');
  });

  it('행을 ComplexListResult shape으로 매핑하고 totalPages를 계산한다', async () => {
    mockQueryRawUnsafe.mockImplementation((sql: string) => {
      if (String(sql).includes('COUNT(*)')) return Promise.resolve([{ total: 42n }]);
      return Promise.resolve([{
        buildingName: '래미안강남', bjdCode: '11680', city: '서울', district: '강남구',
        dongName: '역삼동', transactionCount: 12, latestPrice: 150000n,
        latestDealYear: 2026, latestDealMonth: 5, buildYear: 2010, lat: '37.5', lng: '127.0',
      }]);
    });
    const res = await searchComplexesByKeyword('apt-sale', '강남', 1, 20);
    expect(res.total).toBe(42);
    expect(res.page).toBe(1);
    expect(res.totalPages).toBe(3); // ceil(42/20)
    expect(res.items[0]).toMatchObject({
      buildingName: '래미안강남', bjdCode: '11680', city: '서울', district: '강남구',
      dongName: '역삼동', transactionCount: 12, latestPrice: 150000,
      lat: 37.5, lng: 127.0, lastDealYear: 2026, lastDealMonth: 5, buildYear: 2010,
    });
  });

  it('알 수 없는 type이면 에러를 던진다', async () => {
    await expect(searchComplexesByKeyword('bogus-type', '강남')).rejects.toThrow(/Unknown real estate type/);
  });
});
