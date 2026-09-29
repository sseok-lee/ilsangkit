import { createHash } from 'node:crypto';
import type {
  AreaReference,
  CoverageCandidate,
  ReferenceBundle,
  SearchRelation,
} from '../types/wasteArea.js';
import { resolveCoverage } from './wasteAreaResolver.js';
import { validateStrictWasteReferences, type WasteReferenceMetadata } from './wasteReferenceLoader.js';
import { evaluateWasteIndex } from './wasteIndexPolicy.js';
import { buildWasteSourceScope } from '../utils/wasteSourceScope.js';

export type WasteRevisionStateValue = 'active' | 'inactive' | 'conflict';
export type WasteScheduleProvenanceValue = 'legacy' | 'raw';

export interface WasteGenerationSourceRow {
  scheduleId: number;
  city: string;
  district: string;
  sourceId: string;
  targetRegion: string | null;
  emissionPlace: string | null;
  details: unknown;
  sourceUrl: string | null;
  govCode: string | null;
  rawPayload: unknown;
}

export interface PreviousWasteRevision extends WasteGenerationSourceRow {
  contentHash: string;
  provenance: WasteScheduleProvenanceValue;
  sourceModifiedAt: Date | null;
  observedAt: Date;
  contentUpdatedAt: Date;
  state: WasteRevisionStateValue;
  missingCompleteRuns: number;
  terminationEvidence: unknown;
}

export interface BuiltWasteRevision extends PreviousWasteRevision {
  coverageCandidates: CoverageCandidate[];
}

export interface BuiltAreaEntry {
  reference: AreaReference;
  contentFingerprint: string;
  indexEligible: boolean;
  indexReason: string;
  contentUpdatedAt: Date;
}

export interface BuiltAreaRelation {
  relation: SearchRelation;
  relationKey: string;
}

export interface PreviousWasteAreaSnapshot {
  areaKey: string;
  metadataFingerprint: string;
  contentFingerprint?: string;
  contentUpdatedAt: Date;
}

export interface WasteCollectionEvidence {
  pageCount: number;
  totalCount: number;
  pageFingerprints: string[];
  parseFailureCount: number;
  rawSourceRowCount: number;
}

export interface WasteGenerationEvidence {
  collection?: WasteCollectionEvidence;
  reference?: WasteReferenceMetadata;
}

export interface WasteGenerationPlan {
  referenceVersion: string;
  inputHash: string;
  reportHash: string;
  canPublish: boolean;
  revisions: BuiltWasteRevision[];
  areaEntries: BuiltAreaEntry[];
  areaRelations: BuiltAreaRelation[];
  report: {
    sourceCount: number;
    previousCount: number;
    activeCount: number;
    inactiveCount: number;
    conflictCount: number;
    unresolvedCoverageCount: number;
    duplicateSourceIdentities: string[];
    carriedMissingCount: number;
    sourceComplete: boolean;
    revisionHash: string;
    relationHash: string;
    coverageHash: string;
    evidence: WasteGenerationEvidence;
  };
}

interface BuildInput {
  baseGenerationId: string | null;
  references: ReferenceBundle;
  rows: WasteGenerationSourceRow[];
  provenance: WasteScheduleProvenanceValue;
  sourceComplete: boolean;
  previousRevisions: PreviousWasteRevision[];
  previousAreaSnapshots?: PreviousWasteAreaSnapshot[];
  missingStreakBroken?: boolean;
  observedAt?: Date;
  evidence?: WasteGenerationEvidence;
}

