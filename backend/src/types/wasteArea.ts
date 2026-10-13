export type AreaKind = 'administrative' | 'legal';
export type AreaLevel = 'province' | 'district' | 'dong' | 'ri';
export type MatchState = 'verified' | 'unresolved' | 'conflict';
export type CoverageScope = 'whole' | 'partial' | 'conditional';
export type WasteDistrictMode = 'areas' | 'source' | 'empty';

export interface Evidence {
  url: string;
  version: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  note: string;
}

export interface AreaReference {
  key: string;
  kind: AreaKind;
  level: AreaLevel;
  code: string;
  city: string;
  district: string;
  districtCode: string;
  name: string;
  evidence: Evidence;
}

export interface SearchRelation {
  fromKey: string | null;
  alias: string | null;
  toKey: string;
  evidence: Evidence;
}

export interface ReferenceBundle {
  version: string;
  areas: AreaReference[];
  relations: SearchRelation[];
  sourceAreaKinds: Record<string, { kind: AreaKind; targetRegionHash?: string; evidence: Evidence }>;
}

export interface SourceRegionInput {
  scheduleId: number;
  sourceScope: string;
  city: string;
  district: string;
  targetRegion: string | null;
}

export interface CoverageCandidate {
  scheduleId: number;
  areaKey: string | null;
  districtCode: string | null;
  scope: CoverageScope;
  conditionText: string;
  state: MatchState;
  reason: string;
  evidence: Evidence[];
}

export interface AreaQuery {
  city?: string;
  district?: string;
  keyword?: string;
  page: number;
  limit: number;
}


export interface ApplicableWasteArea {
  areaId: number;
  name: string;
  href: string;
  scope: CoverageScope;
  conditionText: string;
}

export interface AreaSummary {
  areaId: number;
  name: string;
  city: string;
  district: string;
  href: string;
  matchReason: 'exact' | 'alias' | 'relation' | 'partial' | 'region';
  scheduleCount: number;
  conditionalCount: number;
  summary: string;
  dataDate: string | null;
}

export interface AreaList {
  generationId: string;
  items: AreaSummary[];
  total: number;
  page: number;
  totalPages: number;
  unresolved: { count: number; href: string | null };
  /** city+district 지정 조회에서만 존재. 키워드와 무관한 시·군·구 단위 표시 모드 */
  mode?: WasteDistrictMode;
}

export interface AuditCase {
  scheduleId: number;
  classification: string;
  reason: string;
}

export interface AuditReport {
  sourceCount: number;
  candidateCount: number;
  verifiedAreaCount: number;
  unresolvedCount: number;
  conflictCount: number;
  referenceVersion: string;
  asOf: string;
  cases: AuditCase[];
}
