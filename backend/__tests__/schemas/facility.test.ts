// @TASK T0.5.2 - 시설 스키마 테스트
// @TEST backend/__tests__/schemas/facility.test.ts

import { describe, it, expect } from 'vitest';
import {
  FacilityCategorySchema,
  FacilitySearchSchema,
  FacilityDetailParamsSchema,
  RegionFacilitiesParamsSchema,
} from '../../src/schemas/facility';

describe('FacilityCategorySchema', () => {
  it('유효한 카테고리를 파싱해야 한다', () => {
    // trash는 좌표 없는 일정 데이터로 WasteSchedule 별도 테이블에서 관리 (지도 마커 X)
    const categories = ['toilet', 'wifi', 'clothes', 'kiosk', 'parking'];
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
      city: '서울특별시',
      district: '중구',
      page: 1,
      limit: 10,
    };
    const result = FacilitySearchSchema.parse(input);
    expect(result).toEqual({ ...input, radius: 1000 });
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
      page: '2',
      limit: '30',
    });
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
