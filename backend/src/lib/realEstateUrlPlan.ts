import { createHash } from 'node:crypto';
import { toRealEstateUrl, type RealEstateUrlType } from './realEstateUrl.js';

export interface RealEstateUrlCandidate {
  type: RealEstateUrlType | string;
  buildingKey: string;
  bjdCode: string;
  city: string;
  district: string;
  buildingName: string;
  dongName: string | null;
  jibun: string | null;
}

export interface ExistingRealEstateUrlMapping {
  type: string;
  buildingKey: string;
  bjdCode: string;
  buildingName: string;
  canonicalPath: string;
  basePath?: string | null;
  dongName?: string | null;
  jibun?: string | null;
  evidence?: unknown;
}

export interface LegacyRealEstateUrlBaselineEntry {
  type: string;
  basePath: string;
  dongName: string | null;
  jibun: string | null;
  provenance: string;
}

export interface PlannedRealEstatePublicUrl {
  type: string;
  buildingKey: string;
  bjdCode: string;
  buildingName: string;
  basePath: string;
  basePathHash: string;
  canonicalPath: string;
  pathHash: string;
  dongName: string | null;
  jibun: string | null;
  addressSnapshot: {
    city: string;
    district: string;
    bjdCode: string;
    buildingName: string;
    dongName: string | null;
    jibun: string | null;
  };
  evidence: Record<string, unknown>;
  sourceFingerprint: string;
  baselineProvenance: string | null;
  createdAt: Date;
}

export type RealEstateUrlPlanBlockerKind =
  | 'missing-legacy-owner'
  | 'ambiguous-legacy-owner'
  | 'missing-readable-address'
  | 'readable-suffix-clash'
  | 'canonical-path-clash'
  | 'unresolved-baseline-entry';

export interface RealEstateUrlPlanBlocker {
  kind: RealEstateUrlPlanBlockerKind;
  basePath: string;
  buildingKeys: string[];
  detail?: string;
}

export interface RealEstateUrlPlanInput {
  unresolvedPolicy?: 'block' | 'defer';
  existing: ExistingRealEstateUrlMapping[];
  current: RealEstateUrlCandidate[];
  legacyBaseline: LegacyRealEstateUrlBaselineEntry[];
  sourceFingerprint: string;
  baselineProvenance: string | null;
  generatedAt: Date;
}

export interface RealEstateUrlPlan {
  mappings: PlannedRealEstatePublicUrl[];
  toCreate: PlannedRealEstatePublicUrl[];
  blockers: RealEstateUrlPlanBlocker[];
  deferred: RealEstateUrlPlanBlocker[];
}

export function hashRealEstatePublicPath(path: string): string {
  return createHash('sha256').update(path.normalize('NFC')).digest('hex');
}

export function realEstateBasePath(candidate: RealEstateUrlCandidate): string {
  return toRealEstateUrl({
    type: candidate.type as RealEstateUrlType,
    city: candidate.city,
    district: candidate.district,
    buildingName: candidate.buildingName.normalize('NFC'),
  });
}

export function readableAddressSuffix(candidate: RealEstateUrlCandidate): string | null {
  const dongName = candidate.dongName?.trim().normalize('NFC');
  const jibun = candidate.jibun?.trim().normalize('NFC');
  if (!dongName || !jibun) return null;
  return encodeURIComponent(`${dongName}-${jibun}`);
}

