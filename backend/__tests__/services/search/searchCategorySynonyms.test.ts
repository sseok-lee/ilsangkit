import { describe, it, expect } from 'vitest';
import { CATEGORY_SYNONYM_MAP } from '../../../src/services/search/searchCategorySynonyms.js';

describe('CATEGORY_SYNONYM_MAP', () => {
  it('화장실 → toilet', () => {
    expect(CATEGORY_SYNONYM_MAP.get('화장실')).toBe('toilet');
  });
  it('공중화장실 → toilet', () => {
    expect(CATEGORY_SYNONYM_MAP.get('공중화장실')).toBe('toilet');
  });
  it('약국 → pharmacy', () => {
    expect(CATEGORY_SYNONYM_MAP.get('약국')).toBe('pharmacy');
  });
  it('주차장 → parking', () => {
    expect(CATEGORY_SYNONYM_MAP.get('주차장')).toBe('parking');
  });
  it('미등록 단어는 undefined', () => {
    expect(CATEGORY_SYNONYM_MAP.get('헬스장')).toBeUndefined();
  });
});
