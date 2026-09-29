export interface WasteIndexInput {
  validArea: boolean;
  verifiedCoverage: boolean;
  hasPracticalContent: boolean;
  hasSource: boolean;
  duplicateGroupSize: number;
  hasDistinctVerifiedContent: boolean;
  reviewEvidence: string | null;
}

export interface WasteIndexDecision {
  eligible: boolean;
  reason: string;
}

export function evaluateWasteIndex(input: WasteIndexInput): WasteIndexDecision {
  if (!input.validArea) return { eligible: false, reason: 'invalid-area' };
  if (!input.verifiedCoverage) return { eligible: false, reason: 'unverified-coverage' };
  if (!input.hasPracticalContent) return { eligible: false, reason: 'no-practical-content' };
  if (!input.hasSource) return { eligible: false, reason: 'missing-source' };

  if (input.duplicateGroupSize > 1 && !input.hasDistinctVerifiedContent) {
    if (hasConcreteReviewEvidence(input.reviewEvidence)) {
      return { eligible: true, reason: 'reviewed-shared-schedule-exception' };
    }
    return { eligible: false, reason: 'shared-schedule-duplicate' };
  }

  return { eligible: true, reason: 'verified-distinct-content' };
}

function hasConcreteReviewEvidence(value: string | null): boolean {
  const text = value?.trim() ?? '';
  if (text.length < 20) return false;
  if (/^seo\s*(필요|need|needed|required)?$/i.test(text)) return false;
  if (/seo\s*필요/i.test(text) && !/(지역|동|출처|근거|예외|대상)/.test(text)) return false;
  return /(지역|동|출처|근거|예외|대상|공식|고시|조례|민원|행정)/.test(text);
}