export function planRealEstatePublicUrls(input: RealEstateUrlPlanInput): RealEstateUrlPlan {
  const existingByKey = new Map(
    input.existing.map((row) => [mappingKey(row.type, row.buildingKey), row])
  );
  const existingByBase = groupBy(
    input.existing.filter((row) => row.basePath),
    (row) => `${row.type}\x1f${normalizePath(row.basePath ?? '')}`
  );
  const baselineByBase = groupBy(
    input.legacyBaseline,
    (entry) => `${entry.type}\x1f${normalizePath(entry.basePath)}`
  );
  const candidatesByBase = groupBy(
    input.current,
    (candidate) => `${candidate.type}\x1f${realEstateBasePath(candidate)}`
  );
  const mappings: PlannedRealEstatePublicUrl[] = [];
  const toCreate: PlannedRealEstatePublicUrl[] = [];
  const blockers: RealEstateUrlPlanBlocker[] = [];
  const deferred: RealEstateUrlPlanBlocker[] = [];
  const usedPaths = new Map<string, string>();
  const knownBases = new Set<string>();

  for (const existing of input.existing) {
    usedPaths.set(existing.canonicalPath, mappingKey(existing.type, existing.buildingKey));
    if (existing.basePath)
      knownBases.add(`${existing.type}\x1f${normalizePath(existing.basePath)}`);
  }

  for (const group of candidatesByBase.values()) {
    const basePath = realEstateBasePath(group[0]);
    const baseKey = `${group[0].type}\x1f${basePath}`;
    knownBases.add(baseKey);
    const pending = group.filter((candidate) => {
      const existing = existingByKey.get(mappingKey(candidate.type, candidate.buildingKey));
      if (!existing) return true;
      const planned = plannedFromExisting(candidate, existing, input);
      mappings.push(planned);
      usedPaths.set(planned.canonicalPath, mappingKey(candidate.type, candidate.buildingKey));
      return false;
    });
    if (pending.length === 0) continue;

    const existingGroup = existingByBase.get(baseKey) ?? [];
    const heldGroup = existingGroup.some((row) => isDeferredRealEstateUrlEvidence(row.evidence));
    let assignments = assignGroup(
      basePath,
      pending,
      baselineByBase.get(baseKey) ?? [],
      existingGroup
    );
    const eligibleReasons = new Set([
      'missing-legacy-owner',
      'ambiguous-legacy-owner',
      'missing-readable-address',
    ]);
    const canDefer =
      new Set([...group, ...existingGroup].map((row) => row.bjdCode)).size === 1 &&
      existingGroup.every((row) => isDeferredRealEstateUrlEvidence(row.evidence));
    const deferGroup =
      canDefer &&
      (heldGroup ||
        (input.unresolvedPolicy === 'defer' &&
          assignments.blockers.length > 0 &&
          assignments.blockers.every((blocker) => eligibleReasons.has(blocker.kind))));
    const reasons = heldGroup
      ? ['existing-deferred-group']
      : [...new Set(assignments.blockers.map((row) => row.kind))];
    if (deferGroup) {
      deferred.push(...assignments.blockers);
      assignments = {
        paths: pending.map((candidate) => [candidate, basePath]),
        blockers: [],
      };
    } else if (heldGroup) {
      // Never claim a held base when a new region appears in the same name group.
      assignments = {
        paths: [],
        blockers: [
          {
            kind: 'ambiguous-legacy-owner',
            basePath,
            buildingKeys: pending.map((row) => mappingKey(row.type, row.buildingKey)),
          },
        ],
      };
    }
    blockers.push(...assignments.blockers);
    for (const [candidate, canonicalPath] of assignments.paths) {
      const owner = usedPaths.get(canonicalPath);
      const candidateKey = mappingKey(candidate.type, candidate.buildingKey);
      if (owner && owner !== candidateKey && !deferGroup) {
        blockers.push({
          kind: 'canonical-path-clash',
          basePath,
          buildingKeys: [owner, candidateKey].sort(),
        });
        continue;
      }
      const planned = plannedFromCandidate(
        candidate,
        canonicalPath,
        input,
        deferGroup
          ? { source: 'legacy-deferred', reasons }
          : evidenceForAssignment(canonicalPath, basePath, baselineByBase.get(baseKey) ?? [])
      );
      mappings.push(planned);
      toCreate.push(planned);
      if (!deferGroup) usedPaths.set(canonicalPath, candidateKey);
    }
  }

  for (const baseline of input.legacyBaseline) {
    const key = `${baseline.type}\x1f${normalizePath(baseline.basePath)}`;
    if (!knownBases.has(key)) {
      blockers.push({
        kind: 'unresolved-baseline-entry',
        basePath: normalizePath(baseline.basePath),
        buildingKeys: [],
        detail: baseline.provenance,
      });
    }
  }

  const blockedKeys = new Set(blockers.flatMap((blocker) => blocker.buildingKeys));
  return {
    mappings: mappings.filter(
      (mapping) => !blockedKeys.has(mappingKey(mapping.type, mapping.buildingKey))
    ),
    toCreate: toCreate.filter(
      (mapping) => !blockedKeys.has(mappingKey(mapping.type, mapping.buildingKey))
    ),
    blockers,
    deferred,
  };
}

