import { describe, it, expect } from 'vitest';
import { FACILITY_GUIDE_TOPICS } from '../../src/data/facilityGuideTopics.js';
import { isGuideCategory } from '../../src/services/articleGenerationCore.js';

describe('FACILITY_GUIDE_TOPICS', () => {
  it('24개 씨앗', () => {
    expect(FACILITY_GUIDE_TOPICS).toHaveLength(24);
  });
  it('모든 category가 유효한 GuideCategory', () => {
    for (const t of FACILITY_GUIDE_TOPICS) {
      expect(isGuideCategory(t.category), `invalid category: ${t.category}`).toBe(true);
    }
  });
  it('articleType은 howto 또는 guide', () => {
    for (const t of FACILITY_GUIDE_TOPICS) {
      expect(['howto', 'guide']).toContain(t.articleType);
    }
  });
  it('빈 시설 10개 카테고리만 포함(부동산/기존 카테고리 제외)', () => {
    const cats = new Set(FACILITY_GUIDE_TOPICS.map((t) => t.category));
    expect([...cats].sort()).toEqual(
      ['aed', 'childcare', 'ev-charger', 'library', 'park', 'parking', 'school', 'sports', 'toilet', 'wifi'].sort()
    );
  });
});
