import { describe, it, expect } from 'vitest';
import { buildOnDuplicateUpdateClause } from '../../src/services/upsertClause.js';

const SKIP = new Set(['id', 'sourceId', 'viewCount', 'createdAt', 'updatedAt', 'syncedAt']);

describe('buildOnDuplicateUpdateClause', () => {
  it('content 컬럼은 VALUES() 로 갱신한다', () => {
    const sql = buildOnDuplicateUpdateClause(['sourceId', 'name', 'address'], SKIP);
    expect(sql).toContain('`name` = VALUES(`name`)');
    expect(sql).toContain('`address` = VALUES(`address`)');
  });

  it('skip 컬럼은 갱신 대상에서 제외한다', () => {
    const sql = buildOnDuplicateUpdateClause(['sourceId', 'name', 'viewCount', 'createdAt'], SKIP);
    expect(sql).not.toContain('`viewCount` = VALUES');
    expect(sql).not.toContain('`createdAt` = VALUES');
    expect(sql).not.toContain('`sourceId` = VALUES');
  });

  it('syncedAt 은 무조건 NOW() — "마지막으로 확인한 시각"이다', () => {
    const sql = buildOnDuplicateUpdateClause(['sourceId', 'name', 'syncedAt'], SKIP);
    expect(sql).toContain('`syncedAt` = NOW()');
  });
});

describe('buildOnDuplicateUpdateClause — updatedAt 은 실제 내용이 바뀔 때만', () => {
  // 회귀 핵심: 기존 코드는 `updatedAt` = NOW() 를 무조건 찍었다.
  // 값이 하나도 안 바뀐 행도 매 sync 마다 "방금 수정됨"이 되어
  // 사이트맵 lastmod 가 sync 활동을 반영할 뿐 콘텐츠 변경과 무관해졌다.
  //
  // 2026-07-29 프로덕션 사이트맵 실측 — 한 카테고리 안에서 lastmod 고유 날짜 수:
  //   school 64 · aed 43 · toilet 27 · hospital 20 · park 7
  // Google 은 lastmod 가 consistently/verifiably accurate 하지 않으면 무시한다.
  it('updatedAt 은 조건부다 — 무조건 NOW() 가 아니다', () => {
    const sql = buildOnDuplicateUpdateClause(['sourceId', 'name', 'updatedAt'], SKIP);
    expect(sql).toContain('`updatedAt` = IF(');
    expect(sql).not.toMatch(/`updatedAt` = NOW\(\)/);
  });

  it('비교는 NULL-safe 연산자(<=>)를 쓴다 — NULL 비교가 UNKNOWN 이 되면 안 된다', () => {
    const sql = buildOnDuplicateUpdateClause(['sourceId', 'name', 'address', 'updatedAt'], SKIP);
    expect(sql).toContain('`name` <=> VALUES(`name`)');
    expect(sql).toContain('`address` <=> VALUES(`address`)');
  });

  it('변경이 없으면 기존 updatedAt 을 보존한다', () => {
    const sql = buildOnDuplicateUpdateClause(['sourceId', 'name', 'updatedAt'], SKIP);
    // IF(<바뀌었나>, NOW(), 기존값)
    expect(sql).toMatch(/`updatedAt` = IF\(.*NOW\(\), `updatedAt`\)/);
  });

  // ★ 가장 중요한 제약.
  // MySQL 의 ON DUPLICATE KEY UPDATE 는 대입을 좌→우로 평가하고, 우변의 컬럼 참조는
  // "그 시점까지 갱신된 값"을 본다. content 대입이 먼저 실행되면 비교 시점에는 이미
  // `name` = VALUES(`name`) 이 끝나 있어 항상 같다고 판정되고, updatedAt 은 영원히 안 바뀐다.
  it('updatedAt 조건절이 content 대입보다 먼저 온다', () => {
    const sql = buildOnDuplicateUpdateClause(['sourceId', 'name', 'address', 'updatedAt'], SKIP);
    expect(sql.indexOf('`updatedAt` = IF(')).toBeLessThan(sql.indexOf('`name` = VALUES(`name`)'));
    expect(sql.indexOf('`updatedAt` = IF(')).toBeLessThan(sql.indexOf('`address` = VALUES(`address`)'));
  });

  it('비교 대상은 실제로 갱신되는 content 컬럼과 일치한다 — skip 컬럼은 비교하지 않는다', () => {
    const skip = new Set([...SKIP, 'lat', 'lng']);
    const sql = buildOnDuplicateUpdateClause(['sourceId', 'name', 'lat', 'lng', 'updatedAt'], skip);
    expect(sql).toContain('`name` <=> VALUES(`name`)');
    // lat/lng 은 갱신되지 않으므로 변경 판정에도 들어가면 안 된다(항상 같아서 무해하지만,
    // 갱신 대상과 판정 대상이 어긋나면 이후 수정에서 버그가 된다).
    expect(sql).not.toContain('`lat` <=> VALUES(`lat`)');
    expect(sql).not.toContain('`lng` <=> VALUES(`lng`)');
  });
});

describe('buildOnDuplicateUpdateClause — 경계 조건', () => {
  it('갱신할 content 컬럼이 없으면 updatedAt 조건절을 만들지 않는다 (빈 IF 는 문법 오류)', () => {
    const sql = buildOnDuplicateUpdateClause(['sourceId', 'id', 'updatedAt', 'syncedAt'], SKIP);
    expect(sql).not.toContain('`updatedAt` = IF(');
    expect(sql).not.toContain('NOT ()');
    // syncedAt 은 여전히 갱신된다 — 확인은 했으므로.
    expect(sql).toContain('`syncedAt` = NOW()');
  });

  it('updatedAt 컬럼이 데이터에 없으면 절을 만들지 않는다', () => {
    const sql = buildOnDuplicateUpdateClause(['sourceId', 'name'], SKIP);
    expect(sql).not.toContain('updatedAt');
  });

  it('syncedAt 컬럼이 데이터에 없으면 절을 만들지 않는다', () => {
    const sql = buildOnDuplicateUpdateClause(['sourceId', 'name'], SKIP);
    expect(sql).not.toContain('syncedAt');
  });

  it('생성된 절에 빈 항목이나 연속 콤마가 없다', () => {
    for (const cols of [
      ['sourceId', 'name'],
      ['sourceId', 'name', 'updatedAt'],
      ['sourceId', 'name', 'updatedAt', 'syncedAt'],
      ['sourceId', 'updatedAt', 'syncedAt'],
    ]) {
      const sql = buildOnDuplicateUpdateClause(cols, SKIP);
      expect(sql).not.toMatch(/,\s*,/);
      expect(sql.trim()).not.toMatch(/^,|,$/);
    }
  });
});