export function isDeferredRealEstateUrlEvidence(evidence: unknown): boolean {
  if (typeof evidence === 'string') {
    try {
      return isDeferredRealEstateUrlEvidence(JSON.parse(evidence));
    } catch {
      return false;
    }
  }
  if (!evidence || typeof evidence !== 'object') return false;
  const value = evidence as Record<string, unknown>;
  return (
    value.source === 'legacy-deferred' ||
    (value.source === 'existing-registry' && isDeferredRealEstateUrlEvidence(value.previous))
  );
}

function assignGroup(
  basePath: string,
  candidates: RealEstateUrlCandidate[],
  baselines: LegacyRealEstateUrlBaselineEntry[],
  existing: ExistingRealEstateUrlMapping[]
): {
  paths: Array<[RealEstateUrlCandidate, string]>;
  blockers: RealEstateUrlPlanBlocker[];
} {
  const paths: Array<[RealEstateUrlCandidate, string]> = [];
  const existingBaseOwner = existing.find((row) => normalizePath(row.canonicalPath) === basePath);
  if (existingBaseOwner) {
    return assignSuffixes(basePath, candidates);
  }
  if (candidates.length === 1) {
    if (baselines.length === 0) return { paths: [[candidates[0], basePath]], blockers: [] };
    const baseOwner = findBaseOwner(candidates, baselines);
    if (baseOwner.kind === 'ok') return { paths: [[candidates[0], basePath]], blockers: [] };
    return {
      paths: [],
      blockers: [
        {
          kind: baseOwner.kind,
          basePath,
          buildingKeys: candidates.map((candidate) =>
            mappingKey(candidate.type, candidate.buildingKey)
          ),
        },
      ],
    };
  }

  const baseOwner = findBaseOwner(candidates, baselines);
  if (baseOwner.kind !== 'ok') {
    return {
      paths,
      blockers: [
        {
          kind: baseOwner.kind,
          basePath,
          buildingKeys: candidates
            .map((candidate) => mappingKey(candidate.type, candidate.buildingKey))
            .sort(),
        },
      ],
    };
  }

  paths.push([baseOwner.candidate, basePath]);
  const suffixAssignments = assignSuffixes(
    basePath,
    candidates.filter((candidate) => candidate.buildingKey !== baseOwner.candidate.buildingKey)
  );
  return { paths: [...paths, ...suffixAssignments.paths], blockers: suffixAssignments.blockers };
}

function assignSuffixes(
  basePath: string,
  candidates: RealEstateUrlCandidate[]
): {
  paths: Array<[RealEstateUrlCandidate, string]>;
  blockers: RealEstateUrlPlanBlocker[];
} {
  const blockers: RealEstateUrlPlanBlocker[] = [];
  const paths: Array<[RealEstateUrlCandidate, string]> = [];
  const suffixOwners = new Map<string, RealEstateUrlCandidate[]>();
  for (const candidate of candidates) {
    const suffix = readableAddressSuffix(candidate);
    if (!suffix) {
      blockers.push({
        kind: 'missing-readable-address',
        basePath,
        buildingKeys: [mappingKey(candidate.type, candidate.buildingKey)],
      });
      continue;
    }
    const path = `${basePath}/${suffix}`;
    suffixOwners.set(path, [...(suffixOwners.get(path) ?? []), candidate]);
  }

  for (const [path, owners] of suffixOwners) {
    if (owners.length > 1) {
      blockers.push({
        kind: 'readable-suffix-clash',
        basePath,
        buildingKeys: owners
          .map((candidate) => mappingKey(candidate.type, candidate.buildingKey))
          .sort(),
      });
      continue;
    }
    paths.push([owners[0], path]);
  }
  return { paths, blockers };
}

function findBaseOwner(
  candidates: RealEstateUrlCandidate[],
  baselines: LegacyRealEstateUrlBaselineEntry[]
):
  | { kind: 'ok'; candidate: RealEstateUrlCandidate }
  | { kind: 'missing-legacy-owner' | 'ambiguous-legacy-owner' } {
  const baselineAddress = singleBaselineAddress(baselines);
  if (baselineAddress.kind !== 'ok') return { kind: baselineAddress.kind };
  const matches = candidates.filter(
    (candidate) =>
      sameAddress(candidate.dongName, baselineAddress.dongName) &&
      sameAddress(candidate.jibun, baselineAddress.jibun)
  );
  if (matches.length === 1) return { kind: 'ok', candidate: matches[0] };
  return { kind: matches.length === 0 ? 'missing-legacy-owner' : 'ambiguous-legacy-owner' };
}

