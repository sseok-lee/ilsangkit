import { describe, expect, it } from 'vitest';
import {
  classifyAreaBucket,
  trimmedMean,
  calcChangeRatio,
  formatYearMonth,
  shiftMonth,
  isSampleSizeSufficient,
  MIN_SAMPLE_SIZE_FOR_TREND,
} from '../../src/lib/realEstateTrendHelpers.js';

describe('realEstateTrendHelpers', () => {
  describe('classifyAreaBucket', () => {
    it('59㎡대 (<60)', () => {
      expect(classifyAreaBucket(45)).toBe('59㎡대');
      expect(classifyAreaBucket(59.9)).toBe('59㎡대');
    });

    it('84㎡대 (60~89)', () => {
      expect(classifyAreaBucket(60)).toBe('84㎡대');
      expect(classifyAreaBucket(84.9)).toBe('84㎡대');
      expect(classifyAreaBucket(89.9)).toBe('84㎡대');
    });

    it('114㎡대 (90~129)', () => {
      expect(classifyAreaBucket(90)).toBe('114㎡대');
      expect(classifyAreaBucket(114.9)).toBe('114㎡대');
      expect(classifyAreaBucket(129.9)).toBe('114㎡대');
    });

    it('130 이상 → 기타', () => {
      expect(classifyAreaBucket(130)).toBe('기타');
      expect(classifyAreaBucket(200)).toBe('기타');
    });

    it('null/NaN → 기타', () => {
      expect(classifyAreaBucket(null)).toBe('기타');
      expect(classifyAreaBucket(undefined)).toBe('기타');
      expect(classifyAreaBucket(NaN)).toBe('기타');
    });
  });

  describe('trimmedMean', () => {
    it('빈 배열 → null', () => {
      expect(trimmedMean([])).toBeNull();
    });

    it('표본 1개', () => {
      expect(trimmedMean([100])).toBe(100);
    });

    it('상하 10% 기본값으로 trim', () => {
      // 10개에서 양쪽 1개씩 제거 → 8개 평균
      const v = [1, 2, 3, 4, 5, 6, 7, 8, 9, 100];
      // sorted [1..9,100], 양쪽 1 제거 → [2..9] = 44/8 = 5.5
      expect(trimmedMean(v, 0.1)).toBe(5.5);
    });

    it('이상치 제거 효과', () => {
      const normal = [10, 10, 10, 10, 10, 10, 10, 10, 10, 10];
      const withOutlier = [10, 10, 10, 10, 10, 10, 10, 10, 10, 1000];
      // outlier 포함 평균은 109, trimmed는 outlier 제거 후 약 10
      expect(trimmedMean(withOutlier, 0.1)).toBeLessThan(20);
      expect(trimmedMean(normal, 0.1)).toBe(10);
    });

    it('trimRatio가 너무 크면 0.5로 clamp', () => {
      // 10개, ratio=1.0 → 0.5로 clamp → 양쪽 5씩 제거 → 0개 → null
      expect(trimmedMean([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 1.0)).toBeNull();
    });
  });

  describe('calcChangeRatio', () => {
    it('일반 케이스', () => {
      expect(calcChangeRatio(110, 100)).toBeCloseTo(0.1);
      expect(calcChangeRatio(90, 100)).toBeCloseTo(-0.1);
    });

    it('previous null → null', () => {
      expect(calcChangeRatio(110, null)).toBeNull();
      expect(calcChangeRatio(110, undefined)).toBeNull();
    });

    it('previous 0 → null (0으로 나누기 방지)', () => {
      expect(calcChangeRatio(110, 0)).toBeNull();
    });

    it('동일 값 → 0', () => {
      expect(calcChangeRatio(100, 100)).toBe(0);
    });
  });

  describe('formatYearMonth', () => {
    it('한 자리 월에 0 패딩', () => {
      expect(formatYearMonth(2026, 4)).toBe('2026-04');
    });

    it('두 자리 월', () => {
      expect(formatYearMonth(2026, 12)).toBe('2026-12');
    });
  });

  describe('shiftMonth', () => {
    it('한 달 후', () => {
      expect(shiftMonth('2026-04', 1)).toBe('2026-05');
    });

    it('한 달 전', () => {
      expect(shiftMonth('2026-04', -1)).toBe('2026-03');
    });

    it('연도 경계 (12월 + 1)', () => {
      expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    });

    it('연도 경계 (1월 - 1)', () => {
      expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    });

    it('12개월 전', () => {
      expect(shiftMonth('2026-04', -12)).toBe('2025-04');
    });

    it('형식 오류 시 throw', () => {
      expect(() => shiftMonth('invalid', 1)).toThrow();
    });
  });

  describe('isSampleSizeSufficient', () => {
    it(`기본 임계값(${MIN_SAMPLE_SIZE_FOR_TREND}) 이상 true`, () => {
      expect(isSampleSizeSufficient(MIN_SAMPLE_SIZE_FOR_TREND)).toBe(true);
      expect(isSampleSizeSufficient(MIN_SAMPLE_SIZE_FOR_TREND + 100)).toBe(true);
    });

    it('기본 임계값 미만 false', () => {
      expect(isSampleSizeSufficient(MIN_SAMPLE_SIZE_FOR_TREND - 1)).toBe(false);
      expect(isSampleSizeSufficient(0)).toBe(false);
    });
  });
});
