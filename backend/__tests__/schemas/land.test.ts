import { describe, it, expect } from 'vitest';
import {
  LandRegionListSchema,
  LandRegionDetailSchema,
} from '../../src/schemas/land.js';

describe('LandRegionListSchema', () => {
  it('기본값 page=1, limit=20 적용', () => {
    const r = LandRegionListSchema.parse({});
    expect(r.page).toBe(1);
    expect(r.limit).toBe(20);
  });

  it('city/district 필터와 페이지 coerce', () => {
    const r = LandRegionListSchema.parse({ city: '서울특별시', district: '강남구', page: '2', limit: '15' });
    expect(r.city).toBe('서울특별시');
    expect(r.district).toBe('강남구');
    expect(r.page).toBe(2);
    expect(r.limit).toBe(15);
  });
});

describe('LandRegionDetailSchema', () => {
  it('bjdCode + dongName 필수', () => {
    expect(() => LandRegionDetailSchema.parse({ dongName: '역삼동' })).toThrow();
    expect(() => LandRegionDetailSchema.parse({ bjdCode: '11680' })).toThrow();
  });

  it('정상 파싱 + months coerce', () => {
    const r = LandRegionDetailSchema.parse({ bjdCode: '11680', dongName: '역삼동', months: '12' });
    expect(r.bjdCode).toBe('11680');
    expect(r.dongName).toBe('역삼동');
    expect(r.months).toBe(12);
    expect(r.page).toBe(1);
  });
});
