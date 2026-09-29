import { describe, expect, it } from 'vitest';
import {
  DetailOverviewQuerySchema,
  DetailPageQuerySchema,
  DetailQuerySchema,
} from '../../src/schemas/realEstateDetail.js';

const baseQuery = {
  bjdCode: '11680',
  buildingName: 'A',
  mode: 'wolse',
  months: '6',
  area: '84.90',
  deposit: '0',
};

describe('DetailQuerySchema', () => {
  it('월세 보증금 0은 허용하고 소수 셋째 자리 면적은 거부한다', () => {
    const parsed = DetailQuerySchema.parse(baseQuery);
    expect(parsed.deposit).toBe(0);
    expect(parsed.area).toBe('84.90');
    expect(DetailQuerySchema.safeParse({ ...baseQuery, area: '84.901' }).success).toBe(false);
    expect(DetailQuerySchema.safeParse({ ...baseQuery, mode: 'sale' }).success).toBe(false);
  });

  it('5자리 또는 10자리 법정동 코드와 허용 기간만 받는다', () => {
    expect(DetailQuerySchema.parse({ ...baseQuery, bjdCode: '11680' }).bjdCode).toBe('11680');
    expect(DetailQuerySchema.parse({ ...baseQuery, bjdCode: '1168010100' }).bjdCode).toBe('1168010100');
    expect(DetailQuerySchema.safeParse({ ...baseQuery, bjdCode: '1168' }).success).toBe(false);
    expect(DetailQuerySchema.safeParse({ ...baseQuery, bjdCode: '11680a' }).success).toBe(false);
    expect(DetailQuerySchema.safeParse({ ...baseQuery, months: '24' }).success).toBe(false);
  });

  it('identity 누락과 빈 문자열을 거부한다', () => {
    expect(DetailOverviewQuerySchema.safeParse({ buildingName: 'A' }).success).toBe(false);
    expect(DetailOverviewQuerySchema.safeParse({ bjdCode: '11680' }).success).toBe(false);
    expect(DetailOverviewQuerySchema.safeParse({ bjdCode: '11680', buildingName: '' }).success).toBe(false);
  });

  it('빈 deposit/null deposit은 0으로 바꾸지 않고 거부한다', () => {
    expect(DetailQuerySchema.safeParse({ ...baseQuery, deposit: '' }).success).toBe(false);
    expect(DetailQuerySchema.safeParse({ ...baseQuery, deposit: null }).success).toBe(false);
    expect(DetailQuerySchema.safeParse({ ...baseQuery, deposit: '0' }).success).toBe(true);
  });

  it('detail-page는 면적과 월세 보증금을 필수로 요구한다', () => {
    expect(DetailPageQuerySchema.safeParse({ ...baseQuery, page: '2' }).success).toBe(true);
    expect(DetailPageQuerySchema.safeParse({ ...baseQuery, area: undefined, page: '2' }).success).toBe(false);
    expect(DetailPageQuerySchema.safeParse({ ...baseQuery, deposit: undefined, page: '2' }).success).toBe(false);
  });
});

it('accepts only complete hexadecimal building keys and preserves them', () => {
  expect(DetailQuerySchema.parse({ ...baseQuery, buildingKey: 'a'.repeat(64) }).buildingKey).toBe('a'.repeat(64));
  for (const buildingKey of ['', 'a'.repeat(63), 'g'.repeat(64), ['a'.repeat(64)]]) {
    expect(DetailQuerySchema.safeParse({ ...baseQuery, buildingKey }).success).toBe(false);
  }
});
