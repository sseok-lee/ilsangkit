import { describe, it, expect } from 'vitest';
import { parseCliOptions, selectQueue } from '../../src/scripts/generateGuideDrafts.js';
import { FACILITY_GUIDE_TOPICS } from '../../src/data/facilityGuideTopics.js';

describe('parseCliOptions', () => {
  it('기본값: limit=24, dryRun=false, onlyMissing=false', () => {
    const o = parseCliOptions([]);
    expect(o.limit).toBe(24);
    expect(o.dryRun).toBe(false);
    expect(o.onlyMissing).toBe(false);
    expect(o.category).toBeUndefined();
  });
  it('--dry-run --only-missing --limit 5 --category parking 파싱', () => {
    const o = parseCliOptions(['--dry-run', '--only-missing', '--limit', '5', '--category', 'parking']);
    expect(o).toMatchObject({ dryRun: true, onlyMissing: true, limit: 5, category: 'parking' });
  });
  it('알 수 없는 category는 throw', () => {
    expect(() => parseCliOptions(['--category', 'nope'])).toThrow();
  });
});

describe('selectQueue', () => {
  it('category 필터 + limit 적용', () => {
    const q = selectQueue(FACILITY_GUIDE_TOPICS, { limit: 2, dryRun: false, onlyMissing: false, category: 'parking' });
    expect(q).toHaveLength(2);
    expect(q.every((t) => t.category === 'parking')).toBe(true);
  });
  it('category 없으면 전체에서 limit', () => {
    const q = selectQueue(FACILITY_GUIDE_TOPICS, { limit: 3, dryRun: false, onlyMissing: false });
    expect(q).toHaveLength(3);
  });
});
