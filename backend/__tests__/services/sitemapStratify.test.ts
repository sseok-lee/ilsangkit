import { describe, it, expect } from 'vitest';
import {
  buildStratifiedIdsSql,
  buildCanonicalDedupeWhere,
  buildDedupedIdsSql,
  buildDedupedCountSql,
  SITEMAP_STRATIFY_TABLES,
} from '../../src/services/sitemapStratify.js';

describe('buildStratifiedIdsSql — 층화 선택', () => {
  it('city·district 로 파티션한 ROW_NUMBER 를 쓴다', () => {
    const sql = buildStratifiedIdsSql('Childcare');
    expect(sql).toContain('ROW_NUMBER() OVER (PARTITION BY city, district');
  });

  // ★ 가장 중요한 규칙.
  // ORDER BY rn 이 먼저여야 "각 구·군의 1번째 → 각 구·군의 2번째 → …" 순으로 뽑혀
  // LIMIT 이 걸려도 모든 지역이 고르게 포함된다.
  // id 순으로만 정렬하면 지역코드 오름차순이 되어 앞 지역이 상한을 다 먹는다 —
  // 실제로 그래서 childcare 사이트맵 15,000개가 지역코드 5개(11·12·26·27·28)만
  // 담고 있었고, 29(광주) 이후 13개 시·도가 통째로 빠져 있었다.
  it('rn 을 id 보다 먼저 정렬한다 (지역 라운드로빈)', () => {
    const sql = buildStratifiedIdsSql('Childcare');
    expect(sql).toMatch(/ORDER BY\s+rn,\s*id/);
  });

  it('파티션 내부는 id 로 정렬해 결정론을 보장한다', () => {
    const sql = buildStratifiedIdsSql('Childcare');
    expect(sql).toContain('ORDER BY id) AS rn');
  });

  it('LIMIT 은 파라미터 바인딩이다 — 값 보간 금지', () => {
    const sql = buildStratifiedIdsSql('Childcare');
    expect(sql).toContain('LIMIT ?');
    expect(sql).not.toMatch(/LIMIT\s+\d/);
  });

  it('updatedAt 을 함께 반환한다 (사이트맵 lastmod 용)', () => {
    expect(buildStratifiedIdsSql('Childcare')).toContain('updatedAt');
  });

  it('테이블명이 백틱으로 감싸인다', () => {
    expect(buildStratifiedIdsSql('Childcare')).toContain('`Childcare`');
  });
});

describe('buildStratifiedIdsSql — ev-charger 충전소 단위', () => {
  // EvCharger 는 행이 커넥터 단위(492,672)라 statId 로 묶어야 충전소 단위(97,785)가 된다.
  // 기존 코드는 Prisma 의 `distinct: ['statId']` 를 썼는데, 그건 앱 메모리에서 처리돼
  // 대량 테이블에서 위험하다 — 이 프로젝트에서 야간 지오코딩 OOM(2.07GB)을 낸 바로 그 패턴이다.
  // GROUP BY 로 DB 안에서 접으면 그 지뢰도 함께 사라진다.
  it('statId 로 GROUP BY 한다', () => {
    const sql = buildStratifiedIdsSql('EvCharger', { groupByStationId: true });
    expect(sql).toContain('GROUP BY statId');
    expect(sql).toContain('statId AS id');
  });

  it('statId 가 NULL 인 행은 제외한다', () => {
    const sql = buildStratifiedIdsSql('EvCharger', { groupByStationId: true });
    expect(sql).toContain('WHERE statId IS NOT NULL');
  });

  it('그룹 대표 updatedAt 은 MAX 를 쓴다 — 충전소의 최신 변경 시각', () => {
    const sql = buildStratifiedIdsSql('EvCharger', { groupByStationId: true });
    expect(sql).toContain('MAX(updatedAt)');
  });

  it('그룹핑 모드에서도 rn 우선 정렬을 유지한다', () => {
    const sql = buildStratifiedIdsSql('EvCharger', { groupByStationId: true });
    expect(sql).toMatch(/ORDER BY\s+rn,\s*id/);
  });

  it('일반 모드에서는 GROUP BY 를 넣지 않는다', () => {
    expect(buildStratifiedIdsSql('Childcare')).not.toContain('GROUP BY');
  });
});

describe('SITEMAP_STRATIFY_TABLES — SQL 안전', () => {
  // 테이블명은 raw SQL 에 보간되므로 반드시 고정 화이트리스트에서만 온다.
  it('상한이 걸린 카테고리를 모두 포함한다', () => {
    for (const cat of ['childcare', 'aed', 'sports', 'clothes', 'ev-charger']) {
      expect(SITEMAP_STRATIFY_TABLES[cat]).toBeTruthy();
    }
  });

  it('모든 값이 영문자만으로 된 테이블명이다', () => {
    for (const table of Object.values(SITEMAP_STRATIFY_TABLES)) {
      expect(table).toMatch(/^[A-Za-z]+$/);
    }
  });

  it('화이트리스트 밖 카테고리는 undefined — 호출부가 기존 경로로 폴백한다', () => {
    expect(SITEMAP_STRATIFY_TABLES['wifi-detail']).toBeUndefined();
    expect(SITEMAP_STRATIFY_TABLES['../etc/passwd']).toBeUndefined();
  });
});

