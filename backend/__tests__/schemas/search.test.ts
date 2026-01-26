// @TASK T0.5.2 - 검색 스키마 테스트
// @TEST backend/__tests__/schemas/search.test.ts

import { describe, it, expect } from 'vitest';
import { SearchLogSchema, PopularSearchQuerySchema } from '../../src/schemas/search';

describe('SearchLogSchema', () => {
  it('유효한 검색 로그를 파싱해야 한다', () => {
    const input = {
      sessionId: 'a'.repeat(32),
      keyword: '화장실',
      category: 'toilet',
      city: '서울특별시',
      district: '중구',
      lat: 37.5665,
      lng: 126.978,
      resultCount: 10,
    };
    const result = SearchLogSchema.parse(input);
    expect(result).toEqual(input);
  });

  it('필수 필드만으로 성공해야 한다', () => {
    const input = {
      sessionId: 'b'.repeat(32),
      resultCount: 0,
    };
    const result = SearchLogSchema.parse(input);
    expect(result.sessionId).toBe('b'.repeat(32));
    expect(result.resultCount).toBe(0);
  });

  it('sessionId가 32자가 아니면 실패해야 한다', () => {
    expect(() =>
      SearchLogSchema.parse({
        sessionId: 'short',
        resultCount: 0,
      })
    ).toThrow();

    expect(() =>
      SearchLogSchema.parse({
        sessionId: 'a'.repeat(33),
        resultCount: 0,
      })
    ).toThrow();
  });

  it('keyword가 200자를 초과하면 실패해야 한다', () => {
    expect(() =>
      SearchLogSchema.parse({
        sessionId: 'a'.repeat(32),
        keyword: 'x'.repeat(201),
        resultCount: 0,
      })
    ).toThrow();
  });

  it('resultCount가 음수이면 실패해야 한다', () => {
    expect(() =>
      SearchLogSchema.parse({
        sessionId: 'a'.repeat(32),
        resultCount: -1,
      })
    ).toThrow();
  });
});

describe('PopularSearchQuerySchema', () => {
  it('기본값이 적용되어야 한다', () => {
    const result = PopularSearchQuerySchema.parse({});
    expect(result).toEqual({ limit: 10, period: 'week' });
  });

  it('유효한 값을 파싱해야 한다', () => {
    const result = PopularSearchQuerySchema.parse({
      limit: 5,
      period: 'day',
    });
    expect(result).toEqual({ limit: 5, period: 'day' });
  });

  it('유효하지 않은 period는 실패해야 한다', () => {
    expect(() =>
      PopularSearchQuerySchema.parse({
        period: 'year',
      })
    ).toThrow();
  });

  it('limit이 1 미만이면 실패해야 한다', () => {
    expect(() => PopularSearchQuerySchema.parse({ limit: 0 })).toThrow();
  });

  it('limit이 20을 초과하면 실패해야 한다', () => {
    expect(() => PopularSearchQuerySchema.parse({ limit: 21 })).toThrow();
  });

  it('문자열 limit을 숫자로 변환해야 한다', () => {
    const result = PopularSearchQuerySchema.parse({ limit: '15' });
    expect(result.limit).toBe(15);
  });
});
