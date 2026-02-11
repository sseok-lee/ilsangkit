// @TASK T0.5.2 - 공통 스키마 테스트
// @TEST backend/__tests__/schemas/common.test.ts

import { describe, it, expect } from 'vitest';
import {
  PaginationSchema,
  CoordinatesSchema,
  SortOrderSchema,
  IdParamSchema,
} from '../../src/schemas/common';

describe('PaginationSchema', () => {
  it('기본값이 적용되어야 한다', () => {
    const result = PaginationSchema.parse({});
    expect(result).toEqual({ page: 1, limit: 20 });
  });

  it('문자열 숫자를 변환해야 한다', () => {
    const result = PaginationSchema.parse({ page: '2', limit: '50' });
    expect(result).toEqual({ page: 2, limit: 50 });
  });

  it('page가 1 미만이면 실패해야 한다', () => {
    expect(() => PaginationSchema.parse({ page: 0 })).toThrow();
    expect(() => PaginationSchema.parse({ page: -1 })).toThrow();
  });

  it('limit이 100을 초과하면 실패해야 한다', () => {
    expect(() => PaginationSchema.parse({ limit: 101 })).toThrow();
  });

  it('limit이 1 미만이면 실패해야 한다', () => {
    expect(() => PaginationSchema.parse({ limit: 0 })).toThrow();
  });
});

describe('CoordinatesSchema', () => {
  it('유효한 좌표를 파싱해야 한다', () => {
    const result = CoordinatesSchema.parse({ lat: 37.5665, lng: 126.978 });
    expect(result).toEqual({ lat: 37.5665, lng: 126.978 });
  });

  it('문자열 좌표를 숫자로 변환해야 한다', () => {
    const result = CoordinatesSchema.parse({ lat: '37.5665', lng: '126.978' });
    expect(result).toEqual({ lat: 37.5665, lng: 126.978 });
  });

  it('위도가 -90 미만이면 실패해야 한다', () => {
    expect(() => CoordinatesSchema.parse({ lat: -91, lng: 0 })).toThrow();
  });

  it('위도가 90 초과이면 실패해야 한다', () => {
    expect(() => CoordinatesSchema.parse({ lat: 91, lng: 0 })).toThrow();
  });

  it('경도가 -180 미만이면 실패해야 한다', () => {
    expect(() => CoordinatesSchema.parse({ lat: 0, lng: -181 })).toThrow();
  });

  it('경도가 180 초과이면 실패해야 한다', () => {
    expect(() => CoordinatesSchema.parse({ lat: 0, lng: 181 })).toThrow();
  });
});

describe('SortOrderSchema', () => {
  it('기본값 asc가 적용되어야 한다', () => {
    const result = SortOrderSchema.parse(undefined);
    expect(result).toBe('asc');
  });

  it('asc와 desc만 허용해야 한다', () => {
    expect(SortOrderSchema.parse('asc')).toBe('asc');
    expect(SortOrderSchema.parse('desc')).toBe('desc');
    expect(() => SortOrderSchema.parse('invalid')).toThrow();
  });
});

describe('IdParamSchema', () => {
  it('유효한 ID를 파싱해야 한다', () => {
    const result = IdParamSchema.parse({ id: 'abc123' });
    expect(result).toEqual({ id: 'abc123' });
  });

  it('빈 ID는 실패해야 한다', () => {
    expect(() => IdParamSchema.parse({ id: '' })).toThrow();
  });

  it('50자를 초과하면 실패해야 한다', () => {
    const longId = 'a'.repeat(51);
    expect(() => IdParamSchema.parse({ id: longId })).toThrow();
  });
});
