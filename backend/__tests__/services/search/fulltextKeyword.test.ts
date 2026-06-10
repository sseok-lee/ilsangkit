import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockQueryRawUnsafe } = vi.hoisted(() => ({ mockQueryRawUnsafe: vi.fn() }));
vi.mock('../../../src/lib/prisma.js', () => {
  const prismaClient = { $queryRawUnsafe: mockQueryRawUnsafe };
  return { default: prismaClient, prisma: prismaClient };
});

import {
  canUseFulltext, toBooleanPhrase, fulltextIds, fulltextCount, FULLTEXT_TABLES,
} from '../../../src/services/search/fulltextKeyword.js';
import { cityVariantList } from '../../../src/services/cityMapping.js';

beforeEach(() => { vi.clearAllMocks(); });

describe('canUseFulltext', () => {
  it('2자 이상이면 true, 미만/빈값이면 false (ngram_token_size=2)', () => {
    expect(canUseFulltext('래미안')).toBe(true);
    expect(canUseFulltext('강')).toBe(false);
    expect(canUseFulltext('')).toBe(false);
    expect(canUseFulltext(undefined)).toBe(false);
  });

  it('연산자만 있는 키워드는 false (cleaned 후 빈 문자열)', () => {
    expect(canUseFulltext('+-')).toBe(false);
  });
});

describe('toBooleanPhrase', () => {
  it('BOOLEAN MODE 연산자를 제거하고 구문 검색으로 감싼다', () => {
    expect(toBooleanPhrase('래미안')).toBe('"래미안"');
    expect(toBooleanPhrase('강남+화장실*')).toBe('"강남 화장실"');
    expect(toBooleanPhrase('  "test"  ')).toBe('"test"');
  });

  it('연산자만 입력하면 빈 구문을 반환한다', () => {
    expect(toBooleanPhrase('+-><')).toBe('""');
  });
});

describe('fulltextIds', () => {
  it('MATCH AGAINST 쿼리로 id 목록을 반환한다', async () => {
    mockQueryRawUnsafe.mockResolvedValue([{ id: 'A1' }, { id: 'B7' }]);
    const ids = await fulltextIds('Toilet', '래미안', {}, 3);
    expect(ids).toEqual(['A1', 'B7']);
    const [sql, ...params] = mockQueryRawUnsafe.mock.calls[0];
    expect(sql).toContain('MATCH(name, address, roadAddress) AGAINST (? IN BOOLEAN MODE)');
    expect(params[0]).toBe('"래미안"');
  });

  it('지역 필터가 있으면 city IN / district 조건을 붙인다', async () => {
    mockQueryRawUnsafe.mockResolvedValue([]);
    await fulltextIds('Toilet', '래미안', { cityVariants: ['서울특별시', '서울'], district: '강남구' }, 3);
    const [sql, ...params] = mockQueryRawUnsafe.mock.calls[0];
    expect(sql).toContain('city IN (?, ?)');
    expect(sql).toContain('district = ?');
    expect(params).toContain('강남구');
  });

  it('화이트리스트에 없는 테이블이면 throw', async () => {
    await expect(fulltextIds('Users; DROP', '래미안', {}, 3)).rejects.toThrow();
  });
});

describe('fulltextCount', () => {
  it('COUNT 결과(BigInt)를 number로 반환한다', async () => {
    mockQueryRawUnsafe.mockResolvedValue([{ cnt: 42n }]);
    const count = await fulltextCount('Toilet', '래미안', {});
    expect(count).toBe(42);
  });
});

describe('FULLTEXT_TABLES', () => {
  it('13개 일반 시설 카테고리를 커버한다 (ev-charger·trash는 별도 경로)', () => {
    expect(Object.keys(FULLTEXT_TABLES)).toHaveLength(13);
    expect(FULLTEXT_TABLES.toilet).toBe('Toilet');
  });
});

describe('cityVariantList', () => {
  it('축약/정식 양쪽 variant를 반환한다', () => {
    const v = cityVariantList('서울');
    expect(v).toContain('서울');
    expect(v).toContain('서울특별시');
  });
  it('미등록 도시는 그대로 1개', () => {
    expect(cityVariantList('미지의도시')).toEqual(['미지의도시']);
  });
  it('없으면 빈 배열', () => {
    expect(cityVariantList(undefined)).toEqual([]);
  });
});
