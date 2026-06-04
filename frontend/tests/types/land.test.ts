import { describe, it, expect } from 'vitest';
import { LAND_SLUG, isLandIndexable, pyeongToSqm, type LandRegionSummary } from '~/types/land';

describe('land types', () => {
  it('LAND_SLUG는 land', () => { expect(LAND_SLUG).toBe('land'); });
  it('isLandIndexable: isIndexable 플래그 반영', () => {
    expect(isLandIndexable({ isIndexable: true } as LandRegionSummary)).toBe(true);
    expect(isLandIndexable({ isIndexable: false } as LandRegionSummary)).toBe(false);
  });
  it('pyeongToSqm: 평당 → ㎡당 (÷3.305, 2자리 반올림), null 통과', () => {
    expect(pyeongToSqm(null)).toBeNull();
    expect(pyeongToSqm(3305)).toBe(1000); // 3305/3.305 = 1000
  });
});
