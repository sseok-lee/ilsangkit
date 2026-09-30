import { createHash } from 'crypto';
import type {
  AreaKind,
  AreaQuery,
  AreaReference,
  AreaSummary,
  CoverageCandidate,
  CoverageScope,
  Evidence,
  MatchState,
  ReferenceBundle,
  SearchRelation,
  SourceRegionInput,
} from '../types/wasteArea.js';

interface SourceKindBinding {
  kind: AreaKind;
  targetRegionHash?: string;
  evidence: Evidence;
}

interface IndexedReferences {
  administrativeDong: AreaReference[];
  areaByKey: Map<string, AreaReference[]>;
  activeAreaByKey: Map<string, AreaReference>;
  districtByScope: Map<string, AreaReference>;
  exactByScopeKindName: Map<string, AreaReference[]>;
  relations: SearchRelation[];
}

interface RegionToken {
  raw: string;
  matchName: string;
  scope: CoverageScope;
}

type SearchReason = AreaSummary['matchReason'];

const indexCache = new WeakMap<ReferenceBundle, Map<string, IndexedReferences>>();

export function resolveCoverage(
  input: SourceRegionInput,
  refs: ReferenceBundle,
  at: string
): CoverageCandidate[] {
  const targetRegion = normalizeText(input.targetRegion);
  if (!targetRegion) {
    return [unresolved(input.scheduleId, '', 'blank targetRegion')];
  }

  const indexed = indexReferences(refs, at);
  const wholeDistrict = resolveWholeDistrict(input, targetRegion, indexed);
  if (wholeDistrict) return [wholeDistrict];

  const sourceBinding = resolveSourceKindBinding(input, refs, targetRegion, at);
  if (!sourceBinding) {
    return [unresolved(input.scheduleId, targetRegion, 'source area kind is not verified')];
  }
  if (sourceBinding === 'inactive') {
    return [unresolved(input.scheduleId, targetRegion, 'source area kind evidence is not active')];
  }
  if (sourceBinding === 'hash-mismatch') {
    return [unresolved(input.scheduleId, targetRegion, 'source kind evidence does not match targetRegion hash')];
  }

  return splitTopLevelRegions(targetRegion).map((token) => (
    resolveCoverageToken(input, token, sourceBinding, indexed)
  ));
}

export function resolveSearchCandidates(
  query: AreaQuery,
  refs: ReferenceBundle,
  at: string
): Array<{ key: string; reason: SearchReason; rank: number }> {
  const indexed = indexReferences(refs, at);
  const city = normalizeOptional(query.city);
  const district = normalizeOptional(query.district);
  const keyword = normalizeOptional(query.keyword);
  const candidates = new Map<string, { key: string; reason: SearchReason; rank: number; name: string }>();

  const add = (area: AreaReference, reason: SearchReason, rank: number): void => {
    if (!isAdministrativeDong(area) || !matchesQueryScope(area, city, district)) return;
    const current = candidates.get(area.key);
    if (!current || rank < current.rank || (rank === current.rank && reason < current.reason)) {
      candidates.set(area.key, { key: area.key, reason, rank, name: area.name });
    }
  };

  if (!keyword) {
    for (const area of indexed.administrativeDong) {
      add(area, 'region', 3);
    }
    return paginateSearch([...candidates.values()], query.page, query.limit);
  }

  for (const area of indexed.administrativeDong) {
    if (area.name === keyword) add(area, 'exact', 0);
  }

  for (const relation of indexed.relations) {
    const toArea = indexed.activeAreaByKey.get(relation.toKey);
    if (!toArea) continue;
    if (relation.alias && normalizeText(relation.alias) === keyword && isEvidenceActive(relation.evidence, at)) {
      add(toArea, 'alias', 1);
    }
    if (relation.fromKey && isEvidenceActive(relation.evidence, at)) {
      const fromAreas = indexed.areaByKey.get(relation.fromKey) ?? [];
      for (const fromArea of fromAreas) {
        if (isEvidenceActive(fromArea.evidence, at)
          && fromArea.name === keyword
          && matchesQueryScope(fromArea, city, district)) {
          add(toArea, 'relation', 1);
        }
      }
    }
  }

  if (candidates.size === 0) {
    for (const area of indexed.administrativeDong) {
      if (area.name.includes(keyword)) add(area, 'partial', 2);
    }
  }

  return paginateSearch([...candidates.values()], query.page, query.limit);
}

function resolveSourceKindBinding(
  input: SourceRegionInput,
  refs: ReferenceBundle,
  targetRegion: string,
  at: string
): SourceKindBinding | 'hash-mismatch' | 'inactive' | null {
  const sourceBinding = refs.sourceAreaKinds[input.sourceScope];
  if (!sourceBinding) return null;
  if (!isEvidenceActive(sourceBinding.evidence, at)) {
    return 'inactive';
  }
  if (sourceBinding.targetRegionHash && sourceBinding.targetRegionHash !== hashTargetRegion(targetRegion)) {
    return 'hash-mismatch';
  }
  return sourceBinding;
}

