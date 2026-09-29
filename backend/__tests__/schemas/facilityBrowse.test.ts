import { describe, expect, it } from 'vitest';
import { FacilityBrowseSchema } from '../../src/schemas/facilityBrowse';

describe('FacilityBrowseSchema', () => {
  it('requires both region selectors before any query', () => {
    expect(FacilityBrowseSchema.safeParse({ city: 'seoul' }).success).toBe(false);
    expect(
      FacilityBrowseSchema.parse({ city: 'seoul', district: 'gangnam', keyword: '  역삼  ' }).keyword,
    ).toBe('역삼');
  });

  it('accepts category=subway and rejects unknown categories', () => {
    expect(FacilityBrowseSchema.parse({ city: 'seoul', district: 'gangnam', category: 'subway' }).category).toBe(
      'subway',
    );
    expect(
      FacilityBrowseSchema.safeParse({ city: 'seoul', district: 'gangnam', category: 'unknown' }).success,
    ).toBe(false);
  });

  it('bounds keyword, page, and limit for browse requests', () => {
    expect(
      FacilityBrowseSchema.safeParse({ city: 'seoul', district: 'gangnam', keyword: '가'.repeat(101) }).success,
    ).toBe(false);
    expect(FacilityBrowseSchema.safeParse({ city: 'seoul', district: 'gangnam', page: 0 }).success).toBe(false);
    expect(FacilityBrowseSchema.safeParse({ city: 'seoul', district: 'gangnam', limit: 21 }).success).toBe(false);
  });

  it('deduplicates comma-separated departments and rejects array query values', () => {
    expect(
      FacilityBrowseSchema.parse({
        city: 'seoul',
        district: 'gangnam',
        departments: ' 내과, 소아청소년과, 내과 ,, ',
      }).departments,
    ).toEqual(['내과', '소아청소년과']);
    expect(
      FacilityBrowseSchema.safeParse({ city: ['seoul'], district: 'gangnam' }).success,
    ).toBe(false);
  });
});
