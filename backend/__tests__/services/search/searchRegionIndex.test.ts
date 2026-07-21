import { describe, it, expect } from 'vitest';
import { buildRegionIndex } from '../../../src/services/search/searchRegionIndex.js';
import { JNGJ_CITY } from '../../../src/lib/normalizeRegionName.js';

const SAMPLE = [
  { city: '서울특별시', district: '강남구' },
  { city: '서울특별시', district: '서초구' },
  { city: '부산광역시', district: '해운대구' },
];

const JNGJ_SAMPLE = [
  { city: JNGJ_CITY, district: '동구' },
  { city: JNGJ_CITY, district: '목포시' },
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

  it('정규화 후 city=JNGJ만 존재해도 옛 시/도명 별칭(광주/전남 등)이 JNGJ로 매칭', () => {
    const idx = buildRegionIndex(JNGJ_SAMPLE);
    expect(idx.cityNames.get(JNGJ_CITY)).toBe(JNGJ_CITY);
    expect(idx.cityNames.get('광주')).toBe(JNGJ_CITY);
    expect(idx.cityNames.get('광주광역시')).toBe(JNGJ_CITY);
    expect(idx.cityNames.get('전남')).toBe(JNGJ_CITY);
    expect(idx.cityNames.get('전라남도')).toBe(JNGJ_CITY);
    expect(idx.cityNames.get('전남광주')).toBe(JNGJ_CITY);
  });

  it('JNGJ가 아닌 다른 지역은 별칭 등록 영향을 받지 않음', () => {
    const idx = buildRegionIndex(SAMPLE);
    expect(idx.cityNames.has('광주')).toBe(false);
    expect(idx.cityNames.has('전남')).toBe(false);
  });
});
