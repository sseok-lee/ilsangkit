import { describe, it, expect } from 'vitest';
import {
  SubscriptionStatusSchema,
  SubscriptionSourceTypeSchema,
  SubscriptionCategorySchema,
  SubscriptionListSchema,
  SubscriptionIdSchema,
} from '../../src/schemas/subscription';

describe('SubscriptionStatusSchema', () => {
  it('유효한 상태값을 파싱해야 한다', () => {
    expect(SubscriptionStatusSchema.parse('upcoming')).toBe('upcoming');
    expect(SubscriptionStatusSchema.parse('ongoing')).toBe('ongoing');
    expect(SubscriptionStatusSchema.parse('closed')).toBe('closed');
  });

  it('유효하지 않은 상태값은 실패해야 한다', () => {
    expect(() => SubscriptionStatusSchema.parse('invalid')).toThrow();
    expect(() => SubscriptionStatusSchema.parse('')).toThrow();
  });
});

describe('SubscriptionSourceTypeSchema', () => {
  it('유효한 sourceType을 파싱해야 한다', () => {
    expect(SubscriptionSourceTypeSchema.parse('APT')).toBe('APT');
    expect(SubscriptionSourceTypeSchema.parse('OFFITEL')).toBe('OFFITEL');
    expect(SubscriptionSourceTypeSchema.parse('REMAINING')).toBe('REMAINING');
    expect(SubscriptionSourceTypeSchema.parse('PRIVATE_RENT')).toBe('PRIVATE_RENT');
  });

  it('유효하지 않은 sourceType은 실패해야 한다', () => {
    expect(() => SubscriptionSourceTypeSchema.parse('INVALID')).toThrow();
    expect(() => SubscriptionSourceTypeSchema.parse('')).toThrow();
  });
});

describe('SubscriptionCategorySchema', () => {
  it('유효한 category를 파싱해야 한다', () => {
    expect(SubscriptionCategorySchema.parse('sale')).toBe('sale');
    expect(SubscriptionCategorySchema.parse('rent')).toBe('rent');
  });

  it('유효하지 않은 category는 실패해야 한다', () => {
    expect(() => SubscriptionCategorySchema.parse('invalid')).toThrow();
  });
});

describe('SubscriptionListSchema', () => {
  it('빈 객체에 기본값이 적용되어야 한다', () => {
    const result = SubscriptionListSchema.parse({});
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
    expect(result.status).toBeUndefined();
    expect(result.region).toBeUndefined();
    expect(result.houseType).toBeUndefined();
  });

  it('모든 필터가 있을 때 파싱해야 한다', () => {
    const input = {
      status: 'upcoming',
      region: '서울',
      houseType: 'APT',
      page: 2,
      limit: 10,
    };
    const result = SubscriptionListSchema.parse(input);
    expect(result.status).toBe('upcoming');
    expect(result.region).toBe('서울');
    expect(result.houseType).toBe('APT');
    expect(result.page).toBe(2);
    expect(result.limit).toBe(10);
  });

  it('문자열 page/limit를 숫자로 변환해야 한다', () => {
    const result = SubscriptionListSchema.parse({ page: '3', limit: '15' });
    expect(result.page).toBe(3);
    expect(result.limit).toBe(15);
  });

  it('limit가 100을 초과하면 실패해야 한다', () => {
    expect(() => SubscriptionListSchema.parse({ limit: 101 })).toThrow();
  });

  it('page가 0이면 실패해야 한다', () => {
    expect(() => SubscriptionListSchema.parse({ page: 0 })).toThrow();
  });

  it('sourceType 필터를 파싱해야 한다', () => {
    const result = SubscriptionListSchema.parse({ sourceType: 'OFFITEL' });
    expect(result.sourceType).toBe('OFFITEL');
  });

  it('category 필터를 파싱해야 한다', () => {
    const result = SubscriptionListSchema.parse({ category: 'sale' });
    expect(result.category).toBe('sale');
  });

  it('유효하지 않은 sourceType은 실패해야 한다', () => {
    expect(() => SubscriptionListSchema.parse({ sourceType: 'INVALID' })).toThrow();
  });
});

describe('SubscriptionIdSchema', () => {
  it('유효한 ID를 파싱해야 한다', () => {
    expect(SubscriptionIdSchema.parse({ id: 1 }).id).toBe(1);
    expect(SubscriptionIdSchema.parse({ id: '42' }).id).toBe(42);
  });

  it('유효하지 않은 ID는 실패해야 한다', () => {
    expect(() => SubscriptionIdSchema.parse({ id: 0 })).toThrow();
    expect(() => SubscriptionIdSchema.parse({ id: -1 })).toThrow();
    expect(() => SubscriptionIdSchema.parse({ id: 'abc' })).toThrow();
  });
});
