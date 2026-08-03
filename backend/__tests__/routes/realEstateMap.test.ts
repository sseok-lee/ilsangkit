import { describe, it, expect } from 'vitest';
import { resolveGranularity, MapQuerySchema } from '../../src/schemas/realEstateMap.js';

describe('resolveGranularity', () => {
  it('level >= 11 은 city', () => {
    expect(resolveGranularity(11)).toBe('city');
    expect(resolveGranularity(14)).toBe('city');
  });

  it('level 8~10 은 district', () => {
    expect(resolveGranularity(8)).toBe('district');
    expect(resolveGranularity(10)).toBe('district');
  });

  it('level <= 7 은 building', () => {
    expect(resolveGranularity(7)).toBe('building');
    expect(resolveGranularity(1)).toBe('building');
  });

  it('히스테리시스: district 에서 level 11 로 올라가도 한 단계는 버틴다', () => {
    // 경계에서 진동하면 좌측/마커가 깜빡인다. 이미 district 면 12 이상에서만 city 로 간다.
    expect(resolveGranularity(11, 'district')).toBe('district');
    expect(resolveGranularity(12, 'district')).toBe('city');
  });

  it('히스테리시스: city 에서 level 10 으로 내려가도 한 단계는 버틴다', () => {
    expect(resolveGranularity(10, 'city')).toBe('city');
    expect(resolveGranularity(9, 'city')).toBe('district');
  });
});

describe('MapQuerySchema', () => {
  const valid = { level: '9', swLat: '37.4', swLng: '127.0', neLat: '37.6', neLng: '127.2' };

  it('정상 입력을 숫자로 파싱한다', () => {
    const r = MapQuerySchema.parse(valid);
    expect(r.level).toBe(9);
    expect(r.swLat).toBe(37.4);
  });

  it('bounds 를 하나라도 빠뜨리면 거부한다', () => {
    const { neLng, ...partial } = valid;
    expect(() => MapQuerySchema.parse(partial)).toThrow();
  });

  it('한국 영역 밖 좌표를 거부한다', () => {
    expect(() => MapQuerySchema.parse({ ...valid, swLat: '20' })).toThrow();
    expect(() => MapQuerySchema.parse({ ...valid, neLng: '150' })).toThrow();
  });

  it('sw 가 ne 보다 크면 거부한다', () => {
    expect(() => MapQuerySchema.parse({ ...valid, swLat: '38', neLat: '37' })).toThrow();
  });

  it('level 범위를 벗어나면 거부한다', () => {
    expect(() => MapQuerySchema.parse({ ...valid, level: '0' })).toThrow();
    expect(() => MapQuerySchema.parse({ ...valid, level: '20' })).toThrow();
  });
});
