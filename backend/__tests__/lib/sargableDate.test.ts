import { describe, it, expect } from 'vitest';
import { recentMonthsCondition } from '../../src/lib/sargableDate.js';

describe('recentMonthsCondition', () => {
  it('당월 포함 최근 3개월 → 2026-08 기준 cutoff 는 2026-06', () => {
    const r = recentMonthsCondition(3, new Date('2026-08-03T00:00:00Z'));
    expect(r.params).toEqual([2026, 6, 2026]);
  });

  it('연도 경계를 넘어가면 전년으로 롤백한다 — 2026-02 기준 cutoff 2025-12', () => {
    const r = recentMonthsCondition(3, new Date('2026-02-15T00:00:00Z'));
    expect(r.params).toEqual([2025, 12, 2025]);
  });

  it('12개월을 넘어가도 정확하다 — 2026-01 기준 13개월 cutoff 2025-01', () => {
    const r = recentMonthsCondition(13, new Date('2026-01-10T00:00:00Z'));
    expect(r.params).toEqual([2025, 1, 2025]);
  });

  it('컬럼에 연산을 걸지 않는다 (sargable 회귀 방지)', () => {
    const r = recentMonthsCondition(3, new Date('2026-08-03T00:00:00Z'));
    // dealYear * 100 + dealMonth 형태는 운영 실측 5,862ms — 절대 생성되면 안 된다
    expect(r.sql).not.toMatch(/dealYear\s*\*/);
    expect(r.sql).toBe('((dealYear = ? AND dealMonth >= ?) OR dealYear > ?)');
  });

  it('months 가 1 미만이면 던진다', () => {
    expect(() => recentMonthsCondition(0, new Date())).toThrow();
  });
});
