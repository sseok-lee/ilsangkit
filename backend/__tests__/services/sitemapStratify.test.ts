import { describe, it, expect } from 'vitest';
import {
  buildStratifiedIdsSql,
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
