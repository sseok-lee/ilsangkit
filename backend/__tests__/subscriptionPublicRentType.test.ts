// @TASK publicRentType 필드 추가 (TDD)
// @TEST __tests__/subscriptionPublicRentType.test.ts

import { describe, it, expect } from 'vitest';
import { derivePublicRentType } from '../src/utils/subscriptionUtils.js';

describe('derivePublicRentType', () => {
  describe('영구임대 매핑', () => {
    it('should return 영구임대 when houseDetailType contains 영구임대', () => {
      expect(derivePublicRentType('영구임대', '임대주택')).toBe('영구임대');
    });

    it('should return 영구임대 with prefix', () => {
      expect(derivePublicRentType('영구임대주택', '임대주택')).toBe('영구임대');
    });

    it('should return 영구임대 with suffix', () => {
      expect(derivePublicRentType('50년 영구임대', '임대주택')).toBe('영구임대');
    });
  });

  describe('국민임대 매핑', () => {
    it('should return 국민임대 when houseDetailType contains 국민임대', () => {
      expect(derivePublicRentType('국민임대', '임대주택')).toBe('국민임대');
    });

    it('should return 국민임대 with prefix', () => {
      expect(derivePublicRentType('국민임대주택', '임대주택')).toBe('국민임대');
    });
  });

  describe('장기전세 매핑', () => {
    it('should return 장기전세 when houseDetailType contains 장기전세', () => {
      expect(derivePublicRentType('장기전세', '임대주택')).toBe('장기전세');
    });

    it('should return 장기전세 with prefix', () => {
      expect(derivePublicRentType('5년 장기전세', '임대주택')).toBe('장기전세');
    });
  });

  describe('공공임대 매핑', () => {
    it('should return 공공임대 when houseDetailType contains 공공임대', () => {
      expect(derivePublicRentType('공공임대', '임대주택')).toBe('공공임대');
    });

    it('should return 공공임대 with prefix', () => {
      expect(derivePublicRentType('공공임대주택', '임대주택')).toBe('공공임대');
    });
  });

  describe('행복주택 매핑', () => {
    it('should return 행복주택 when houseDetailType contains 행복주택', () => {
      expect(derivePublicRentType('행복주택', '임대주택')).toBe('행복주택');
    });
  });

  describe('역세권청년주택 매핑', () => {
    it('should return 역세권청년주택 when houseDetailType contains 역세권청년', () => {
      expect(derivePublicRentType('역세권청년주택', '임대주택')).toBe('역세권청년주택');
    });

    it('should return 역세권청년주택 when houseDetailType contains 역세권청', () => {
      expect(derivePublicRentType('역세권청', '임대주택')).toBe('역세권청년주택');
    });
  });

  describe('재개발임대 매핑', () => {
    it('should return 재개발임대 when houseDetailType contains 재개발임대', () => {
      expect(derivePublicRentType('재개발임대', '임대주택')).toBe('재개발임대');
    });

    it('should return 재개발임대 with prefix', () => {
      expect(derivePublicRentType('재개발임대주택', '임대주택')).toBe('재개발임대');
    });
  });

  describe('기본값 공공임대', () => {
    it('should return 공공임대 when rentType is 임대주택 but no specific type matched', () => {
      expect(derivePublicRentType('기타임대', '임대주택')).toBe('공공임대');
    });

    it('should return 공공임대 when houseDetailType is null and rentType is 임대주택', () => {
      expect(derivePublicRentType(null, '임대주택')).toBe('공공임대');
    });

    it('should return 공공임대 when houseDetailType is empty and rentType is 임대주택', () => {
      expect(derivePublicRentType('', '임대주택')).toBe('공공임대');
    });
  });

  describe('분양주택 (rentType !== 임대주택)', () => {
    it('should return null when rentType is 분양주택', () => {
      expect(derivePublicRentType('공공임대', '분양주택')).toBe(null);
    });

    it('should return null when rentType is null', () => {
      expect(derivePublicRentType('공공임대', null)).toBe(null);
    });

    it('should return null when rentType is empty', () => {
      expect(derivePublicRentType('공공임대', '')).toBe(null);
    });

    it('should return null when both houseDetailType and rentType are null', () => {
      expect(derivePublicRentType(null, null)).toBe(null);
    });
  });

  describe('edge cases', () => {
    it('should handle case-insensitive matching (if applicable)', () => {
      // Korean characters are matched exactly
      expect(derivePublicRentType('영구임대', '임대주택')).toBe('영구임대');
    });

    it('should prioritize first match when multiple keywords present', () => {
      // 영구임대 should match before 공공임대
      expect(derivePublicRentType('영구임대 공공임대', '임대주택')).toBe('영구임대');
    });

    it('should handle whitespace in houseDetailType', () => {
      expect(derivePublicRentType('  영구임대  ', '임대주택')).toBe('영구임대');
    });
  });
});