function singleBaselineAddress(
  baselines: LegacyRealEstateUrlBaselineEntry[]
):
  | { kind: 'ok'; dongName: string; jibun: string }
  | { kind: 'missing-legacy-owner' | 'ambiguous-legacy-owner' } {
  if (baselines.length === 0) return { kind: 'missing-legacy-owner' };
  const keys = new Set<string>();
  for (const baseline of baselines) {
    if (!hasCompleteAddress(baseline.dongName, baseline.jibun)) {
      return { kind: 'ambiguous-legacy-owner' };
    }
    keys.add(
      `${baseline.dongName?.trim().normalize('NFC')}\x1f${baseline.jibun?.trim().normalize('NFC')}`
    );
  }
  if (keys.size !== 1) return { kind: 'ambiguous-legacy-owner' };
  const [dongName, jibun] = [...keys][0].split('\x1f');
  return { kind: 'ok', dongName, jibun };
}

function evidenceForAssignment(
  canonicalPath: string,
  basePath: string,
  baselines: LegacyRealEstateUrlBaselineEntry[]
): Record<string, unknown> {
  if (canonicalPath !== basePath) return { source: 'readable-address-suffix' };
  if (baselines.length === 0) return { source: 'single-current-address' };
  return {
    source: 'legacy-exact-address',
    baselineProvenance: [...new Set(baselines.map((baseline) => baseline.provenance))],
  };
}

function plannedFromCandidate(
  candidate: RealEstateUrlCandidate,
  canonicalPath: string,
  input: RealEstateUrlPlanInput,
  evidence: Record<string, unknown> | null = null
): PlannedRealEstatePublicUrl {
  const basePath = realEstateBasePath(candidate);
  return {
    type: candidate.type,
    buildingKey: candidate.buildingKey,
    bjdCode: candidate.bjdCode,
    buildingName: candidate.buildingName.normalize('NFC'),
    basePath,
    basePathHash: hashRealEstatePublicPath(basePath),
    canonicalPath,
    pathHash: hashRealEstatePublicPath(canonicalPath),
    dongName: candidate.dongName?.trim().normalize('NFC') ?? null,
    jibun: candidate.jibun?.trim().normalize('NFC') ?? null,
    addressSnapshot: {
      city: candidate.city,
      district: candidate.district,
      bjdCode: candidate.bjdCode,
      buildingName: candidate.buildingName.normalize('NFC'),
      dongName: candidate.dongName?.trim().normalize('NFC') ?? null,
      jibun: candidate.jibun?.trim().normalize('NFC') ?? null,
    },
    evidence: evidence ?? evidenceForAssignment(canonicalPath, basePath, []),
    sourceFingerprint: input.sourceFingerprint,
    baselineProvenance: input.baselineProvenance,
    createdAt: input.generatedAt,
  };
}

function plannedFromExisting(
  candidate: RealEstateUrlCandidate,
  existing: ExistingRealEstateUrlMapping,
  input: RealEstateUrlPlanInput
): PlannedRealEstatePublicUrl {
  const basePath = existing.basePath ?? realEstateBasePath(candidate);
  return {
    ...plannedFromCandidate(candidate, existing.canonicalPath, input),
    basePath,
    basePathHash: hashRealEstatePublicPath(basePath),
    canonicalPath: existing.canonicalPath,
    pathHash: hashRealEstatePublicPath(existing.canonicalPath),
    evidence: { source: 'existing-registry', previous: existing.evidence ?? null },
  };
}

function mappingKey(type: string, buildingKey: string): string {
  return `${type}\x1f${buildingKey}`;
}

function normalizePath(path: string): string {
  return path.normalize('NFC');
}

function sameAddress(a: string | null | undefined, b: string | null | undefined): boolean {
  return (a?.trim().normalize('NFC') ?? '') === (b?.trim().normalize('NFC') ?? '');
}

function hasCompleteAddress(
  dongName: string | null | undefined,
  jibun: string | null | undefined
): boolean {
  return Boolean(dongName?.trim() && jibun?.trim());
}

function groupBy<T>(rows: T[], keyFn: (row: T) => string): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const row of rows) {
    const key = keyFn(row);
    grouped.set(key, [...(grouped.get(key) ?? []), row]);
  }
  return grouped;
}