export function buildWasteGenerationPlan(input: BuildInput): WasteGenerationPlan {
  validateStrictWasteReferences(input.references);
  const observedAt = input.observedAt ?? new Date();
  const asOf = observedAt.toISOString().slice(0, 10);
  const duplicateSourceIdentities = findDuplicateSourceIdentities(input.rows);
  if (duplicateSourceIdentities.length > 0) {
    throw new Error(`duplicate waste source identity: ${duplicateSourceIdentities.join(', ')}`);
  }

  const selectedReferences = selectReferencesForGeneration(input.references.areas, asOf);
  const selectedKeys = new Set(selectedReferences.map((reference) => reference.key));
  const previousByIdentity = new Map(
    input.previousRevisions.map((revision) => [sourceIdentity(revision), revision])
  );
  const currentIdentities = new Set(input.rows.map(sourceIdentity));

  const currentRevisions = input.rows.map((row): BuiltWasteRevision => {
    const previous = previousByIdentity.get(sourceIdentity(row));
    const contentHash = hashJson(toFreshnessPayload(row));
    const sourceModifiedAt = parseSourceModifiedAt(row.details);
    const contentUpdatedAt = previous?.contentHash === contentHash
      ? previous.contentUpdatedAt
      : observedAt;
    return {
      ...row,
      contentHash,
      provenance: input.provenance,
      sourceModifiedAt,
      observedAt,
      contentUpdatedAt,
      state: 'active',
      missingCompleteRuns: 0,
      terminationEvidence: null,
      coverageCandidates: resolveCoverage({
        scheduleId: row.scheduleId,
        sourceScope: buildWasteSourceScope(row),
        city: row.city,
        district: row.district,
        targetRegion: row.targetRegion,
      }, input.references, asOf).filter((candidate) => !candidate.areaKey || selectedKeys.has(candidate.areaKey)),
    };
  });

  const carriedMissing = input.previousRevisions
    .filter((revision) => !currentIdentities.has(sourceIdentity(revision)))
    .map((revision): BuiltWasteRevision => {
      const nextMissingRuns = input.sourceComplete
        ? (input.missingStreakBroken ? 1 : revision.missingCompleteRuns + 1)
        : revision.missingCompleteRuns;
      const nextState: WasteRevisionStateValue = revision.state === 'inactive' || nextMissingRuns >= 2
        ? 'inactive'
        : revision.state;
      return {
        ...revision,
        observedAt,
        state: nextState,
        missingCompleteRuns: nextMissingRuns,
        terminationEvidence: nextState === 'inactive'
          ? (revision.terminationEvidence ?? {
              reason: 'missing in two consecutive complete collections',
              sourceComplete: input.sourceComplete,
            })
          : revision.terminationEvidence,
        coverageCandidates: resolveCoverage({
          scheduleId: revision.scheduleId,
          sourceScope: buildWasteSourceScope(revision),
          city: revision.city,
          district: revision.district,
          targetRegion: revision.targetRegion,
        }, input.references, asOf).filter((candidate) => !candidate.areaKey || selectedKeys.has(candidate.areaKey)),
      };
    });

  const revisions = [...currentRevisions, ...carriedMissing];
  const selectedRelations = input.references.relations
    .filter((relation) => selectedKeys.has(relation.toKey) && (!relation.fromKey || selectedKeys.has(relation.fromKey)));
  const areaEntries = buildAreaEntries(
    selectedReferences,
    selectedRelations,
    revisions,
    observedAt,
    input.previousAreaSnapshots ?? []
  );
  const areaRelations = selectedRelations
    .filter((relation) => selectedKeys.has(relation.toKey) && (!relation.fromKey || selectedKeys.has(relation.fromKey)))
    .map((relation) => ({
      relation,
      relationKey: hashJson(relation),
    }));
  const unresolvedCoverageCount = revisions.flatMap((revision) => revision.coverageCandidates)
    .filter((candidate) => candidate.state !== 'verified').length;
  const conflictCount = revisions.filter((revision) => revision.state === 'conflict').length;
  const revisionHash = hashJson(revisions.map((revision) => ({
    scheduleId: revision.scheduleId,
    sourceId: revision.sourceId,
    state: revision.state,
    contentHash: revision.contentHash,
    missingCompleteRuns: revision.missingCompleteRuns,
    sourceModifiedAt: revision.sourceModifiedAt,
  })));
  const relationHash = hashJson(areaRelations.map(({ relationKey, relation }) => ({ relationKey, relation })));
  const coverageHash = hashJson(revisions.flatMap((revision) => revision.coverageCandidates.map((candidate) => ({
    scheduleId: revision.scheduleId,
    key: buildWasteCoverageKey(candidate),
    areaKey: candidate.areaKey,
    districtCode: candidate.districtCode,
    scope: candidate.scope,
    conditionText: candidate.conditionText,
    state: candidate.state,
    reason: candidate.reason,
  }))));
  const evidence = normalizeEvidence(input.evidence);
  const report = {
    sourceCount: input.rows.length,
    previousCount: input.previousRevisions.length,
    activeCount: revisions.filter((revision) => revision.state === 'active').length,
    inactiveCount: revisions.filter((revision) => revision.state === 'inactive').length,
    conflictCount,
    unresolvedCoverageCount,
    duplicateSourceIdentities,
    carriedMissingCount: carriedMissing.length,
    sourceComplete: input.sourceComplete,
    revisionHash,
    relationHash,
    coverageHash,
    evidence,
  };
  const inputHash = hashJson({
    baseGenerationId: input.baseGenerationId,
    referenceVersion: input.references.version,
    rows: input.rows.map(toContentPayload),
    sourceComplete: input.sourceComplete,
    evidence,
  });
  const reportHash = hashJson({ ...report, inputHash, referenceVersion: input.references.version });

  return {
    referenceVersion: input.references.version,
    inputHash,
    reportHash,
    canPublish: input.sourceComplete && input.rows.length > 0 && conflictCount === 0,
    revisions,
    areaEntries,
    areaRelations,
    report,
  };
}

