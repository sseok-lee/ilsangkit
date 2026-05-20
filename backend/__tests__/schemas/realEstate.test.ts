// @TASK Phase3-1 - 부동산 Zod 스키마 테스트

import { describe, it, expect } from 'vitest';
import {
  RealEstateTypeSchema,
  RealEstatePropertyTypeSchema,
  RealEstateSearchSchema,
  RealEstateStatsSchema,
  RealEstateComplexSchema,
  RealEstateUnifiedSearchSchema,
  NearbyQuerySchema,
} from '../../src/schemas/realEstate.js';

describe('RealEstateTypeSchema', () => {
  it('유효한 부동산 타입을 파싱해야 한다', () => {
    const types = ['apt-sale', 'apt-rent', 'villa-sale', 'villa-rent', 'offitel-sale', 'offitel-rent'];
    types.forEach((type) => {
      expect(RealEstateTypeSchema.parse(type)).toBe(type);
    });
  });

  it('유효하지 않은 타입은 실패해야 한다', () => {
    expect(() => RealEstateTypeSchema.parse('invalid')).toThrow();
    expect(() => RealEstateTypeSchema.parse('')).toThrow();
    expect(() => RealEstateTypeSchema.parse('apt')).toThrow();
    expect(() => RealEstateTypeSchema.parse('sale')).toThrow();
  });
});

describe('RealEstateSearchSchema', () => {
  it('빈 객체에 기본값이 적용되어야 한다', () => {
    const result = RealEstateSearchSchema.parse({});
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
  });

  it('모든 선택 필드가 있을 때 파싱해야 한다', () => {
    const input = {
      city: '서울특별시',
      district: '강남구',
      bjdCode: '1168010100',
      buildingName: '래미안',
      dealYear: 2024,
      dealMonth: 3,
      page: 2,
      limit: 10,
    };
    const result = RealEstateSearchSchema.parse(input);
    expect(result.city).toBe('서울특별시');
    expect(result.district).toBe('강남구');
    expect(result.bjdCode).toBe('1168010100');
    expect(result.buildingName).toBe('래미안');
    expect(result.dealYear).toBe(2024);
    expect(result.dealMonth).toBe(3);
    expect(result.page).toBe(2);
    expect(result.limit).toBe(10);
  });

  it('문자열 숫자가 number로 변환되어야 한다 (coerce)', () => {
    const result = RealEstateSearchSchema.parse({
      dealYear: '2024',
      dealMonth: '6',
      page: '3',
      limit: '15',
    });
    expect(result.dealYear).toBe(2024);
    expect(result.dealMonth).toBe(6);
    expect(result.page).toBe(3);
    expect(result.limit).toBe(15);
  });

  it('필드를 제공하지 않으면 undefined여야 한다', () => {
    const result = RealEstateSearchSchema.parse({});
    expect(result.city).toBeUndefined();
    expect(result.district).toBeUndefined();
    expect(result.bjdCode).toBeUndefined();
    expect(result.buildingName).toBeUndefined();
    expect(result.dealYear).toBeUndefined();
    expect(result.dealMonth).toBeUndefined();
  });
});

describe('RealEstateStatsSchema', () => {
  it('필수 필드가 모두 있을 때 파싱해야 한다', () => {
    const result = RealEstateStatsSchema.parse({
      bjdCode: '1168010100',
      buildingName: '래미안',
    });
    expect(result.bjdCode).toBe('1168010100');
    expect(result.buildingName).toBe('래미안');
    expect(result.months).toBeUndefined();
  });

  it('months를 직접 지정할 수 있어야 한다', () => {
    const result = RealEstateStatsSchema.parse({
      bjdCode: '1168010100',
      buildingName: '래미안',
      months: 6,
    });
    expect(result.months).toBe(6);
  });

  it('months 문자열이 number로 변환되어야 한다 (coerce)', () => {
    const result = RealEstateStatsSchema.parse({
      bjdCode: '1168010100',
      buildingName: '래미안',
      months: '24',
    });
    expect(result.months).toBe(24);
  });

  it('bjdCode가 없으면 실패해야 한다', () => {
    expect(() =>
      RealEstateStatsSchema.parse({ buildingName: '래미안' })
    ).toThrow();
  });

  it('buildingName이 없으면 실패해야 한다', () => {
    expect(() =>
      RealEstateStatsSchema.parse({ bjdCode: '1168010100' })
    ).toThrow();
  });
});

