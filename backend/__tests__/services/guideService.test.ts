import { describe, it, expect } from 'vitest';
import { serializeGuide } from '../../src/services/guideService.js';

describe('serializeGuide publishedAt fallback', () => {
  it('publishedAt이 null이면 createdAt으로 폴백', () => {
    const created = new Date('2026-01-02T03:04:05Z');
    const out = serializeGuide({ id: 'g1', publishedAt: null, createdAt: created });
    expect(out.publishedAt).toEqual(created);
  });
  it('publishedAt이 있으면 그대로 유지', () => {
    const created = new Date('2026-01-02T03:04:05Z');
    const published = new Date('2026-03-04T05:06:07Z');
    const out = serializeGuide({ id: 'g1', publishedAt: published, createdAt: created });
    expect(out.publishedAt).toEqual(published);
  });
});
