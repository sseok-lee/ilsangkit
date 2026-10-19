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
  /** newGroupOwnerPolicy 판정용(요약 V2 의 거래 수·최신 거래일 YYYYMMDD). */
  transactionCount?: number | null;
  latestDealKey?: number | null;
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
  | 'unresolved-baseline-entry'
  | 'incomplete-deferred-group'
  | 'ambiguous-new-owner';

export interface RealEstateUrlPlanBlocker {
  kind: RealEstateUrlPlanBlockerKind;
  basePath: string;
  buildingKeys: string[];
  detail?: string;
}

export interface RealEstateUrlPlanInput {
  resolveDeferred?: boolean;
  unresolvedPolicy?: 'block' | 'defer';
  /**
   * 요약 갱신의 자동 URL 추가 전용. 기존 URL·baseline 이 없는 같은 경로의 새 건물이 둘 이상일 때
   * 거래 수 최다(동률이면 최신 거래일) 건물에 기본 경로를 주고 나머지는 동·지번 접미사를 준다.
   * approved-fixed-owner-policy-v1 과 같은 기준이며, 이미 확정된 URL 은 재배정하지 않는다.
   * 과거 거래 백필(2021~2022)로 동명 신규 그룹 594개가 한꺼번에 생겨 도입했다(2026-10-19).
   */
  newGroupOwnerPolicy?: 'most-transactions';
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
  toUpdate: PlannedRealEstatePublicUrl[];
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
  const toUpdate: PlannedRealEstatePublicUrl[] = [];
  const blockers: RealEstateUrlPlanBlocker[] = [];
  const deferred: RealEstateUrlPlanBlocker[] = [];
  const usedPaths = new Map<string, string>();
  const existingPathOwners = groupBy(input.existing, (row) => row.canonicalPath);
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
    const existingGroup = existingByBase.get(baseKey) ?? [];
    const baselines = baselineByBase.get(baseKey) ?? [];
    const heldGroup = existingGroup.some((row) => isDeferredRealEstateUrlEvidence(row.evidence));
    if (input.resolveDeferred && heldGroup && baselines.length > 0) {
      const resolution = resolveDeferredGroup(
        basePath,
        group,
        existingGroup,
        baselines,
        input,
        existingPathOwners
      );
      blockers.push(...resolution.blockers);
      for (const planned of resolution.mappings) {
        mappings.push(planned);
        toUpdate.push(planned);
        usedPaths.set(planned.canonicalPath, mappingKey(planned.type, planned.buildingKey));
      }
      continue;
    }
    const pending = group.filter((candidate) => {
      const existing = existingByKey.get(mappingKey(candidate.type, candidate.buildingKey));
      if (!existing) return true;
      const planned = plannedFromExisting(candidate, existing, input);
      mappings.push(planned);
      usedPaths.set(planned.canonicalPath, mappingKey(candidate.type, candidate.buildingKey));
      return false;
    });
    if (pending.length === 0) continue;

    let assignments = assignGroup(
      basePath,
      pending,
      baselineByBase.get(baseKey) ?? [],
      existingGroup,
      input.newGroupOwnerPolicy
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
          : assignments.newGroupOwnerKey === candidateKey
            ? { source: 'new-group-most-transactions' }
            : evidenceForAssignment(canonicalPath, basePath, baselineByBase.get(baseKey) ?? [])
      );
      mappings.push(planned);
      toCreate.push(planned);
      if (!deferGroup) usedPaths.set(canonicalPath, candidateKey);
    }
  }

  for (const baseline of input.legacyBaseline) {
    const key = `${baseline.type}\x1f${normalizePath(baseline.basePath)}`;
    if (
      input.resolveDeferred &&
      !candidatesByBase.has(key) &&
      existingByBase.get(key)?.some((row) => isDeferredRealEstateUrlEvidence(row.evidence))
    ) {
      blockers.push({
        kind: 'incomplete-deferred-group',
        basePath: normalizePath(baseline.basePath),
        buildingKeys: (existingByBase.get(key) ?? []).map((row) =>
          mappingKey(row.type, row.buildingKey)
        ),
      });
    } else if (!knownBases.has(key)) {
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
    toUpdate: toUpdate.filter(
      (mapping) => !blockedKeys.has(mappingKey(mapping.type, mapping.buildingKey))
    ),
    blockers,
    deferred,
  };
}

