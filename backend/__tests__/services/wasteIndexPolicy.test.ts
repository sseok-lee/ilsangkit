import { describe, expect, it } from 'vitest';
import { evaluateWasteIndex } from '../../src/services/wasteIndexPolicy.js';

const eligibleInput = {
  validArea: true,
  verifiedCoverage: true,
  hasPracticalContent: true,
  hasSource: true,
  duplicateGroupSize: 1,
  hasDistinctVerifiedContent: true,
  reviewEvidence: null,
};

describe('evaluateWasteIndex', () => {
  it('holds pages that only rename the same shared schedule', () => {
    expect(evaluateWasteIndex({
      validArea: true,
      verifiedCoverage: true,
      hasPracticalContent: true,
      hasSource: true,
      duplicateGroupSize: 22,
      hasDistinctVerifiedContent: false,
      reviewEvidence: null,
    }).eligible).toBe(false);
  });

  it('requires source evidence before public indexing', () => {
    expect(evaluateWasteIndex({ ...eligibleInput, hasSource: false })).toEqual({
      eligible: false,
      reason: 'missing-source',
    });
  });

  it('does not accept SEO-only review notes as duplicate exceptions', () => {
    expect(evaluateWasteIndex({
      ...eligibleInput,
      duplicateGroupSize: 4,
      hasDistinctVerifiedContent: false,
      reviewEvidence: 'SEO 필요',
    })).toEqual({
      eligible: false,
      reason: 'shared-schedule-duplicate',
    });
  });

  it('allows duplicate exceptions only when review evidence names a concrete local basis', () => {
    expect(evaluateWasteIndex({
      ...eligibleInput,
      duplicateGroupSize: 4,
      hasDistinctVerifiedContent: false,
      reviewEvidence: '역삼1동 공동주택 예외 대상은 강남구 공식 출처에서 별도 적용 근거가 확인됨',
    })).toEqual({
      eligible: true,
      reason: 'reviewed-shared-schedule-exception',
    });
  });
});
