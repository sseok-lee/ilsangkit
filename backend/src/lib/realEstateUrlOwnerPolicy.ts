import {
  classifyLegacyUrlObservation,
  type LegacyRealEstateUrlBaselineEntry,
  type LegacyUrlObservation,
  type LegacyUrlObservationClassification,
  type LegacyUrlObservationParcel,
} from './realEstateUrlBaseline.js';

export interface LegacyUrlLatestEvidence {
  dongName: string | null;
  jibun: string | null;
  transactions: string | number;
  latestDate: string | number;
}

export interface LegacyUrlOwnerPolicyOptions {
  policyEvidenceObservedAt?: string | null;
}

interface AddressEvidence {
  dongName: string;
  jibun: string;
  transactions: number;
  latestDate: number;
}

interface CapturedParcel {
  dongName: string;
  jibun: string;
  transactions: number;
}

interface SelectedParcel extends CapturedParcel {
  latestDate?: number;
}

type PolicyResult = LegacyUrlObservationClassification;

export function resolveLegacyUrlOwnerPolicy(
  observation: LegacyUrlObservation,
  latestEvidence: LegacyUrlLatestEvidence[] = [],
  options: LegacyUrlOwnerPolicyOptions = {}
): PolicyResult {
  const classification = classifyLegacyUrlObservation(observation);
  if (classification.status === 'confirmed') return classification;
  if (classification.reason !== 'display-address-conflict') return classification;

  const type = normalizeText(observation.type);
  const basePath = normalizeText(observation.basePath);
  const observedAt = normalizeText(observation.at);
  const displayedDong = normalizeText(observation.info?.dongName);
  if (!type || !basePath || !observedAt || !displayedDong) {
    return unresolved('policy observation is missing required identity');
  }

  const captured = aggregateCapturedParcels(observation.parcels ?? []);
  if (!captured.ok) return unresolved(captured.detail);

  const policyEvidence =
    latestEvidence.length > 0 ? parseAndValidatePolicyEvidence(latestEvidence, captured.value) : null;
  if (policyEvidence?.ok === false) return unresolved(policyEvidence.detail);

  const candidates = captured.value.filter((parcel) => parcel.dongName === displayedDong);
  if (candidates.length === 0) {
    return unresolved('policy found no captured parcel in displayed dong');
  }

  const maxTransactions = Math.max(...candidates.map((candidate) => candidate.transactions));
  const topCountCandidates = candidates.filter(
    (candidate) => candidate.transactions === maxTransactions
  );

  const selected =
    topCountCandidates.length === 1
      ? {
          evidence: topCountCandidates[0],
          reason: 'max-transactions-within-displayed-dong',
        }
      : selectByLatestDate(topCountCandidates, policyEvidence?.value ?? []);

  if (!selected) {
    return unresolved(
      latestEvidence.length > 0
        ? 'policy latest-date tie in displayed dong'
        : 'policy latest-date evidence is missing for transaction-count tie'
    );
  }

  return {
    status: 'confirmed',
    entry: buildEntry({
      type,
      basePath,
      observedAt,
      policyEvidenceObservedAt: options.policyEvidenceObservedAt,
      displayedDong,
      evidence: selected.evidence,
      reason: selected.reason,
    }),
  };
}

function buildEntry(input: {
  type: string;
  basePath: string;
  observedAt: string;
  policyEvidenceObservedAt?: string | null;
  displayedDong: string;
  evidence: SelectedParcel;
  reason: string;
}): LegacyRealEstateUrlBaselineEntry {
  const policyEvidenceObservedAt =
    input.evidence.latestDate === undefined
      ? 'not-required'
      : normalizeText(input.policyEvidenceObservedAt) || 'not-provided';
  const latestDateProvenance =
    input.evidence.latestDate === undefined ? '' : ` latestDate=${input.evidence.latestDate}`;
  return {
    type: input.type,
    basePath: input.basePath,
    dongName: input.evidence.dongName,
    jibun: input.evidence.jibun,
    provenance:
      `approved-fixed-owner-policy-v1 observation=${input.observedAt}` +
      ` policyEvidence=${policyEvidenceObservedAt}` +
      ` reason=${input.reason}` +
      ` displayedDong=${input.displayedDong}` +
      ` transactions=${input.evidence.transactions}` +
      latestDateProvenance,
  };
}