function buildAreaEntries(
  references: AreaReference[],
  relations: SearchRelation[],
  revisions: BuiltWasteRevision[],
  observedAt: Date,
  previousAreaSnapshots: PreviousWasteAreaSnapshot[]
): BuiltAreaEntry[] {
  const publicContentByKey = new Map<string, string>();
  const areaPayloadsByKey = new Map<string, Array<{ revision: BuiltWasteRevision; scope: string; conditionText: string }>>();
  const metadataFingerprintByKey = new Map<string, string>();
  const previousSnapshotByKey = new Map(previousAreaSnapshots.map((snapshot) => [snapshot.areaKey, snapshot]));

  for (const reference of references) {
    const rows = collectAreaPublicRows(reference, revisions);
    areaPayloadsByKey.set(reference.key, rows);
    publicContentByKey.set(reference.key, hashJson(toPublicScheduleTuples(rows)));
    metadataFingerprintByKey.set(reference.key, areaMetadataFingerprint(reference, relations));
  }

  const duplicateGroupSizes = new Map<string, number>();
  for (const reference of references) {
    const rows = areaPayloadsByKey.get(reference.key) ?? [];
    if (!isPublicAdminDongCandidate(reference, rows)) continue;
    const fingerprint = publicContentByKey.get(reference.key) ?? hashJson([]);
    duplicateGroupSizes.set(fingerprint, (duplicateGroupSizes.get(fingerprint) ?? 0) + 1);
  }

  return references.map((reference) => {
    const rows = areaPayloadsByKey.get(reference.key) ?? [];
    const contentFingerprint = publicContentByKey.get(reference.key) ?? hashJson([]);
    const duplicateGroupSize = duplicateGroupSizes.get(contentFingerprint) ?? 1;
    const validArea = reference.kind === 'administrative' && reference.level === 'dong';
    const hasPracticalContent = rows.some((row) => hasPracticalScheduleContent(row.revision));
    const decision = evaluateWasteIndex({
      validArea,
      verifiedCoverage: rows.length > 0,
      hasPracticalContent,
      hasSource: rows.some((row) => hasPublicSource(row.revision)),
      duplicateGroupSize,
      hasDistinctVerifiedContent: rows.length > 0 && duplicateGroupSize === 1,
      reviewEvidence: null,
    });
    const metadataFingerprint = metadataFingerprintByKey.get(reference.key) ?? hashJson(null);
    const previousSnapshot = previousSnapshotByKey.get(reference.key);
    const metadataChanged = previousSnapshot !== undefined && previousSnapshot.metadataFingerprint !== metadataFingerprint;
    const contentChanged = previousSnapshot?.contentFingerprint !== undefined
      && previousSnapshot.contentFingerprint !== contentFingerprint;

    return {
      reference,
      contentFingerprint,
      indexEligible: decision.eligible,
      indexReason: decision.reason,
      contentUpdatedAt: metadataChanged || contentChanged
        ? observedAt
        : (previousSnapshot?.contentUpdatedAt ?? latestContentUpdatedAt(rows.map((row) => row.revision), observedAt)),
    };
  });
}


