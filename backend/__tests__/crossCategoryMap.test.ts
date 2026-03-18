import { describe, it, expect } from 'vitest';
import { CROSS_CATEGORY_MAP } from '../src/services/facilityService.js';
import type { FacilityCategory } from '../src/services/facilityService.js';

const ALL_CATEGORIES: FacilityCategory[] = [
  'toilet', 'wifi', 'clothes', 'parking', 'aed', 'library',
  'hospital', 'pharmacy', 'park', 'school', 'market', 'childcare',
  'ev-charger', 'sports',
];

describe('CROSS_CATEGORY_MAP', () => {
  it('모든 카테고리가 CROSS_CATEGORY_MAP에 존재해야 한다', () => {
    for (const cat of ALL_CATEGORIES) {
      expect(CROSS_CATEGORY_MAP).toHaveProperty(cat);
    }
  });

  it('각 카테고리의 추천 매핑이 재설계안과 일치해야 한다', () => {
    expect(CROSS_CATEGORY_MAP.toilet).toEqual(['park', 'wifi']);
    expect(CROSS_CATEGORY_MAP.wifi).toEqual(['library', 'park', 'toilet']);
    expect(CROSS_CATEGORY_MAP.parking).toEqual(['ev-charger', 'toilet', 'market']);
    expect(CROSS_CATEGORY_MAP.hospital).toEqual(['pharmacy', 'aed']);
    expect(CROSS_CATEGORY_MAP.pharmacy).toEqual(['hospital', 'childcare']);
    expect(CROSS_CATEGORY_MAP.aed).toEqual(['hospital', 'pharmacy']);
    expect(CROSS_CATEGORY_MAP.library).toEqual(['parking', 'wifi', 'park']);
    expect(CROSS_CATEGORY_MAP.clothes).toEqual(['toilet', 'park']);
    expect(CROSS_CATEGORY_MAP.park).toEqual(['toilet', 'parking', 'sports']);
    expect(CROSS_CATEGORY_MAP.school).toEqual(['childcare', 'library', 'park']);
    expect(CROSS_CATEGORY_MAP.market).toEqual(['parking', 'toilet']);
    expect(CROSS_CATEGORY_MAP.childcare).toEqual(['school', 'hospital', 'pharmacy', 'park']);
    expect(CROSS_CATEGORY_MAP['ev-charger']).toEqual(['parking', 'park', 'market', 'library']);
    expect(CROSS_CATEGORY_MAP.sports).toEqual(['parking', 'park', 'toilet']);
  });

  it('추천 대상이 자기 자신을 포함하지 않아야 한다', () => {
    for (const cat of ALL_CATEGORIES) {
      expect(CROSS_CATEGORY_MAP[cat]).not.toContain(cat);
    }
  });

  it('추천 대상이 유효한 카테고리여야 한다', () => {
    for (const cat of ALL_CATEGORIES) {
      for (const target of CROSS_CATEGORY_MAP[cat]) {
        expect(ALL_CATEGORIES).toContain(target);
      }
    }
  });

  it('제거된 카테고리(kiosk, trash)가 매핑에 없어야 한다', () => {
    const removedCategories = ['kiosk', 'trash'];
    // 키로 존재하지 않아야 함
    for (const removed of removedCategories) {
      expect(CROSS_CATEGORY_MAP).not.toHaveProperty(removed);
    }
    // 값으로도 포함되지 않아야 함
    for (const cat of ALL_CATEGORIES) {
      for (const removed of removedCategories) {
        expect(CROSS_CATEGORY_MAP[cat]).not.toContain(removed);
      }
    }
  });
});
