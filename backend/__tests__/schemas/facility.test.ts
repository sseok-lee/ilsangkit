// @TASK T0.5.2 - 시설 스키마 테스트
// @TEST backend/__tests__/schemas/facility.test.ts

import { describe, it, expect } from 'vitest';
import {
  FacilityCategorySchema,
  FacilitySearchSchema,
  FacilityDetailParamsSchema,
  RegionFacilitiesParamsSchema,
  NearbyFacilitiesSchema,
} from '../../src/schemas/facility';

describe('FacilityCategorySchema', () => {
  it('유효한 카테고리를 파싱해야 한다', () => {
    const categories = ['toilet', 'trash', 'wifi', 'clothes', 'battery', 'kiosk'];
    categories.forEach((cat) => {
      expect(FacilityCategorySchema.parse(cat)).toBe(cat);
    });
  });

  it('유효하지 않은 카테고리는 실패해야 한다', () => {
    expect(() => FacilityCategorySchema.parse('invalid')).toThrow();
    expect(() => FacilityCategorySchema.parse('')).toThrow();
  });
});

describe('FacilitySearchSchema', () => {
  it('빈 객체에 기본값이 적용되어야 한다', () => {
    const result = FacilitySearchSchema.parse({});
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
  });

  it('모든 필드가 유효하면 성공해야 한다', () => {
    const input = {
      keyword: '화장실',
      category: 'toilet',
      lat: 37.5665,
      lng: 126.978,
      radius: 2000,
      city: '서울특별시',
      district: '중구',
      page: 1,
      limit: 10,
    };
    const result = FacilitySearchSchema.parse(input);
    expect(result).toEqual(input);
  });

  it('lat만 있고 lng가 없으면 실패해야 한다', () => {
    expect(() => FacilitySearchSchema.parse({ lat: 37.5665 })).toThrow();
  });

  it('lng만 있고 lat가 없으면 실패해야 한다', () => {
    expect(() => FacilitySearchSchema.parse({ lng: 126.978 })).toThrow();
  });

  it('lat와 lng가 둘 다 있으면 성공해야 한다', () => {
    const result = FacilitySearchSchema.parse({ lat: 37.5665, lng: 126.978 });
    expect(result.lat).toBe(37.5665);
    expect(result.lng).toBe(126.978);
  });

  it('lat와 lng가 둘 다 없으면 성공해야 한다', () => {
    const result = FacilitySearchSchema.parse({});
    expect(result.lat).toBeUndefined();
    expect(result.lng).toBeUndefined();
  });

  it('keyword가 100자를 초과하면 실패해야 한다', () => {
    const longKeyword = 'a'.repeat(101);
    expect(() => FacilitySearchSchema.parse({ keyword: longKeyword })).toThrow();
  });

  it('빈 keyword는 실패해야 한다', () => {
    expect(() => FacilitySearchSchema.parse({ keyword: '' })).toThrow();
  });

  it('문자열 숫자가 변환되어야 한다', () => {
    const result = FacilitySearchSchema.parse({
      lat: '37.5665',
      lng: '126.978',
      page: '2',
      limit: '30',
    });
    expect(result.lat).toBe(37.5665);
    expect(result.lng).toBe(126.978);
    expect(result.page).toBe(2);
    expect(result.limit).toBe(30);
  });
});

describe('FacilityDetailParamsSchema', () => {
  it('유효한 파라미터를 파싱해야 한다', () => {
    const result = FacilityDetailParamsSchema.parse({
      category: 'toilet',
      id: 'facility-123',
    });
    expect(result).toEqual({ category: 'toilet', id: 'facility-123' });
  });

  it('유효하지 않은 카테고리는 실패해야 한다', () => {
    expect(() =>
      FacilityDetailParamsSchema.parse({ category: 'invalid', id: '123' })
    ).toThrow();
  });

  it('빈 ID는 실패해야 한다', () => {
    expect(() =>
      FacilityDetailParamsSchema.parse({ category: 'toilet', id: '' })
    ).toThrow();
  });
});

describe('RegionFacilitiesParamsSchema', () => {
  it('유효한 파라미터를 파싱해야 한다', () => {
    const result = RegionFacilitiesParamsSchema.parse({
      city: '서울특별시',
      district: '강남구',
      category: 'wifi',
    });
    expect(result).toEqual({
      city: '서울특별시',
      district: '강남구',
      category: 'wifi',
    });
  });

  it('빈 city는 실패해야 한다', () => {
    expect(() =>
      RegionFacilitiesParamsSchema.parse({
        city: '',
        district: '강남구',
        category: 'wifi',
      })
    ).toThrow();
  });

  it('빈 district는 실패해야 한다', () => {
    expect(() =>
      RegionFacilitiesParamsSchema.parse({
        city: '서울특별시',
        district: '',
        category: 'wifi',
      })
    ).toThrow();
  });
});

describe('NearbyFacilitiesSchema', () => {
  it('필수 필드만으로 성공해야 한다', () => {
    const result = NearbyFacilitiesSchema.parse({
      lat: 37.5665,
      lng: 126.978,
    });
    expect(result.lat).toBe(37.5665);
    expect(result.lng).toBe(126.978);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
  });

  it('모든 필드가 있으면 성공해야 한다', () => {
    const input = {
      lat: 37.5665,
      lng: 126.978,
      radius: 5000,
      category: 'toilet',
      page: 2,
      limit: 50,
    };
    const result = NearbyFacilitiesSchema.parse(input);
    expect(result).toEqual(input);
  });

  it('lat가 없으면 실패해야 한다', () => {
    expect(() => NearbyFacilitiesSchema.parse({ lng: 126.978 })).toThrow();
  });

  it('lng가 없으면 실패해야 한다', () => {
    expect(() => NearbyFacilitiesSchema.parse({ lat: 37.5665 })).toThrow();
  });
});