function toPublicScheduleTuples(
  rows: Array<{ revision: BuiltWasteRevision; scope: string; conditionText: string }>
): Array<{ scheduleContentHash: string; scope: string; conditionText: string }> {
  const tuples = rows.map((row) => ({
    scheduleContentHash: hashJson(toPublicScheduleContent(row.revision)),
    scope: row.scope,
    conditionText: row.conditionText,
  })).sort((a, b) => (
    a.scheduleContentHash.localeCompare(b.scheduleContentHash)
    || a.scope.localeCompare(b.scope)
    || a.conditionText.localeCompare(b.conditionText)
  ));
  const seen = new Set<string>();
  return tuples.filter((tuple) => {
    const key = `${tuple.scheduleContentHash}\u0000${tuple.scope}\u0000${tuple.conditionText}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isPublicAdminDongCandidate(
  reference: AreaReference,
  rows: Array<{ revision: BuiltWasteRevision; scope: string; conditionText: string }>
): boolean {
  return reference.kind === 'administrative'
    && reference.level === 'dong'
    && rows.length > 0
    && rows.some((row) => hasPublicSource(row.revision))
    && rows.some((row) => hasPracticalScheduleContent(row.revision));
}

function areaMetadataFingerprint(reference: AreaReference, relations: SearchRelation[]): string {
  const relationKeys = relations
    .filter((relation) => relation.toKey === reference.key || relation.fromKey === reference.key)
    .map((relation) => hashJson(relation))
    .sort();
  return hashJson({
    reference: areaReferenceMetadata(reference),
    relationKeys,
  });
}

function areaReferenceMetadata(reference: AreaReference): unknown {
  return {
    key: reference.key,
    kind: reference.kind,
    level: reference.level,
    code: reference.code,
    city: reference.city,
    district: reference.district,
    districtCode: reference.districtCode,
    name: reference.name,
    effectiveFrom: reference.evidence.effectiveFrom,
    effectiveTo: reference.evidence.effectiveTo,
  };
}

function collectAreaPublicRows(
  reference: AreaReference,
  revisions: BuiltWasteRevision[]
): Array<{ revision: BuiltWasteRevision; scope: string; conditionText: string }> {
  const rows: Array<{ revision: BuiltWasteRevision; scope: string; conditionText: string }> = [];
  const seen = new Set<string>();

  for (const revision of revisions) {
    if (revision.state !== 'active' || revision.sourceId.startsWith('seed-')) continue;
    for (const candidate of revision.coverageCandidates) {
      if (candidate.state !== 'verified') continue;
      if (candidate.areaKey !== reference.key && candidate.districtCode !== reference.districtCode) continue;
      const key = `${revision.scheduleId}\u0000${candidate.scope}\u0000${candidate.conditionText}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push({
        revision,
        scope: candidate.scope,
        conditionText: candidate.conditionText,
      });
    }
  }

  return rows.sort((a, b) =>
    a.revision.scheduleId - b.revision.scheduleId
    || a.scope.localeCompare(b.scope)
    || a.conditionText.localeCompare(b.conditionText)
  );
}

function toPublicScheduleContent(revision: BuiltWasteRevision): unknown {
  return {
    city: revision.city,
    district: revision.district,
    emissionPlace: revision.emissionPlace,
    details: stripCollectionOnlyFields(revision.details),
  };
}

function stripCollectionOnlyFields(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripCollectionOnlyFields);
  if (!value || typeof value !== 'object' || value instanceof Date) return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !['collectedAt', 'observedAt'].includes(key))
      .map(([key, entryValue]) => [key, stripCollectionOnlyFields(entryValue)])
  );
}

function hasPublicSource(revision: BuiltWasteRevision): boolean {
  return Boolean(revision.sourceUrl?.trim() || revision.govCode?.trim());
}

const PRACTICAL_SCHEDULE_FIELD_PATTERN = /(day|요일|time|시간|method|방법|content|내용|배출일|배출요일|배출시간|배출방법|수거일|수거요일|수거시간|수거방법)/i;

function hasPracticalScheduleContent(revision: BuiltWasteRevision): boolean {
  return hasPracticalScheduleFieldValue(stripCollectionOnlyFields(revision.details));
}

function hasPracticalScheduleFieldValue(value: unknown, key = ''): boolean {
  if (value == null) return false;
  if (Array.isArray(value)) return value.some((entry) => hasPracticalScheduleFieldValue(entry, key));
  if (typeof value === 'object' && !(value instanceof Date)) {
    return Object.entries(value as Record<string, unknown>).some(([childKey, childValue]) => (
      hasPracticalScheduleFieldValue(childValue, childKey)
    ));
  }
  return PRACTICAL_SCHEDULE_FIELD_PATTERN.test(key) && hasPracticalValue(value);
}