function resolveCoverageToken(
  input: SourceRegionInput,
  token: RegionToken,
  sourceBinding: SourceKindBinding,
  indexed: IndexedReferences
): CoverageCandidate {
  if (sourceBinding.kind !== 'administrative') {
    return unresolved(
      input.scheduleId,
      token.raw,
      'legal source area is search-related but not administrative coverage'
    );
  }

  const candidates = indexed.exactByScopeKindName.get(scopeKindNameKey(
    input.city,
    input.district,
    'administrative',
    token.matchName
  )) ?? [];

  if (candidates.length === 1) {
    const area = candidates[0];
    return {
      scheduleId: input.scheduleId,
      areaKey: area.key,
      districtCode: area.districtCode,
      scope: token.scope,
      conditionText: token.scope === 'whole' ? '' : token.raw,
      state: 'verified',
      reason: 'exact administrative dong match',
      evidence: [sourceBinding.evidence, area.evidence],
    };
  }
  if (candidates.length > 1) {
    return {
      scheduleId: input.scheduleId,
      areaKey: null,
      districtCode: null,
      scope: token.scope,
      conditionText: token.raw,
      state: 'conflict',
      reason: 'multiple current administrative dong matches',
      evidence: [sourceBinding.evidence, ...candidates.map((area) => area.evidence)],
    };
  }

  return unresolved(input.scheduleId, token.raw, 'no current exact administrative dong match', token.scope, [
    sourceBinding.evidence,
  ]);
}

function resolveWholeDistrict(
  input: SourceRegionInput,
  targetRegion: string,
  indexed: IndexedReferences
): CoverageCandidate | null {
  const token = parseRegionToken(targetRegion);
  if (!isWholeDistrictToken(token.matchName, input.district)) return null;

  const district = indexed.districtByScope.get(scopeKey(input.city, input.district));
  if (!district) {
    return unresolved(input.scheduleId, targetRegion, 'whole district scope has no verified district code', token.scope);
  }

  return {
    scheduleId: input.scheduleId,
    areaKey: null,
    districtCode: district.districtCode,
    scope: token.scope,
    conditionText: token.raw,
    state: 'verified',
    reason: 'whole district scope',
    evidence: [district.evidence],
  };
}

function indexReferences(refs: ReferenceBundle, at: string): IndexedReferences {
  const cachedByDate = indexCache.get(refs);
  const cached = cachedByDate?.get(at);
  if (cached) return cached;

  const administrativeDong: AreaReference[] = [];
  const areaByKey = new Map<string, AreaReference[]>();
  const activeAreaByKey = new Map<string, AreaReference>();
  const districtByScope = new Map<string, AreaReference>();
  const exactByScopeKindName = new Map<string, AreaReference[]>();

  for (const area of refs.areas) {
    const normalizedArea = normalizeArea(area);
    const byKey = areaByKey.get(normalizedArea.key) ?? [];
    byKey.push(normalizedArea);
    areaByKey.set(normalizedArea.key, byKey);

    if (!isEvidenceActive(normalizedArea.evidence, at)) continue;
    activeAreaByKey.set(normalizedArea.key, normalizedArea);

    if (normalizedArea.level === 'district') {
      districtByScope.set(scopeKey(normalizedArea.city, normalizedArea.district), normalizedArea);
    }
    if (isAdministrativeDong(normalizedArea)) {
      administrativeDong.push(normalizedArea);
      const exactKey = scopeKindNameKey(
        normalizedArea.city,
        normalizedArea.district,
        normalizedArea.kind,
        normalizedArea.name
      );
      const exact = exactByScopeKindName.get(exactKey) ?? [];
      exact.push(normalizedArea);
      exactByScopeKindName.set(exactKey, exact);
    }
  }

  for (const area of administrativeDong) {
    if (!districtByScope.has(scopeKey(area.city, area.district))) {
      districtByScope.set(scopeKey(area.city, area.district), area);
    }
  }

  administrativeDong.sort(compareArea);

  const indexed = {
    administrativeDong,
    areaByKey,
    activeAreaByKey,
    districtByScope,
    exactByScopeKindName,
    relations: refs.relations.map(normalizeRelation),
  };
  const nextCache = cachedByDate ?? new Map<string, IndexedReferences>();
  nextCache.set(at, indexed);
  indexCache.set(refs, nextCache);
  return indexed;
}