describe('중복 통합 대표행 선별 (rel=canonical 대상 제외)', () => {
  const AED_COLUMNS = ['name', 'city', 'district', 'address', 'roadAddress', 'buildPlace', 'org'];

  // 다른 URL 로 canonical 되는 페이지를 사이트맵에 광고하면 안 된다 —
  // 사이트맵은 "200 · 색인가능 · 자기참조 canonical" URL 만 담는 자리다.
  it('NOT EXISTS 로 자기보다 작은 id 의 동일 형제가 있는 행을 뺀다', () => {
    const where = buildCanonicalDedupeWhere('Aed', AED_COLUMNS, 't0');
    expect(where).toContain('WHERE NOT EXISTS');
    expect(where).toContain('s.id < t0.id');
  });

  // ★ NULL-safe equality. `=` 로 쓰면 address 가 NULL 인 형제끼리 매칭되지 않아
  // 중복이 그대로 남는다 (MySQL 의 NULL = NULL 은 NULL).
  it('모든 키 비교가 `<=>` (NULL-safe) 다', () => {
    const where = buildCanonicalDedupeWhere('Aed', AED_COLUMNS, 't0');
    for (const col of AED_COLUMNS) {
      expect(where).toContain(`s.\`${col}\` <=> t0.\`${col}\``);
    }
    // id 비교(<)를 제외하면 `=` 단독 비교가 남아 있으면 안 된다
    expect(where).not.toMatch(/[^<>]=[^>]/);
  });

  // 컬럼명도 테이블명과 똑같이 raw SQL 에 보간된다.
  it('컬럼명 화이트리스트를 벗어나면 throw 한다 (SQL 인젝션 차단)', () => {
    expect(() => buildCanonicalDedupeWhere('Aed', ['name; DROP TABLE Aed'], 't0')).toThrow();
    expect(() => buildCanonicalDedupeWhere('Aed', ['`name`'], 't0')).toThrow();
    expect(() => buildCanonicalDedupeWhere('Aed', [], 't0')).toThrow();
  });

  // ★ 가장 중요한 규칙.
  // 상한 바깥에서 거르면 aed 15,000 이 "15,000 뽑고 그중 비대표를 뺀" 수가 되어 줄어들고,
  // regen-sitemaps.yml 의 파일별 20% count-drop 가드가 교체를 거부한다.
  it('층화 SQL 에서 dedupe 는 ROW_NUMBER·LIMIT 안쪽에 들어간다', () => {
    const sql = buildStratifiedIdsSql('Aed', { dedupeGroupColumns: AED_COLUMNS });
    const notExistsAt = sql.indexOf('NOT EXISTS');
    const rowNumberAt = sql.indexOf('ROW_NUMBER()');
    const limitAt = sql.indexOf('LIMIT ?');
    expect(notExistsAt).toBeGreaterThan(rowNumberAt);
    expect(notExistsAt).toBeLessThan(limitAt);
    expect(sql).toMatch(/ORDER BY\s+rn,\s*id/);
  });

  it('dedupeGroupColumns 를 주지 않으면 SQL 이 그대로다 (비참여 카테고리 무영향)', () => {
    expect(buildStratifiedIdsSql('Childcare')).toBe(
      buildStratifiedIdsSql('Childcare', { dedupeGroupColumns: [] })
    );
    expect(buildStratifiedIdsSql('Childcare')).not.toContain('NOT EXISTS');
  });

  it('ev-charger 그룹핑 경로는 dedupe 를 적용하지 않는다', () => {
    const sql = buildStratifiedIdsSql('EvCharger', {
      groupByStationId: true,
      dedupeGroupColumns: AED_COLUMNS,
    });
    expect(sql).not.toContain('NOT EXISTS');
    expect(sql).toContain('GROUP BY statId');
  });

  it('상한 없는 경로(parking)는 대표행의 id·updatedAt 만 뽑는다', () => {
    const sql = buildDedupedIdsSql('Parking', ['name', 'city']);
    expect(sql).toContain('SELECT id, updatedAt FROM `Parking` t0');
    expect(sql).toContain('NOT EXISTS');
    expect(sql).not.toContain('LIMIT');
  });

  // 인덱스와 청크가 다른 모수를 쓰면 광고만 되고 비어 있는 청크가 생기고,
  // 그건 fail-closed 503 으로 사이트맵 재생성을 막는다.
  it('COUNT 도 같은 술어를 쓴다 — 인덱스와 청크의 모수 일치', () => {
    const countSql = buildDedupedCountSql('Parking', ['name', 'city']);
    expect(countSql).toContain('COUNT(*) AS cnt');
    expect(countSql).toContain(buildCanonicalDedupeWhere('Parking', ['name', 'city'], 't0'));
  });
});
