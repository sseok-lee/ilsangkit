import { describe, it, expect } from 'vitest';
import { normalizeRegionName, JNGJ_CITY, JNGJ_DISTRICTS, GWANGJU_5GU } from '../../src/lib/normalizeRegionName.js';

describe('normalizeRegionName', () => {
  it('광주/전남 변종 → JNGJ (district 유지)', () => {
    for (const c of ['광주', '광주광역시']) expect(normalizeRegionName(c, '북구')).toEqual({ city: JNGJ_CITY, district: '북구' });
    for (const c of ['전남', '전라남도', '전남광주']) expect(normalizeRegionName(c, '영광군')).toEqual({ city: JNGJ_CITY, district: '영광군' });
  });

  it('신명+district concat 분리', () => {
    expect(normalizeRegionName('전남광주통합특별시영광군', '')).toEqual({ city: JNGJ_CITY, district: '영광군' });
  });

  it('옛명+district concat 분리 (R2)', () => {
    expect(normalizeRegionName('전라남도영광군', '')).toEqual({ city: JNGJ_CITY, district: '영광군' });
    expect(normalizeRegionName('광주광역시북구', '')).toEqual({ city: JNGJ_CITY, district: '북구' });
  });

  it('경기도 광주시 불변 (오염 방지)', () => {
    expect(normalizeRegionName('경기도', '광주시')).toEqual({ city: '경기도', district: '광주시' });
    expect(normalizeRegionName('경기', '광주시')).toEqual({ city: '경기', district: '광주시' });
    expect(normalizeRegionName('경기도광주시', '')).toEqual({ city: '경기도광주시', district: '' }); // 오분리 안 됨
  });

  it("'광주시'는 district가 광주 5구일 때만 통합시로 매핑, 그 외엔 불변", () => {
    expect(normalizeRegionName('광주시', '남양주')).toEqual({ city: '광주시', district: '남양주' });
    expect(normalizeRegionName('광주시', '북구')).toEqual({ city: JNGJ_CITY, district: '북구' });
  });

  it('무관 지역 passthrough', () => {
    expect(normalizeRegionName('서울특별시', '강남구')).toEqual({ city: '서울특별시', district: '강남구' });
  });

  it('JNGJ_DISTRICTS는 27개(광주5구+전남22시군), GWANGJU_5GU는 5개', () => {
    expect(JNGJ_DISTRICTS.size).toBe(27);
    expect(GWANGJU_5GU.size).toBe(5);
    for (const gu of GWANGJU_5GU) expect(JNGJ_DISTRICTS.has(gu)).toBe(true);
  });
});
