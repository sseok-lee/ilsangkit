import { describe, it, expect } from 'vitest';
import {
  AREA_BUCKETS,
  MapQuerySchema,
  PRICE_BUCKETS,
  bucketRange,
  inRange,
  resolveMapFilter,
} from '../../src/schemas/realEstateMap.js';
import { ValidationError } from '../../src/lib/errors.js';

const BASE = { level: 5, swLat: 37.4, swLng: 127.0, neLat: 37.5, neLng: 127.1 };

describe('지도 필터 구간', () => {
  it('운영자가 정한 구간 그대로다', () => {
    expect(AREA_BUCKETS).toEqual(['0-60', '60-85', '85-135', '135-']);
    expect(PRICE_BUCKETS.sale).toEqual(['0-30000', '30000-60000', '60000-90000', '90000-150000', '150000-250000', '250000-']);
    expect(PRICE_BUCKETS.jeonse).toEqual(['0-10000', '10000-30000', '30000-50000', '50000-80000', '80000-']);
    expect(PRICE_BUCKETS.wolse).toEqual(['0-50', '50-100', '100-']);
  });

  it('첫 구간은 하한 없음, 마지막 구간은 상한 없음', () => {
    expect(bucketRange('0-60')).toEqual({ min: null, max: 60 });
    expect(bucketRange('60-85')).toEqual({ min: 60, max: 85 });
    expect(bucketRange('135-')).toEqual({ min: 135, max: null });
  });

  it('경계: 하한 초과 ~ 상한 이하 (a ≤ 60, 60 < a ≤ 85, a > 135)', () => {
    expect(inRange(60, bucketRange('0-60'))).toBe(true);
    expect(inRange(60.01, bucketRange('0-60'))).toBe(false);
    expect(inRange(60, bucketRange('60-85'))).toBe(false);
    expect(inRange(85, bucketRange('60-85'))).toBe(true);
    expect(inRange(85.01, bucketRange('85-135'))).toBe(true);
    expect(inRange(135, bucketRange('135-'))).toBe(false);
    expect(inRange(135.01, bucketRange('135-'))).toBe(true);
    // 가격: 3억 이하 / 3~6억 — 정확히 3억은 첫 구간
    expect(inRange(30000, bucketRange('0-30000'))).toBe(true);
    expect(inRange(30000, bucketRange('30000-60000'))).toBe(false);
    expect(inRange(30001, bucketRange('30000-60000'))).toBe(true);
    // 월세 50만 이하 / 50~100만 / 100만 초과
    expect(inRange(50, bucketRange('0-50'))).toBe(true);
    expect(inRange(100, bucketRange('50-100'))).toBe(true);
    expect(inRange(100, bucketRange('100-'))).toBe(false);
  });
});

describe('resolveMapFilter', () => {
  it('필터가 없으면 null — 기존 경로를 그대로 탄다', () => {
    expect(resolveMapFilter('apt-sale', {})).toBeNull();
    expect(resolveMapFilter('apt-rent', {})).toBeNull();
  });

  it('매매는 price 만으로 sale 구간', () => {
    expect(resolveMapFilter('apt-sale', { price: '90000-150000' })).toEqual({
      area: null,
      price: { kind: 'sale', range: { min: 90000, max: 150000 } },
    });
  });

  it('전월세는 priceKind 로 전세 보증금·월세액을 고른다', () => {
    expect(resolveMapFilter('villa-rent', { area: '0-60', price: '80000-', priceKind: 'jeonse' })).toEqual({
      area: { min: null, max: 60 },
      price: { kind: 'jeonse', range: { min: 80000, max: null } },
    });
    expect(resolveMapFilter('apt-rent', { price: '50-100', priceKind: 'wolse' })?.price)
      .toEqual({ kind: 'wolse', range: { min: 50, max: 100 } });
  });

  it('면적만', () => {
    expect(resolveMapFilter('offitel-sale', { area: '135-' })).toEqual({ area: { min: 135, max: null }, price: null });
  });

  it('유형과 짝이 안 맞으면 ValidationError', () => {
    expect(() => resolveMapFilter('apt-sale', { price: '0-30000', priceKind: 'jeonse' })).toThrow(ValidationError);
    expect(() => resolveMapFilter('apt-rent', { price: '0-10000' })).toThrow(ValidationError);
    expect(() => resolveMapFilter('apt-rent', { priceKind: 'jeonse' })).toThrow(ValidationError);
    // 전세 구간을 월세로, 매매 구간을 전세로
    expect(() => resolveMapFilter('apt-rent', { price: '0-10000', priceKind: 'wolse' })).toThrow(ValidationError);
    expect(() => resolveMapFilter('apt-sale', { price: '0-10000' })).toThrow(ValidationError);
  });
});

describe('MapQuerySchema 필터 파라미터', () => {
  it('정해진 구간 id 만 받는다', () => {
    expect(MapQuerySchema.safeParse({ ...BASE, area: '60-85' }).success).toBe(true);
    expect(MapQuerySchema.safeParse({ ...BASE, area: '60-84' }).success).toBe(false);
    expect(MapQuerySchema.safeParse({ ...BASE, price: '0-30000' }).success).toBe(true);
    expect(MapQuerySchema.safeParse({ ...BASE, price: '1-2' }).success).toBe(false);
    expect(MapQuerySchema.safeParse({ ...BASE, priceKind: 'sale' }).success).toBe(false);
  });

  it('필터가 없으면 파싱 결과에 키가 생기지 않는다', () => {
    const parsed = MapQuerySchema.parse(BASE);
    expect(parsed).not.toHaveProperty('area');
    expect(parsed).not.toHaveProperty('price');
    expect(parsed).not.toHaveProperty('priceKind');
  });
});