function selectByLatestDate(
  candidates: CapturedParcel[],
  policyEvidence: AddressEvidence[]
): { evidence: SelectedParcel; reason: string } | null {
  if (policyEvidence.length === 0) return null;

  const evidenceByKey = new Map(policyEvidence.map((evidence) => [addressKey(evidence), evidence]));
  const candidatesWithDates = candidates.map((candidate) => {
    const evidence = evidenceByKey.get(addressKey(candidate));
    return evidence ? { ...candidate, latestDate: evidence.latestDate } : null;
  });
  if (candidatesWithDates.some((candidate) => !candidate)) return null;

  const completeCandidates = candidatesWithDates as SelectedParcel[];
  const maxLatestDate = Math.max(...completeCandidates.map((candidate) => candidate.latestDate ?? 0));
  const latestCandidates = completeCandidates.filter(
    (candidate) => candidate.latestDate === maxLatestDate
  );
  if (latestCandidates.length !== 1) return null;
  return {
    evidence: latestCandidates[0],
    reason: 'latest-transaction-date-tiebreak-within-displayed-dong',
  };
}

function aggregateCapturedParcels(
  parcels: LegacyUrlObservationParcel[]
):
  | { ok: true; value: CapturedParcel[] }
  | { ok: false; detail: string } {
  const byKey = new Map<string, CapturedParcel>();
  for (const parcel of parcels) {
    const dongName = normalizeText(parcel.dongName);
    const jibun = normalizeText(parcel.jibun);
    if (!dongName || !jibun) return { ok: false, detail: 'captured parcel address is invalid' };

    const transactions = parsePositiveSafeInteger(parcel.transactions);
    if (transactions === null) return { ok: false, detail: 'captured parcel count is invalid' };

    const key = addressKey({ dongName, jibun });
    const previous = byKey.get(key);
    if (previous) {
      previous.transactions += transactions;
      if (!Number.isSafeInteger(previous.transactions)) {
        return { ok: false, detail: 'captured parcel count is invalid' };
      }
      continue;
    }

    byKey.set(key, { dongName, jibun, transactions });
  }

  if (byKey.size === 0) return { ok: false, detail: 'captured parcel keys are missing' };
  return { ok: true, value: [...byKey.values()] };
}

function parseAndValidatePolicyEvidence(
  latestEvidence: LegacyUrlLatestEvidence[],
  captured: CapturedParcel[]
):
  | { ok: true; value: AddressEvidence[] }
  | { ok: false; detail: string } {
  const parsed: AddressEvidence[] = [];
  const seen = new Set<string>();

  for (const evidence of latestEvidence) {
    const dongName = normalizeText(evidence.dongName);
    const jibun = normalizeText(evidence.jibun);
    if (!dongName || !jibun) return { ok: false, detail: 'policy evidence address is invalid' };

    const key = addressKey({ dongName, jibun });
    if (seen.has(key)) return { ok: false, detail: 'policy evidence has duplicate parcel keys' };
    seen.add(key);

    const transactions = parsePositiveSafeInteger(evidence.transactions);
    if (transactions === null) return { ok: false, detail: 'policy evidence count is invalid' };

    const latestDate = parseLatestDate(evidence.latestDate);
    if (latestDate === null) return { ok: false, detail: 'policy evidence latest date is invalid' };

    parsed.push({ dongName, jibun, transactions, latestDate });
  }

  if (parsed.length === 0) return { ok: false, detail: 'policy evidence is missing' };

  const capturedKeys = new Set(captured.map(addressKey));
  const evidenceKeys = new Set(parsed.map(addressKey));
  if (capturedKeys.size !== evidenceKeys.size || !sameKeySet(capturedKeys, evidenceKeys)) {
    return { ok: false, detail: 'policy evidence does not match captured parcel keys' };
  }

  const capturedByKey = new Map(captured.map((parcel) => [addressKey(parcel), parcel]));
  for (const evidence of parsed) {
    if (capturedByKey.get(addressKey(evidence))?.transactions !== evidence.transactions) {
      return { ok: false, detail: 'policy evidence does not match captured parcel counts' };
    }
  }

  return { ok: true, value: parsed };
}

function parsePositiveSafeInteger(value: string | number | undefined): number | null {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

function parseLatestDate(value: string | number): number | null {
  const normalized = typeof value === 'number' ? String(value) : value.trim();
  if (!/^\d{8}$/.test(normalized)) return null;

  const year = Number(normalized.slice(0, 4));
  const month = Number(normalized.slice(4, 6));
  const day = Number(normalized.slice(6, 8));
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return Number(normalized);
}

function unresolved(detail: string): PolicyResult {
  return { status: 'unresolved', reason: 'display-address-conflict', detail };
}

function sameKeySet(left: Set<string>, right: Set<string>): boolean {
  for (const key of left) {
    if (!right.has(key)) return false;
  }
  return true;
}

function addressKey(address: { dongName: string; jibun: string }): string {
  return `${address.dongName}\x1f${address.jibun}`;
}

function normalizeText(value?: string | null): string {
  return typeof value === 'string' ? value.trim().normalize('NFC') : '';
}