// Only explicit, evidenced resolution may replace a grouped mapping.
// A group is all-or-nothing: never leave a base shared by an owner and deferred peers.
function resolveDeferredGroup(
  basePath: string,
  candidates: RealEstateUrlCandidate[],
  existing: ExistingRealEstateUrlMapping[],
  baselines: LegacyRealEstateUrlBaselineEntry[],
  input: RealEstateUrlPlanInput,
  existingPathOwners: Map<string, ExistingRealEstateUrlMapping[]>
): { mappings: PlannedRealEstatePublicUrl[]; blockers: RealEstateUrlPlanBlocker[] } {
  const keys = new Set(candidates.map((row) => mappingKey(row.type, row.buildingKey)));
  const fail = (kind: RealEstateUrlPlanBlockerKind): { mappings: PlannedRealEstatePublicUrl[]; blockers: RealEstateUrlPlanBlocker[] } => ({
    mappings: [],
    blockers: [{ kind, basePath, buildingKeys: [...keys].sort() }],
  });
  if (
    existing.length !== candidates.length ||
    !existing.every((row) => {
      const candidate = candidates.find(
        (item) => mappingKey(item.type, item.buildingKey) === mappingKey(row.type, row.buildingKey)
      );
      return (
        candidate &&
        isDeferredRealEstateUrlEvidence(row.evidence) &&
        normalizePath(row.canonicalPath) === basePath &&
        row.bjdCode === candidate.bjdCode &&
        sameAddress(row.dongName, candidate.dongName) &&
        sameAddress(row.jibun, candidate.jibun)
      );
    })
  )
    return fail('incomplete-deferred-group');

  const assignments = assignGroup(basePath, candidates, baselines, []);
  if (assignments.blockers.length > 0) return fail(assignments.blockers[0].kind);
  const paths = new Set(assignments.paths.map(([, path]) => path));
  if (
    [...paths].some((path) =>
      (existingPathOwners.get(path) ?? []).some(
        (row) => !keys.has(mappingKey(row.type, row.buildingKey))
      )
    )
  ) {
    return fail('canonical-path-clash');
  }
  return {
    mappings: assignments.paths.map(([candidate, canonicalPath]) =>
      plannedFromCandidate(
        candidate,
        canonicalPath,
        input,
        evidenceForAssignment(canonicalPath, basePath, baselines)
      )
    ),
    blockers: [],
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
  existing: ExistingRealEstateUrlMapping[],
  newGroupOwnerPolicy?: RealEstateUrlPlanInput['newGroupOwnerPolicy']
): {
  paths: Array<[RealEstateUrlCandidate, string]>;
  blockers: RealEstateUrlPlanBlocker[];
  newGroupOwnerKey?: string;
} {
  const paths: Array<[RealEstateUrlCandidate, string]> = [];
  const existingBaseOwner = existing.find((row) => normalizePath(row.canonicalPath) === basePath);
  if (existingBaseOwner) {
    return assignSuffixes(basePath, candidates);
  }
  if (newGroupOwnerPolicy && candidates.length > 1 && baselines.length === 0 && existing.length === 0) {
    return assignNewGroup(basePath, candidates);
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

// 새 동명 그룹은 전부 아니면 전무다: 대표를 못 정하거나 접미사 하나라도 못 만들면 그룹 전체를 보류한다.
function assignNewGroup(
  basePath: string,
  candidates: RealEstateUrlCandidate[]
): {
  paths: Array<[RealEstateUrlCandidate, string]>;
  blockers: RealEstateUrlPlanBlocker[];
  newGroupOwnerKey?: string;
} {
  const allKeys = candidates.map((candidate) => mappingKey(candidate.type, candidate.buildingKey)).sort();
  // 거래 수 최다 → 최신 거래일 → 지번(본번·부번 숫자) 작은 순 → 동 이름. 같은 시공사 신축이 같은 날
  // 같은 세대수로 팔린 그룹(2026-10-19 5그룹)은 앞의 둘이 구조적으로 같아 지번으로 정한다.
  const jibunNumbers = (candidate: RealEstateUrlCandidate): [number, number] | null => {
    const match = /^(\d+)(?:-(\d+))?$/.exec(candidate.jibun?.trim() ?? '');
    return match ? [Number(match[1]), Number(match[2] ?? 0)] : null;
  };
  const compare = (a: RealEstateUrlCandidate, b: RealEstateUrlCandidate): number => {
    const byCount = Number(b.transactionCount ?? 0) - Number(a.transactionCount ?? 0);
    if (byCount !== 0) return byCount;
    const byLatest = Number(b.latestDealKey ?? 0) - Number(a.latestDealKey ?? 0);
    if (byLatest !== 0) return byLatest;
    const ja = jibunNumbers(a);
    const jb = jibunNumbers(b);
    if (!ja || !jb) return 0;
    return ja[0] - jb[0] || ja[1] - jb[1] || (a.dongName ?? '').localeCompare(b.dongName ?? '', 'ko');
  };
  const sorted = [...candidates].sort(compare);
  const [first, second] = sorted;
  if (compare(first, second) === 0) {
    return { paths: [], blockers: [{ kind: 'ambiguous-new-owner', basePath, buildingKeys: allKeys }] };
  }
  const suffixes = assignSuffixes(basePath, sorted.slice(1));
  if (suffixes.blockers.length > 0) {
    return {
      paths: [],
      blockers: suffixes.blockers.map((blocker) => ({ ...blocker, buildingKeys: allKeys })),
    };
  }
  return {
    paths: [[first, basePath], ...suffixes.paths],
    blockers: [],
    newGroupOwnerKey: mappingKey(first.type, first.buildingKey),
  };
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
    source: baselines.some((baseline) =>
      baseline.provenance.startsWith('approved-fixed-owner-policy-v1 ')
    ) ? 'approved-fixed-owner-policy' : 'legacy-exact-address',
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
