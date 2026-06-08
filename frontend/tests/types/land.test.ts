import { describe, it, expect } from 'vitest';
import { LAND_SLUG, isLandIndexable, pyeongToSqm, formatLandDealDate, formatManwon, formatManwonKorean, type LandRegionSummary } from '~/types/land';

describe('land types', () => {
  it('LAND_SLUG는 land', () => { expect(LAND_SLUG).toBe('land'); });
  it('isLandIndexable: isIndexable 플래그 반영', () => {
    expect(isLandIndexable({ isIndexable: true } as LandRegionSummary)).toBe(true);
    expect(isLandIndexable({ isIndexable: false } as LandRegionSummary)).toBe(false);
  });
  it('pyeongToSqm: 평당 → ㎡당 (정수 반올림), null 통과', () => {
    expect(pyeongToSqm(null)).toBeNull();
    expect(pyeongToSqm(3305)).toBe(1000); // 3305/3.305 = 1000
  });

  describe('formatLandDealDate', () => {
    it('UTC ISO 문자열을 YYYY.MM.DD 형태로 포맷한다', () => {
      expect(formatLandDealDate('2026-04-27T00:00:00.000Z')).toBe('2026.04.27');
    });
    it('null 입력은 "-"를 반환한다', () => {
      expect(formatLandDealDate(null)).toBe('-');
    });
    it('undefined 입력은 "-"를 반환한다', () => {
      expect(formatLandDealDate(undefined)).toBe('-');
    });
    it('빈 문자열 입력은 "-"를 반환한다', () => {
      expect(formatLandDealDate('')).toBe('-');
    });
  });

  describe('formatManwon', () => {
    it('소수 값을 정수로 반올림하여 한국 숫자 포맷으로 반환한다', () => {
      expect(formatManwon(14598.04)).toBe('14,598');
    });
    it('null 입력은 "-"를 반환한다', () => {
      expect(formatManwon(null)).toBe('-');
    });
    it('undefined 입력은 "-"를 반환한다', () => {
      expect(formatManwon(undefined)).toBe('-');
    });
  });

  describe('formatManwonKorean', () => {
    it('2억 4,180만원 — 억+나머지 형태', () => {
      expect(formatManwonKorean(24180)).toBe('2억 4,180만원');
    });
    it('380만원 — 만원만', () => {
      expect(formatManwonKorean(380)).toBe('380만원');
    });
    it('3억원 — 나머지 없을 때 억원만', () => {
      expect(formatManwonKorean(30000)).toBe('3억원');
    });
    it('null → "-"', () => {
      expect(formatManwonKorean(null)).toBe('-');
    });
    it('undefined → "-"', () => {
      expect(formatManwonKorean(undefined)).toBe('-');
    });
  });
});
