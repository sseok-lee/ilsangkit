import { describe, it, expect } from 'vitest';
import { matchCategory } from '../../../src/guideGen/ingest/categoryMatcher.js';

describe('matchCategory', () => {
  it('matches ev-charger when text contains 전기차 충전', () => {
    const result = matchCategory('서울시 전기차 충전소 보조금 발표', '');
    expect(result.category).toBe('ev-charger');
    expect(result.keywords).toContain('전기차 충전');
  });

  it('matches public-rental when text contains 공공임대', () => {
    const result = matchCategory('공공임대 입주자격 변경 안내', '');
    expect(result.category).toBe('public-rental');
  });

  it('returns null category when no keywords match', () => {
    const result = matchCategory('오늘 날씨가 맑습니다', '');
    expect(result.category).toBeNull();
    expect(result.keywords).toEqual([]);
  });

  it('searches both title and excerpt', () => {
    const result = matchCategory('정책 발표', '청약 특별공급 일정 조정');
    expect(result.category).toBe('subscription');
  });

  it('returns the first-priority match when multiple categories hit', () => {
    // 공공임대(public-rental) keyword appears before 청약(subscription) in the registry
    const result = matchCategory(
      'LH 임대 공급과 청약 일정 변경',
      ''
    );
    expect(result.category).toBe('public-rental');
  });
});
