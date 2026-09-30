export type SummaryReadMode = 'address' | 'compatibility';
export type SummaryTable = 'RealEstateBuildingSummary' | 'RealEstateBuildingSummaryV2';
export type SummaryPurpose = 'list' | 'keyed-detail';

export function summaryTableFor(purpose: SummaryPurpose, mode: SummaryReadMode): SummaryTable {
  return purpose === 'keyed-detail' || mode === 'address'
    ? 'RealEstateBuildingSummaryV2'
    : 'RealEstateBuildingSummary';
}

// eslint-disable-next-line no-undef
export function readSummaryMode(env: NodeJS.ProcessEnv): SummaryReadMode {
  const value = env.REAL_ESTATE_SUMMARY_MODE;
  if (value === undefined || value === '') {
    return 'address';
  }

  if (value === 'address' || value === 'compatibility') {
    return value;
  }

  throw new Error('REAL_ESTATE_SUMMARY_MODE must be unset, empty, "address", or "compatibility"');
}
