import { describe, it, expect } from 'vitest';
import { Prisma } from '@prisma/client';
import { dealDateRangeFilter } from '../../src/services/realEstateDateFilter.js';

// Prisma.sql 조각의 텍스트를 재구성 (values 는 ? 자리표시)
function sqlText(frag: Prisma.Sql): string {
  return frag.strings.join('?');
}

describe('dealDateRangeFilter', () => {
  it('같은 달: 정수 경계 + STR_TO_DATE 잔여를 모두 포함', () => {
    const frag = dealDateRangeFilter('2026-07-02', '2026-07-08');
    const text = sqlText(frag);
    expect(text).toContain('dealYear');
    expect(text).toContain('dealMonth');
    expect(text).toContain('STR_TO_DATE');
    // 바인딩: fy, fy, fm, ty, ty, tm, from, to (각 년월이 OR 조건에서 두 번씩 사용)
    expect(frag.values).toEqual([2026, 2026, 7, 2026, 2026, 7, '2026-07-02', '2026-07-08']);
  });

  it('월 경계: from=6월 to=7월 의 정수 경계', () => {
    const frag = dealDateRangeFilter('2026-06-28', '2026-07-04');
    expect(frag.values).toEqual([2026, 2026, 6, 2026, 2026, 7, '2026-06-28', '2026-07-04']);
  });

  it('연말 경계: from=2025-12 to=2026-01', () => {
    const frag = dealDateRangeFilter('2025-12-28', '2026-01-03');
    expect(frag.values).toEqual([2025, 2025, 12, 2026, 2026, 1, '2025-12-28', '2026-01-03']);
  });

  it('alias 있으면 t.dealYear 형태로 컬럼 참조', () => {
    const text = sqlText(dealDateRangeFilter('2026-07-02', '2026-07-08', 't'));
    expect(text).toContain('t.dealYear');
    expect(text).toContain('t.dealMonth');
    expect(text).toContain('t.dealDay');
  });

  it('alias 없으면 접두사 없는 컬럼', () => {
    const text = sqlText(dealDateRangeFilter('2026-07-02', '2026-07-08'));
    expect(text).toContain('dealYear');
    expect(text).not.toContain('t.dealYear');
  });

  it('부정한 alias는 거부한다 (injection 방어)', () => {
    expect(() => dealDateRangeFilter('2026-07-02', '2026-07-08', 't; DROP TABLE x')).toThrow(/Invalid table alias/);
    expect(() => dealDateRangeFilter('2026-07-02', '2026-07-08', 't.dealYear')).toThrow(/Invalid table alias/);
  });

  it('유효한 alias와 alias 없음은 그대로 동작', () => {
    expect(() => dealDateRangeFilter('2026-07-02', '2026-07-08', 't')).not.toThrow();
    expect(() => dealDateRangeFilter('2026-07-02', '2026-07-08')).not.toThrow();
  });
});
