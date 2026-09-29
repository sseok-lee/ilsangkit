import { describe, expect, it } from 'vitest';
import { readSummaryMode, summaryTableFor } from '../../src/lib/realEstateSummaryStore.js';

describe('realEstateSummaryStore', () => {
  it('uses V2 for address mode list and keyed-detail reads', () => {
    expect(summaryTableFor('list', 'address')).toBe('RealEstateBuildingSummaryV2');
    expect(summaryTableFor('keyed-detail', 'address')).toBe('RealEstateBuildingSummaryV2');
  });

  it('keeps compatibility list reads on legacy while keyed-detail reads use V2', () => {
    expect(summaryTableFor('list', 'compatibility')).toBe('RealEstateBuildingSummary');
    expect(summaryTableFor('keyed-detail', 'compatibility')).toBe('RealEstateBuildingSummaryV2');
  });

  it('defaults REAL_ESTATE_SUMMARY_MODE to address', () => {
    expect(readSummaryMode({})).toBe('address');
  });

  it('accepts explicit address and the compatibility override', () => {
    expect(readSummaryMode({ REAL_ESTATE_SUMMARY_MODE: 'address' })).toBe('address');
    expect(readSummaryMode({ REAL_ESTATE_SUMMARY_MODE: 'compatibility' })).toBe('compatibility');
    expect(() => readSummaryMode({ REAL_ESTATE_SUMMARY_MODE: 'legacy' })).toThrow(/REAL_ESTATE_SUMMARY_MODE/);
    expect(() => readSummaryMode({ REAL_ESTATE_SUMMARY_MODE: 'ADDRESS' })).toThrow(/REAL_ESTATE_SUMMARY_MODE/);
  });
});
