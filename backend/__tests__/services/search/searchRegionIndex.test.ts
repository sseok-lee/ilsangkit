import { describe, it, expect } from 'vitest';
import { buildRegionIndex } from '../../../src/services/search/searchRegionIndex.js';

const SAMPLE = [
  { city: '서울특별시', district: '강남구' },
  { city: '서울특별시', district: '서초구' },
  { city: '부산광역시', district: '해운대구' },
];

describe('buildRegionIndex', () => {
  it('정식 city명과 축약명을 모두 인식', () => {
    const idx = buildRegionIndex(SAMPLE);
    expect(idx.cityNames.get('서울특별시')).toBe('서울특별시');
    expect(idx.cityNames.get('서울')).toBe('서울특별시');
  });
  it('district명 → {city, district}', () => {
    const idx = buildRegionIndex(SAMPLE);
    expect(idx.districtNames.get('강남구')).toEqual({ city: '서울특별시', district: '강남구' });
  });
  it('"구" 없는 축약 district도 인식 (강남 → 강남구)', () => {
    const idx = buildRegionIndex(SAMPLE);
    expect(idx.districtNames.get('강남')).toEqual({ city: '서울특별시', district: '강남구' });
  });
});
