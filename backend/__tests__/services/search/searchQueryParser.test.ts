import { describe, it, expect } from 'vitest';
import { parseSearchQuery } from '../../../src/services/search/searchQueryParser.js';
import { buildRegionIndex } from '../../../src/services/search/searchRegionIndex.js';
import { CATEGORY_SYNONYM_MAP } from '../../../src/services/search/searchCategorySynonyms.js';
import { JNGJ_CITY } from '../../../src/lib/normalizeRegionName.js';

const idx = buildRegionIndex([{ city: '서울특별시', district: '강남구' }]);
const parse = (kw: string) => parseSearchQuery(kw, idx, CATEGORY_SYNONYM_MAP);

// 정규화 후 Region 테이블엔 city=JNGJ 행만 남는다 (광주/전남 옛명 행 소멸).
// 옛 시/도명 단독 검색이 지역 스코프를 잃지 않는지 회귀 방지.
const jngjIdx = buildRegionIndex([{ city: JNGJ_CITY, district: '동구' }]);
const parseJngj = (kw: string) => parseSearchQuery(kw, jngjIdx, CATEGORY_SYNONYM_MAP);

describe('parseSearchQuery', () => {
  it('"강남 래미안" → district=강남구, freeText=래미안', () => {
    const r = parse('강남 래미안');
    expect(r.districtToken).toBe('강남구');
    expect(r.cityToken).toBe('서울특별시');
    expect(r.categoryToken).toBeNull();
    expect(r.freeText).toBe('래미안');
  });
  it('"서울 화장실" → city=서울특별시, category=toilet, freeText=""', () => {
    const r = parse('서울 화장실');
    expect(r.cityToken).toBe('서울특별시');
    expect(r.categoryToken).toBe('toilet');
    expect(r.freeText).toBe('');
  });
  it('"래미안" → freeText만', () => {
    const r = parse('래미안');
    expect(r.cityToken).toBeNull();
    expect(r.districtToken).toBeNull();
    expect(r.freeText).toBe('래미안');
  });
  it('"강남구" → district만, freeText=""', () => {
    const r = parse('강남구');
    expect(r.districtToken).toBe('강남구');
    expect(r.freeText).toBe('');
  });
  it('빈 문자열 → 전부 null/빈', () => {
    const r = parse('');
    expect(r.cityToken).toBeNull();
    expect(r.districtToken).toBeNull();
    expect(r.categoryToken).toBeNull();
    expect(r.freeText).toBe('');
  });

  it('정규화 후(city=JNGJ만 존재) "광주 화장실" → cityToken=JNGJ', () => {
    const r = parseJngj('광주 화장실');
    expect(r.cityToken).toBe(JNGJ_CITY);
    expect(r.categoryToken).toBe('toilet');
  });

  it('정규화 후(city=JNGJ만 존재) "전남 약국" → cityToken=JNGJ', () => {
    const r = parseJngj('전남 약국');
    expect(r.cityToken).toBe(JNGJ_CITY);
    expect(r.categoryToken).toBe('pharmacy');
  });
});