function hasPracticalValue(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value === 'boolean') return value;
  if (value instanceof Date) return true;
  if (Array.isArray(value)) return value.some(hasPracticalValue);
  if (typeof value === 'object') return Object.values(value as Record<string, unknown>).some(hasPracticalValue);
  return false;
}

function latestContentUpdatedAt(revisions: BuiltWasteRevision[], fallback: Date): Date {
  return revisions.reduce((latest, revision) => (
    revision.contentUpdatedAt > latest ? revision.contentUpdatedAt : latest
  ), revisions[0]?.contentUpdatedAt ?? fallback);
}

export function buildWasteCoverageKey(candidate: {
  areaKey: string | null;
  districtCode: string | null;
  scope: string;
  conditionText: string;
  reason: string;
}): string {
  return hashJson({
    areaKey: candidate.areaKey,
    districtCode: candidate.districtCode,
    scope: candidate.scope,
    conditionText: candidate.conditionText,
    reason: candidate.reason,
  });
}

function selectReferencesForGeneration(areas: AreaReference[], asOf: string): AreaReference[] {
  const byKey = new Map<string, AreaReference[]>();
  for (const area of areas) {
    const entries = byKey.get(area.key) ?? [];
    entries.push(area);
    byKey.set(area.key, entries);
  }

  const selected: AreaReference[] = [];
  for (const [key, versions] of byKey) {
    const active = versions.filter((area) => isEffective(area, asOf));
    if (active.length > 1) {
      throw new Error(`overlapping active reference versions for ${key}`);
    }
    if (active.length === 1) {
      selected.push(active[0]);
      continue;
    }
    const historical = [...versions].sort((a, b) => compareEffectiveDate(b, a));
    if (historical[0]) selected.push(historical[0]);
  }
  return selected.sort((a, b) => a.key.localeCompare(b.key));
}

function isEffective(area: AreaReference, asOf: string): boolean {
  return area.evidence.effectiveFrom <= asOf && (!area.evidence.effectiveTo || area.evidence.effectiveTo >= asOf);
}

function compareEffectiveDate(a: AreaReference, b: AreaReference): number {
  const from = a.evidence.effectiveFrom.localeCompare(b.evidence.effectiveFrom);
  if (from !== 0) return from;
  return (a.evidence.effectiveTo ?? '').localeCompare(b.evidence.effectiveTo ?? '');
}

function normalizeEvidence(evidence: WasteGenerationEvidence | undefined): WasteGenerationEvidence {
  return evidence ? JSON.parse(stableStringify(evidence)) as WasteGenerationEvidence : {};
}

function findDuplicateSourceIdentities(rows: WasteGenerationSourceRow[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const row of rows) {
    const key = sourceIdentity(row);
    if (seen.has(key)) duplicates.add(key);
    seen.add(key);
  }
  return [...duplicates].sort();
}

function sourceIdentity(row: Pick<WasteGenerationSourceRow, 'city' | 'district' | 'sourceId'>): string {
  return `${row.city}\u0000${row.district}\u0000${row.sourceId}`;
}

function toContentPayload(row: WasteGenerationSourceRow): unknown {
  return {
    city: row.city,
    district: row.district,
    sourceId: row.sourceId,
    targetRegion: row.targetRegion,
    emissionPlace: row.emissionPlace,
    details: row.details,
    sourceUrl: row.sourceUrl,
    govCode: row.govCode,
  };
}

function toFreshnessPayload(row: WasteGenerationSourceRow): unknown {
  return {
    city: row.city,
    district: row.district,
    sourceId: row.sourceId,
    targetRegion: row.targetRegion,
    emissionPlace: row.emissionPlace,
    details: stripCollectionOnlyFields(row.details),
    sourceUrl: row.sourceUrl,
    govCode: row.govCode,
  };
}

function parseSourceModifiedAt(details: unknown): Date | null {
  if (!details || typeof details !== 'object' || !('lastModified' in details)) return null;
  const value = (details as { lastModified?: unknown }).lastModified;
  if (typeof value !== 'string' || value.trim() === '') return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function hashWasteJson(value: unknown): string {
  return hashJson(value);
}

function hashJson(value: unknown): string {
  return createHash('sha256').update(stableStringify(value)).digest('hex');
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, entryValue]) => entryValue !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`).join(',')}}`;
}