function splitTopLevelRegions(targetRegion: string): RegionToken[] {
  const parts: string[] = [];
  let current = '';
  let depth = 0;
  for (let i = 0; i < targetRegion.length; i += 1) {
    const char = targetRegion[i];
    if (char === '(' || char === '（') depth += 1;
    if (char === ')' || char === '）') depth = Math.max(0, depth - 1);

    if (depth === 0 && isSingleCharDelimiter(char)) {
      pushToken(parts, current);
      current = '';
      continue;
    }
    if (depth === 0 && isWordDelimiterAt(targetRegion, i)) {
      pushToken(parts, current);
      current = '';
      i += 1;
      continue;
    }
    current += char;
  }
  pushToken(parts, current);

  const tokens = parts.map(parseRegionToken).filter((token) => token.raw.length > 0);
  return tokens.length > 0 ? tokens : [parseRegionToken(targetRegion)];
}

function parseRegionToken(value: string): RegionToken {
  const raw = normalizeText(value);
  const withoutParenthetical = raw.replace(/\([^)]*\)|（[^）]*）/g, '').trim();
  const matchName = withoutParenthetical
    .replace(/\s+(일부|제외.*|공동주택.*|거점수거.*)$/u, '')
    .trim();
  return {
    raw,
    matchName,
    scope: hasConditionText(raw) ? 'conditional' : 'whole',
  };
}

function pushToken(parts: string[], value: string): void {
  const trimmed = normalizeText(value);
  if (trimmed) parts.push(trimmed);
}

function isSingleCharDelimiter(char: string): boolean {
  return char === '+' || char === ',' || char === '/' || char === '·' || char === 'ㆍ';
}

function isWordDelimiterAt(value: string, index: number): boolean {
  const slice = value.slice(index, index + 3);
  return slice === ' 및 ' || slice === ' 와 ' || slice === ' 과 ';
}

function isWholeDistrictToken(token: string, district: string): boolean {
  const normalizedDistrict = normalizeText(district);
  return token === `${normalizedDistrict} 전역`;
}

function hasConditionText(value: string): boolean {
  return /[()（）]|일부|제외|공동주택|아파트|단독|별도|해당|구간|구역|거점/u.test(value);
}

function unresolved(
  scheduleId: number,
  conditionText: string,
  reason: string,
  scope: CoverageScope = hasConditionText(conditionText) ? 'conditional' : 'whole',
  evidence: Evidence[] = []
): CoverageCandidate {
  return {
    scheduleId,
    areaKey: null,
    districtCode: null,
    scope,
    conditionText,
    state: 'unresolved' satisfies MatchState,
    reason,
    evidence,
  };
}

function paginateSearch(
  candidates: Array<{ key: string; reason: SearchReason; rank: number; name: string }>,
  page: number,
  limit: number
): Array<{ key: string; reason: SearchReason; rank: number }> {
  const safePage = Math.max(1, page);
  const safeLimit = Math.max(1, limit);
  return candidates
    .sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name, 'ko') || a.key.localeCompare(b.key))
    .slice((safePage - 1) * safeLimit, safePage * safeLimit)
    .map(({ key, reason, rank }) => ({ key, reason, rank }));
}

function normalizeArea(area: AreaReference): AreaReference {
  return {
    ...area,
    city: normalizeText(area.city),
    district: normalizeText(area.district),
    name: normalizeText(area.name),
  };
}

function normalizeRelation(relation: SearchRelation): SearchRelation {
  return {
    ...relation,
    alias: relation.alias === null ? null : normalizeText(relation.alias),
  };
}

function isAdministrativeDong(area: AreaReference): boolean {
  return area.kind === 'administrative' && area.level === 'dong';
}

function matchesQueryScope(area: AreaReference, city: string | null, district: string | null): boolean {
  return (!city || area.city === city) && (!district || area.district === district);
}

function isEvidenceActive(evidence: Evidence, at: string): boolean {
  const activeDate = evidenceDateKey(at);
  const effectiveFrom = evidenceDateKey(evidence.effectiveFrom);
  const effectiveTo = evidence.effectiveTo === null ? null : evidenceDateKey(evidence.effectiveTo);
  return effectiveFrom <= activeDate && (effectiveTo === null || effectiveTo >= activeDate);
}

function evidenceDateKey(value: string): string {
  return value.trim().slice(0, 10);
}

function compareArea(a: AreaReference, b: AreaReference): number {
  return a.name.localeCompare(b.name, 'ko') || a.key.localeCompare(b.key);
}

function scopeKindNameKey(city: string, district: string, kind: AreaKind, name: string): string {
  return `${scopeKey(city, district)}\u0000${kind}\u0000${normalizeText(name)}`;
}

function scopeKey(city: string, district: string): string {
  return `${normalizeText(city)}\u0000${normalizeText(district)}`;
}

function normalizeOptional(value: string | undefined): string | null {
  const normalized = normalizeText(value ?? null);
  return normalized.length > 0 ? normalized : null;
}

function normalizeText(value: string | null): string {
  return value?.trim().normalize('NFC') ?? '';
}

function hashTargetRegion(targetRegion: string): string {
  return createHash('sha256').update(normalizeText(targetRegion)).digest('hex');
}
