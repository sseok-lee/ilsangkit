import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import {
  exactDealDateFilter,
  getDetailWindow,
  getMarketWindow,
  normalizeExactArea,
} from '../../src/services/realEstateExactFilter.js';

function sqlText(frag: Prisma.Sql): string {
  return frag.strings.join('?');
}

describe('정확한 거래 기간', () => {
  it('KST 자정부터 오늘 포함 30일이다', () => {
    expect(getMarketWindow(new Date('2026-09-20T15:00:00Z'))).toEqual({
      from: '2026-08-23',
      to: '2026-09-21',
    });
  });

  it('KST 자정 직전은 전날 기준 30일이다', () => {
    expect(getMarketWindow(new Date('2026-09-20T14:59:59Z'))).toEqual({
      from: '2026-08-22',
      to: '2026-09-20',
    });
  });

  it('기간 시작일을 월말로 제한한다', () => {
    expect(getDetailWindow(new Date('2026-08-31T03:00:00Z'), 6)).toEqual({
      from: '2026-02-28',
      to: '2026-08-31',
    });
  });

  it('윤년 2월 29일을 상세 기간 시작일로 유지한다', () => {
    expect(getDetailWindow(new Date('2024-08-29T03:00:00Z'), 6)).toEqual({
      from: '2024-02-29',
      to: '2024-08-29',
    });
  });

  it('인접 면적은 합치지 않는다', () => {
    expect(normalizeExactArea('84.9')).toBe('84.90');
    expect(normalizeExactArea('84.91')).not.toBe(normalizeExactArea('84.90'));
    expect(() => normalizeExactArea('84.901')).toThrow();
  });

  it('0 이하와 형식이 깨진 면적은 거부한다', () => {
    expect(() => normalizeExactArea('0')).toThrow(/Invalid exact area/);
    expect(() => normalizeExactArea('-84.90')).toThrow(/Invalid exact area/);
    expect(() => normalizeExactArea('84.')).toThrow(/Invalid exact area/);
    expect(() => normalizeExactArea('100000000.00')).toThrow(/Invalid exact area/);
  });
});

describe('exactDealDateFilter', () => {
  it('월 범위를 정수 조건으로 좁히고 시작·종료일을 바인딩한다', () => {
    const frag = exactDealDateFilter({ from: '2026-08-23', to: '2026-09-21' });

    expect(frag.values).toEqual([
      2026,
      2026,
      8,
      2026,
      2026,
      9,
      '2026-08-23',
      '2026-09-21',
    ]);
    expect(sqlText(frag)).toContain('BETWEEN ? AND ?');
  });

  it('미래 날짜를 종료일 이후 조건으로 제외한다', () => {
    const text = sqlText(exactDealDateFilter({ from: '2026-08-23', to: '2026-09-21' }));

    expect(text).toContain('BETWEEN ? AND ?');
    expect(text).toContain('STR_TO_DATE');
  });

  it('null·0일과 4월 31일 같은 잘못된 달력일은 날짜 생성 전에 제외한다', () => {
    const text = sqlText(exactDealDateFilter({ from: '2026-04-01', to: '2026-04-30' }));

    expect(text).toContain('dealDay IS NOT NULL');
    expect(text).toContain('dealDay >= 1');
    expect(text).toContain("dealDay <= DAY(LAST_DAY(CONCAT(dealYear, '-', LPAD(dealMonth, 2, '0'), '-01')))");
    expect(text).toContain('THEN STR_TO_DATE');
    expect(text).not.toContain('COALESCE');
  });

  it('윤년 2월 29일은 LAST_DAY 기반 검사로 허용한다', () => {
    const text = sqlText(exactDealDateFilter({ from: '2024-02-29', to: '2024-02-29' }, 't'));

    expect(text).toContain("t.dealDay <= DAY(LAST_DAY(CONCAT(t.dealYear, '-', LPAD(t.dealMonth, 2, '0'), '-01')))");
    expect(fragValuesForLeapDay()).toEqual([2024, 2024, 2, 2024, 2024, 2, '2024-02-29', '2024-02-29']);
  });

  it('alias 있으면 allowlist 통과 후 별칭 컬럼을 사용한다', () => {
    const text = sqlText(exactDealDateFilter({ from: '2026-08-23', to: '2026-09-21' }, 't'));

    expect(text).toContain('t.dealYear');
    expect(text).toContain('t.dealMonth');
    expect(text).toContain('t.dealDay');
  });

  it('부정한 alias는 거부한다', () => {
    expect(() => exactDealDateFilter({ from: '2026-08-23', to: '2026-09-21' }, 't; DROP TABLE x')).toThrow(
      /Invalid table alias/,
    );
    expect(() => exactDealDateFilter({ from: '2026-08-23', to: '2026-09-21' }, 't.dealYear')).toThrow(
      /Invalid table alias/,
    );
  });
});

function fragValuesForLeapDay(): unknown[] {
  return exactDealDateFilter({ from: '2024-02-29', to: '2024-02-29' }, 't').values;
}
