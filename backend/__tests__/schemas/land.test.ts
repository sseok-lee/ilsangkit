import { describe, it, expect } from 'vitest';
import {
  LandRegionListSchema,
  LandRegionDetailSchema,
  LandTransactionsSchema,
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

describe('LandTransactionsSchema', () => {
  it('keyword/jimok/landUse를 공백 정규화해서 받는다', () => {
    const r = LandTransactionsSchema.parse({
      bjdCode: '11680',
      dongName: '역삼동',
      keyword: ' 123-4 ',
      jimok: ' 대 ',
      landUse: ' 제2종일반주거지역 ',
      page: '2',
    });

    expect(r.keyword).toBe('123-4');
    expect(r.jimok).toBe('대');
    expect(r.landUse).toBe('제2종일반주거지역');
    expect(r.page).toBe(2);
  });

  it('빈 문자열 필터는 undefined로 정규화한다', () => {
    const r = LandTransactionsSchema.parse({
      bjdCode: '11680',
      dongName: '역삼동',
      keyword: '   ',
      jimok: '',
      landUse: ' ',
    });

    expect(r.keyword).toBeUndefined();
    expect(r.jimok).toBeUndefined();
    expect(r.landUse).toBeUndefined();
  });
});
