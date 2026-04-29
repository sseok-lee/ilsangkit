import { describe, expect, it } from 'vitest';
import {
  parseKoreanDays,
  calcDDay,
  formatNextDate,
} from '../../src/services/wasteScheduleService.js';

describe('wasteScheduleService — upcoming helpers', () => {
  describe('parseKoreanDays', () => {
    it('단일 요일', () => {
      expect(parseKoreanDays('월')).toEqual([1]);
    });

    it('· 구분자로 여러 요일', () => {
      expect(parseKoreanDays('월·수·금')).toEqual([1, 3, 5]);
    });

    it(', 구분자로 여러 요일', () => {
      expect(parseKoreanDays('화,목')).toEqual([2, 4]);
    });

    it('빈 문자열 → 빈 배열', () => {
      expect(parseKoreanDays('')).toEqual([]);
    });

    it('null / undefined → 빈 배열', () => {
      expect(parseKoreanDays(null)).toEqual([]);
      expect(parseKoreanDays(undefined)).toEqual([]);
    });

    it('일~토 모든 요일을 포함', () => {
      expect(parseKoreanDays('일월화수목금토')).toEqual([0, 1, 2, 3, 4, 5, 6]);
    });
  });

  describe('calcDDay', () => {
    // 2026-04-29는 수요일 (getDay() === 3)
    const wed = new Date(2026, 3, 29);

    it('오늘이 수거일 → 0', () => {
      expect(calcDDay(wed, [3])).toBe(0);
    });

    it('내일(목) → 1', () => {
      expect(calcDDay(wed, [4])).toBe(1);
    });

    it('일요일이 수거일 → 4 (수→목→금→토→일)', () => {
      expect(calcDDay(wed, [0])).toBe(4);
    });

    it('빈 배열 → null', () => {
      expect(calcDDay(wed, [])).toBeNull();
    });

    it('여러 요일 중 가장 가까운 것 선택 (월=5일후, 금=2일후 → 2)', () => {
      expect(calcDDay(wed, [1, 5])).toBe(2);
    });
  });

  describe('formatNextDate', () => {
    const wed = new Date(2026, 3, 29); // 수요일

    it('당일은 "오늘" 라벨', () => {
      expect(formatNextDate(wed, 0)).toBe('오늘 (수)');
    });

    it('1일 후는 "내일" 라벨', () => {
      expect(formatNextDate(wed, 1)).toBe('내일 (목)');
    });

    it('2일 이상은 "M월 D일" 라벨 + 요일', () => {
      expect(formatNextDate(wed, 2)).toBe('5월 1일 (금)');
    });

    it('월 경계 처리', () => {
      const apr30 = new Date(2026, 3, 30);
      expect(formatNextDate(apr30, 1)).toBe('내일 (금)');
    });
  });
});
