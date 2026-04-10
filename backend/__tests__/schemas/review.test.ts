import { describe, it, expect } from 'vitest';
import {
  CreateReviewSchema,
  FacilityReviewsParamsSchema,
} from '../../src/schemas/review';

describe('ReviewCategorySchema', () => {
  // 기존 시설 카테고리
  const EXISTING_CATEGORIES = [
    'toilet', 'wifi', 'clothes', 'parking', 'aed', 'library',
    'hospital', 'pharmacy', 'park', 'school', 'market', 'trash',
  ];

  // 누락된 시설 카테고리
  const MISSING_FACILITY_CATEGORIES = ['childcare', 'ev-charger', 'sports'];

  // 부동산 카테고리
  const REAL_ESTATE_CATEGORIES = ['apt', 'villa', 'offitel'];

  it.each(EXISTING_CATEGORIES)('기존 카테고리 %s를 허용해야 한다', (category) => {
    const result = CreateReviewSchema.parse({
      facilityCategory: category,
      facilityId: 'test-id',
      nickname: '테스트',
      password: '123456',
      content: '좋아요',
    });
    expect(result.facilityCategory).toBe(category);
  });

  it.each(MISSING_FACILITY_CATEGORIES)('누락된 시설 카테고리 %s를 허용해야 한다', (category) => {
    const result = CreateReviewSchema.parse({
      facilityCategory: category,
      facilityId: 'test-id',
      nickname: '테스트',
      password: '123456',
      content: '좋아요',
    });
    expect(result.facilityCategory).toBe(category);
  });

  it.each(REAL_ESTATE_CATEGORIES)('부동산 카테고리 %s를 허용해야 한다', (category) => {
    const result = CreateReviewSchema.parse({
      facilityCategory: category,
      facilityId: 'test-building',
      nickname: '테스트',
      password: '123456',
      content: '좋아요',
    });
    expect(result.facilityCategory).toBe(category);
  });

  it('존재하지 않는 카테고리는 거부해야 한다', () => {
    expect(() => CreateReviewSchema.parse({
      facilityCategory: 'invalid',
      facilityId: 'test-id',
      nickname: '테스트',
      password: '123456',
      content: '좋아요',
    })).toThrow();
  });

  it('FacilityReviewsParamsSchema에서도 부동산 카테고리를 허용해야 한다', () => {
    const result = FacilityReviewsParamsSchema.parse({
      category: 'apt',
      id: 'some-building',
    });
    expect(result.category).toBe('apt');
  });
});
