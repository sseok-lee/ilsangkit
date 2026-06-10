import { describe, it, expect } from 'vitest';
import { buildRecovery } from '../../../src/services/search/searchRecovery.js';

describe('buildRecovery', () => {
  it('지역 인식 시: scope=region, regionLabel, 지역 카테고리 칩(city/district 포함)', () => {
    const r = buildRecovery({ cityToken: '서울특별시', districtToken: '강남구', categoryToken: null, freeText: '헬스장', raw: '강남 헬스장' });
    expect(r.scope).toBe('region');
    expect(r.regionLabel).toBe('서울특별시 강남구');
    expect(r.chips.length).toBeGreaterThan(0);
    expect(r.chips[0].city).toBe('서울특별시');
    expect(r.chips[0].district).toBe('강남구');
    expect(r.chips[0].label).toContain('강남구');
  });
  it('카테고리만 인식 시: scope=category, city/district=null', () => {
    const r = buildRecovery({ cityToken: null, districtToken: null, categoryToken: 'toilet', freeText: '', raw: '화장실' });
    expect(r.scope).toBe('category');
    expect(r.chips.some(c => c.category === 'toilet')).toBe(true);
    expect(r.chips[0].city).toBeNull();
  });
  it('아무것도 미인식 시: scope=popular, 정적 인기 카테고리', () => {
    const r = buildRecovery({ cityToken: null, districtToken: null, categoryToken: null, freeText: '존재안함', raw: '존재안함' });
    expect(r.scope).toBe('popular');
    expect(r.chips.length).toBeGreaterThan(0);
    expect(r.chips[0].city).toBeNull();
  });
});