describe('RealEstateComplexSchema', () => {
  it('빈 객체에 기본값이 적용되어야 한다', () => {
    const result = RealEstateComplexSchema.parse({});
    expect(result.city).toBeUndefined();
    expect(result.district).toBeUndefined();
    expect(result.category).toBeUndefined();
    expect(result.page).toBe(1);
    expect(result.limit).toBe(15);
  });

  it('모든 필드가 있을 때 파싱해야 한다', () => {
    const result = RealEstateComplexSchema.parse({
      city: '서울특별시',
      district: '강남구',
      category: 'apt-sale',
    });
    expect(result.city).toBe('서울특별시');
    expect(result.district).toBe('강남구');
    expect(result.category).toBe('apt-sale');
  });

  it('city 없이 district만 있어도 파싱해야 한다', () => {
    const result = RealEstateComplexSchema.parse({ district: '강남구' });
    expect(result.city).toBeUndefined();
    expect(result.district).toBe('강남구');
  });

  it('유효하지 않은 category는 실패해야 한다', () => {
    expect(() =>
      RealEstateComplexSchema.parse({ city: '서울특별시', category: 'invalid' })
    ).toThrow();
  });
});

describe('RealEstateUnifiedSearchSchema', () => {
  it('keyword만 있을 때 파싱해야 한다', () => {
    const result = RealEstateUnifiedSearchSchema.parse({ keyword: '래미안' });
    expect(result.keyword).toBe('래미안');
    expect(result.city).toBeUndefined();
    expect(result.district).toBeUndefined();
  });

  it('모든 필드가 있을 때 파싱해야 한다', () => {
    const result = RealEstateUnifiedSearchSchema.parse({
      keyword: '래미안',
      city: '서울특별시',
      district: '강남구',
    });
    expect(result.keyword).toBe('래미안');
    expect(result.city).toBe('서울특별시');
    expect(result.district).toBe('강남구');
  });

  it('keyword 없이도 파싱 성공해야 한다 (optional)', () => {
    const result = RealEstateUnifiedSearchSchema.parse({ city: '서울특별시' });
    expect(result.city).toBe('서울특별시');
    expect(result.keyword).toBeUndefined();
  });

  it('빈 keyword도 파싱 성공해야 한다 (optional)', () => {
    const result = RealEstateUnifiedSearchSchema.parse({ keyword: '' });
    expect(result.keyword).toBe('');
  });
});

describe('RealEstatePropertyTypeSchema', () => {
  it('accepts apt, villa, offitel', () => {
    expect(RealEstatePropertyTypeSchema.parse('apt')).toBe('apt');
    expect(RealEstatePropertyTypeSchema.parse('villa')).toBe('villa');
    expect(RealEstatePropertyTypeSchema.parse('offitel')).toBe('offitel');
  });

  it('rejects invalid values', () => {
    expect(() => RealEstatePropertyTypeSchema.parse('house')).toThrow();
    expect(() => RealEstatePropertyTypeSchema.parse('apt-sale')).toThrow();
    expect(() => RealEstatePropertyTypeSchema.parse('')).toThrow();
  });
});

describe('NearbyQuerySchema', () => {
  it('필수 필드(bjdCode, mode)가 빠지면 실패한다', () => {
    expect(NearbyQuerySchema.safeParse({}).success).toBe(false);
    expect(NearbyQuerySchema.safeParse({ bjdCode: '1111017900' }).success).toBe(false);
    expect(NearbyQuerySchema.safeParse({ mode: 'sale' }).success).toBe(false);
  });

  it('mode는 sale 또는 rent여야 한다', () => {
    expect(NearbyQuerySchema.safeParse({ bjdCode: '1111017900', mode: 'invalid' }).success).toBe(false);
    expect(NearbyQuerySchema.safeParse({ bjdCode: '1111017900', mode: 'sale' }).success).toBe(true);
    expect(NearbyQuerySchema.safeParse({ bjdCode: '1111017900', mode: 'rent' }).success).toBe(true);
  });

  it('rentType은 all|jeonse|wolse만 허용하고 기본은 all', () => {
    const parsed = NearbyQuerySchema.parse({ bjdCode: '1111017900', mode: 'rent' });
    expect(parsed.rentType).toBe('all');
    expect(NearbyQuerySchema.safeParse({ bjdCode: '1111017900', mode: 'rent', rentType: 'jeonse' }).success).toBe(true);
    expect(NearbyQuerySchema.safeParse({ bjdCode: '1111017900', mode: 'rent', rentType: 'wolse' }).success).toBe(true);
    expect(NearbyQuerySchema.safeParse({ bjdCode: '1111017900', mode: 'rent', rentType: 'foo' }).success).toBe(false);
  });

  it('limitPerType은 양수, 기본 4', () => {
    const parsed = NearbyQuerySchema.parse({ bjdCode: '1111017900', mode: 'sale' });
    expect(parsed.limitPerType).toBe(4);
    expect(NearbyQuerySchema.safeParse({ bjdCode: '1111017900', mode: 'sale', limitPerType: 10 }).success).toBe(true);
    expect(NearbyQuerySchema.safeParse({ bjdCode: '1111017900', mode: 'sale', limitPerType: 0 }).success).toBe(false);
  });

  it('excludeBuildingName은 선택', () => {
    const parsed = NearbyQuerySchema.parse({ bjdCode: '1111017900', mode: 'sale', excludeBuildingName: '래미안' });
    expect(parsed.excludeBuildingName).toBe('래미안');
  });
});
