import { describe, it, expect } from 'vitest';
import { resolveScope } from '../../../src/services/search/searchQueryParser.js';

const parsed = { cityToken: '서울특별시', districtToken: '강남구', categoryToken: null, freeText: '래미안', raw: '강남 래미안' };

describe('resolveScope', () => {
  it('파서 토큰을 effective 값으로 사용', () => {
    const s = resolveScope({}, parsed);
    expect(s.effectiveCity).toBe('서울특별시');
    expect(s.effectiveDistrict).toBe('강남구');
    expect(s.nameText).toBe('래미안');
  });
  it('명시적 파라미터가 파서 토큰보다 우선', () => {
    const s = resolveScope({ city: '부산광역시', district: '해운대구' }, parsed);
    expect(s.effectiveCity).toBe('부산광역시');
    expect(s.effectiveDistrict).toBe('해운대구');
  });
  it('freeText 빈 문자열이면 nameText는 undefined', () => {
    const s = resolveScope({}, { cityToken: '서울특별시', districtToken: null, categoryToken: 'toilet', freeText: '', raw: '서울 화장실' });
    expect(s.nameText).toBeUndefined();
  });
});
