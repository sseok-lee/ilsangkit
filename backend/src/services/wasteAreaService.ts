import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { AppError, ServiceUnavailableError } from '../lib/errors.js';
import { cityVariantList, districtVariantList } from './cityMapping.js';
import type {
  ApplicableWasteArea,
  AreaList,
  AreaQuery,
  AreaSummary,
  CoverageScope,
  Evidence,
} from '../types/wasteArea.js';
import type { WasteScheduleItem } from './wasteScheduleService.js';

export interface AreaDetail {
  generationId: string;
  area: AreaSummary;
  schedules: Array<{
    schedule: WasteScheduleItem;
    scope: CoverageScope;
    conditionText: string;
    evidence: Evidence[];
  }>;
  unresolved: AreaList['unresolved'];
  indexEligible: boolean;
  indexReason: string;
  contentUpdatedAt: string;
  predecessorOrSuccessorLinks: Array<{ name: string; href: string }>;
}

export interface IndexableWasteArea {
  areaId: number;
  contentUpdatedAt: string;
}

type AreaEntryRow = Awaited<ReturnType<typeof readDongEntries>>[number];
type CoverageRow = Awaited<ReturnType<typeof readVerifiedCoverages>>[number];

const EXCLUDE_SEED_SOURCE_ID: Prisma.StringFilter = { not: { startsWith: 'seed-' } };

const MATCH_RANK: Record<AreaSummary['matchReason'], number> = {
  exact: 0,
  alias: 1,
  relation: 2,
  partial: 3,
  region: 4,
};

export function isWasteAreaDiscoveryEnabled(): boolean {
  return process.env.WASTE_AREA_DISCOVERY_ENABLED === 'true';
}

export async function getActiveWasteGeneration(): Promise<string | null> {
  const publication = await prisma.wastePublication.findUnique({
    where: { id: 1 },
    select: { activeGenerationId: true },
  });
  return publication?.activeGenerationId ?? null;
}

export async function requireActiveWasteGeneration(): Promise<string> {
  if (!isWasteAreaDiscoveryEnabled()) {
    throw new ServiceUnavailableError('동별 쓰레기 배출 안내가 아직 활성화되지 않았습니다', 'WASTE_AREA_DISABLED');
  }

  try {
    const generationId = await getActiveWasteGeneration();
    if (!generationId) {
      throw new ServiceUnavailableError('동별 쓰레기 배출 안내가 준비되지 않았습니다', 'WASTE_AREA_UNAVAILABLE');
    }
    return generationId;
  } catch (error) {
    if (error instanceof ServiceUnavailableError) throw error;
    throw new ServiceUnavailableError('동별 쓰레기 배출 안내를 조회할 수 없습니다', 'WASTE_AREA_UNAVAILABLE');
  }
}

export async function listWasteAreas(query: AreaQuery): Promise<AreaList> {
  const generationId = await requireActiveWasteGeneration();
  const requestDate = new Date();
  return translateAreaRead(async () => {
    const entries = (await readDongEntries(generationId, query, requestDate))
      .filter((entry) => isEffectiveRow(entry, requestDate));
    const summaries = await buildSummaries(generationId, entries, requestDate, query.keyword);
    const total = summaries.length;
    const start = (query.page - 1) * query.limit;

    return {
      generationId,
      items: summaries.slice(start, start + query.limit),
      total,
      page: query.page,
      totalPages: Math.ceil(total / query.limit),
      unresolved: await readUnresolved(generationId, query),
    };
  });
}

export async function getWasteArea(id: number): Promise<AreaDetail | null> {
  const generationId = await requireActiveWasteGeneration();
  const requestDate = new Date();
  return translateAreaRead(async () => {
    const entry = await prisma.wasteAreaEntry.findFirst({
      where: {
        generationId,
        areaId: id,
        level: 'dong',
        ...effectiveWhere(requestDate),
        area: { kind: 'administrative' },
      },
      include: { area: true },
    });
    if (!entry) return null;

    const summary = (await buildSummaries(generationId, [entry], requestDate, undefined, true))[0] ?? {
      areaId: entry.areaId,
      name: entry.name,
      city: entry.city,
      district: entry.district,
      href: buildAreaHref(entry.areaId),
      matchReason: 'region' as const,
      scheduleCount: 0,
      conditionalCount: 0,
      summary: '확인된 배출 일정이 없습니다',
      dataDate: null,
    };
    const coverageRows = (await readVerifiedCoverages(generationId, [entry]))
      .filter((row) => !row.revision.sourceId.startsWith('seed-'));
    const schedules = dedupeCoverageRows(coverageRows)
      .filter((row) => row.areaId === entry.areaId || row.districtCode === entry.districtCode)
      .sort(compareCoverageRows)
      .map((row) => ({
        schedule: revisionToSchedule(row.revision),
        scope: row.scope as CoverageScope,
        conditionText: row.conditionText,
        evidence: parseEvidenceArray(row.evidence),
      }));

    return {
      generationId,
      area: summary,
      schedules,
      unresolved: await readUnresolved(generationId, {
        city: entry.city,
        district: entry.district,
        page: 1,
        limit: 1,
      }),
      indexEligible: schedules.length > 0 && entry.indexEligible,
      indexReason: schedules.length > 0 ? (entry.indexReason ?? 'index policy not specified') : 'no active schedules',
      contentUpdatedAt: entry.contentUpdatedAt.toISOString(),
      predecessorOrSuccessorLinks: await readRelatedAreaLinks(generationId, id, requestDate),
    };
  });
}


export async function getApplicableAreasForSchedules(
  generationId: string,
  scheduleIds: number[]
): Promise<Map<number, ApplicableWasteArea[]>> {
  const uniqueScheduleIds = [...new Set(scheduleIds.filter((id) => Number.isSafeInteger(id)))];
  const result = new Map<number, ApplicableWasteArea[]>();
  for (const scheduleId of uniqueScheduleIds) result.set(scheduleId, []);
  if (uniqueScheduleIds.length === 0) return result;

  const requestDate = new Date();
  return translateAreaRead(async () => {
    const entries = await readDongEntries(generationId, {}, requestDate);
    const entryByAreaId = new Map(entries.map((entry) => [entry.areaId, entry]));
    const rows = (await readVerifiedCoverages(generationId, entries))
      .filter((row) => uniqueScheduleIds.includes(row.scheduleId));
    const aggregateBySchedule = new Map<number, Map<number, ApplicableAreaAggregate>>();

    for (const row of rows) {
      if (row.areaId && entryByAreaId.has(row.areaId)) {
        addApplicableArea(aggregateBySchedule, row.scheduleId, entryByAreaId.get(row.areaId)!, row);
      }
      if (row.areaId === null && row.districtCode && row.scope === 'whole') {
        for (const entry of entries) {
          if (entry.districtCode === row.districtCode) {
            addApplicableArea(aggregateBySchedule, row.scheduleId, entry, row);
          }
        }
      }
    }

    for (const [scheduleId, areas] of aggregateBySchedule) {
      result.set(scheduleId, [...areas.values()]
        .map((area) => ({
          areaId: area.areaId,
          name: area.name,
          href: buildAreaHref(area.areaId),
          scope: area.scope,
          conditionText: [...area.conditionTexts].join('\n'),
        }))
        .sort((a, b) => a.name.localeCompare(b.name) || a.areaId - b.areaId));
    }

    return result;
  });
}

interface ApplicableAreaAggregate {
  areaId: number;
  name: string;
  scope: CoverageScope;
  conditionTexts: Set<string>;
}

const COVERAGE_SCOPE_RANK: Record<CoverageScope, number> = {
  whole: 0,
  partial: 1,
  conditional: 2,
};

function addApplicableArea(
  aggregateBySchedule: Map<number, Map<number, ApplicableAreaAggregate>>,
  scheduleId: number,
  entry: AreaEntryRow,
  row: Pick<CoverageRow, 'scope' | 'conditionText'>
): void {
  let areas = aggregateBySchedule.get(scheduleId);
  if (!areas) {
    areas = new Map();
    aggregateBySchedule.set(scheduleId, areas);
  }
  const scope = row.scope as CoverageScope;
  const current = areas.get(entry.areaId);
  if (!current) {
    areas.set(entry.areaId, {
      areaId: entry.areaId,
      name: entry.name,
      scope,
      conditionTexts: new Set(row.conditionText ? [row.conditionText] : []),
    });
    return;
  }
  if (COVERAGE_SCOPE_RANK[scope] > COVERAGE_SCOPE_RANK[current.scope]) {
    current.scope = scope;
  }
  if (row.conditionText) current.conditionTexts.add(row.conditionText);
}

export async function listIndexableWasteAreas(generationId: string): Promise<IndexableWasteArea[]> {
  const requestDate = new Date();
  return translateAreaRead(async () => {
    const rows = await prisma.wasteAreaEntry.findMany({
      where: {
        generationId,
        level: 'dong',
        indexEligible: true,
        ...effectiveWhere(requestDate),
        area: { kind: 'administrative' },
        coverages: {
          some: {
            state: 'verified',
            revision: {
              state: 'active',
              sourceId: EXCLUDE_SEED_SOURCE_ID,
            },
          },
        },
      },
      select: {
        areaId: true,
        contentUpdatedAt: true,
      },
      orderBy: [{ areaId: 'asc' }],
    });
    return rows.map((row) => ({
      areaId: row.areaId,
      contentUpdatedAt: row.contentUpdatedAt.toISOString(),
    }));
  });
}

export async function hasPublishedWasteAreaDetailHistory(id: number): Promise<boolean> {
  const requestDate = new Date();
  return translateAreaRead(async () => {
    const count = await prisma.wasteAreaEntry.count({
      where: {
        areaId: id,
        level: 'dong',
        validFrom: { lte: effectiveDateKey(requestDate) },
        area: { kind: 'administrative' },
        generation: {
          status: 'published',
          publishedAt: { not: null },
        },
      },
    });
    return count > 0;
  });
}

async function readDongEntries(
  generationId: string,
  query: Partial<AreaQuery>,
  requestDate: Date
): Promise<Array<Prisma.WasteAreaEntryGetPayload<{ include: { area: true } }>>> {
  return prisma.wasteAreaEntry.findMany({
    where: {
      generationId,
      level: 'dong',
      ...effectiveWhere(requestDate),
      ...(query.city ? { city: { in: cityVariantList(query.city) } } : {}),
      ...(query.district ? { district: { in: districtVariantList(query.district) } } : {}),
      area: { kind: 'administrative' },
    },
    include: { area: true },
    orderBy: [{ city: 'asc' }, { district: 'asc' }, { name: 'asc' }, { areaId: 'asc' }],
  });
}

async function buildSummaries(
  generationId: string,
  entries: AreaEntryRow[],
  requestDate: Date,
  keyword?: string,
  includeEmpty = false
): Promise<AreaSummary[]> {
  if (entries.length === 0) return [];
  const coverageRows = (await readVerifiedCoverages(generationId, entries))
    .filter((row) => !row.revision.sourceId.startsWith('seed-'));
  const coverageByArea = new Map<number, CoverageRow[]>();
  for (const entry of entries) coverageByArea.set(entry.areaId, []);
  for (const row of coverageRows) {
    if (row.areaId && coverageByArea.has(row.areaId)) {
      coverageByArea.get(row.areaId)!.push(row);
    }
    if (row.districtCode) {
      for (const entry of entries) {
        if (entry.districtCode === row.districtCode) coverageByArea.get(entry.areaId)!.push(row);
      }
    }
  }

  const relationMatches = await readRelationMatches(generationId, entries, requestDate, keyword);
  const normalizedKeyword = normalizeSearchText(keyword);
  return entries
    .map((entry) => {
      const rows = dedupeCoverageRows(coverageByArea.get(entry.areaId) ?? []);
      if (!includeEmpty && rows.length === 0) return null;
      const matchReason = resolveMatchReason(entry, relationMatches.get(entry.areaId), normalizedKeyword);
      if (normalizedKeyword && matchReason === null) return null;
      const scheduleIds = new Set(rows.map((row) => row.scheduleId));
      const latest = rows.reduce<Date | null>((max, row) => {
        const sourceDate = sourceDataDate(row.revision);
        if (!sourceDate) return max;
        return !max || sourceDate > max ? sourceDate : max;
      }, null);
      return {
        areaId: entry.areaId,
        name: entry.name,
        city: entry.city,
        district: entry.district,
        href: buildAreaHref(entry.areaId),
        matchReason: matchReason ?? 'region',
        scheduleCount: scheduleIds.size,
        conditionalCount: rows.length,
        summary: rows.length > 0 ? summarizeConditions(rows) : '확인된 배출 일정이 없습니다',
        dataDate: latest?.toISOString() ?? null,
      };
    })
    .filter((item): item is AreaSummary => item !== null)
    .sort(compareSummaries);
}

async function readVerifiedCoverages(
  generationId: string,
  entries: AreaEntryRow[]
): Promise<Array<Prisma.WasteScheduleCoverageGetPayload<{ include: { revision: true } }>>> {
  const areaIds = entries.map((entry) => entry.areaId);
  const districtCodes = [...new Set(entries.map((entry) => entry.districtCode))];
  return prisma.wasteScheduleCoverage.findMany({
    where: {
      generationId,
      state: 'verified',
      OR: [
        { areaId: { in: areaIds } },
        { areaId: null, districtCode: { in: districtCodes } },
      ],
      revision: { state: 'active', sourceId: EXCLUDE_SEED_SOURCE_ID },
    },
    include: { revision: true },
  });
}

async function readRelationMatches(
  generationId: string,
  entries: AreaEntryRow[],
  requestDate: Date,
  keyword?: string
): Promise<Map<number, AreaSummary['matchReason']>> {
  const normalizedKeyword = normalizeSearchText(keyword);
  if (!normalizedKeyword) return new Map();
  const relations = await prisma.wasteAreaRelation.findMany({
    where: {
      generationId,
      toAreaId: { in: entries.map((entry) => entry.areaId) },
      ...effectiveWhere(requestDate),
    },
    include: { fromEntry: true },
  });
  const matches = new Map<number, AreaSummary['matchReason']>();
  for (const relation of relations) {
    if (!isEffectiveRow(relation, requestDate)) continue;
    const alias = normalizeSearchText(relation.alias ?? undefined);
    const fromName = relation.fromEntry && isEffectiveRow(relation.fromEntry, requestDate)
      ? normalizeSearchText(relation.fromEntry.name)
      : '';
    if (alias && alias.includes(normalizedKeyword)) {
      matches.set(relation.toAreaId, 'alias');
    } else if (fromName && fromName.includes(normalizedKeyword) && !matches.has(relation.toAreaId)) {
      matches.set(relation.toAreaId, 'relation');
    }
  }
  return matches;
}

async function readUnresolved(generationId: string, query: Partial<AreaQuery>): Promise<AreaList['unresolved']> {
  const revisions = await prisma.wasteScheduleRevision.findMany({
    where: {
      generationId,
      state: 'active',
      sourceId: EXCLUDE_SEED_SOURCE_ID,
      ...(query.city ? { city: { in: cityVariantList(query.city) } } : {}),
      ...(query.district ? { district: { in: districtVariantList(query.district) } } : {}),
      coverages: { some: { state: 'unresolved' } },
    },
    select: { scheduleId: true },
  });
  const count = new Set(revisions.map((revision) => revision.scheduleId)).size;
  return {
    count,
    href: count > 0 ? buildUnresolvedHref(query) : null,
  };
}

async function readRelatedAreaLinks(
  generationId: string,
  areaId: number,
  requestDate: Date
): Promise<Array<{ name: string; href: string }>> {
  const relations = await prisma.wasteAreaRelation.findMany({
    where: {
      generationId,
      AND: [
        effectiveWhere(requestDate),
        { OR: [{ fromAreaId: areaId }, { toAreaId: areaId }] },
      ],
    },
    include: { fromEntry: true, toEntry: true },
    orderBy: [{ validFrom: 'asc' }, { relationKey: 'asc' }],
  });
  const links = new Map<number, { name: string; href: string }>();
  for (const relation of relations) {
    const other = relation.fromAreaId === areaId ? relation.toEntry : relation.fromEntry;
    if (other && isEffectiveRow(other, requestDate)) {
      links.set(other.areaId, { name: other.name, href: buildAreaHref(other.areaId) });
    }
  }
  return [...links.values()];
}

function resolveMatchReason(
  entry: AreaEntryRow,
  relationMatch: AreaSummary['matchReason'] | undefined,
  normalizedKeyword: string
): AreaSummary['matchReason'] | null {
  if (!normalizedKeyword) return 'region';
  const name = normalizeSearchText(entry.name);
  if (name === normalizedKeyword) return 'exact';
  if (relationMatch) return relationMatch;
  if (name.includes(normalizedKeyword)) return 'partial';
  return null;
}

function dedupeCoverageRows<T extends Pick<CoverageRow, 'scheduleId' | 'scope' | 'conditionText'>>(rows: T[]): T[] {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const key = `${row.scheduleId}\u0000${row.scope}\u0000${row.conditionText}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function compareSummaries(a: AreaSummary, b: AreaSummary): number {
  return MATCH_RANK[a.matchReason] - MATCH_RANK[b.matchReason]
    || a.city.localeCompare(b.city)
    || a.district.localeCompare(b.district)
    || a.name.localeCompare(b.name)
    || a.areaId - b.areaId;
}

function compareCoverageRows(a: CoverageRow, b: CoverageRow): number {
  return a.scheduleId - b.scheduleId
    || String(a.scope).localeCompare(String(b.scope))
    || a.conditionText.localeCompare(b.conditionText);
}

function summarizeConditions(rows: CoverageRow[]): string {
  const conditions = [...new Set(rows.map((row) => row.conditionText).filter(Boolean))];
  return conditions.slice(0, 3).join(', ') || `${rows.length}개 배출 일정`;
}

function sourceDataDate(revision: Pick<CoverageRow['revision'], 'sourceModifiedAt' | 'details'>): Date | null {
  if (revision.sourceModifiedAt) return revision.sourceModifiedAt;
  if (!revision.details || typeof revision.details !== 'object') return null;
  const details = revision.details as { dataCreatedDate?: unknown; lastModified?: unknown };
  return parseSourceDate(details.dataCreatedDate) ?? parseSourceDate(details.lastModified);
}

function parseSourceDate(value: unknown): Date | null {
  if (typeof value !== 'string' || value.trim() === '') return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function revisionToSchedule(revision: CoverageRow['revision']): WasteScheduleItem {
  return {
    id: revision.scheduleId,
    city: revision.city,
    district: revision.district,
    targetRegion: revision.targetRegion,
    emissionPlace: revision.emissionPlace,
    sourceUrl: revision.sourceUrl,
    govCode: revision.govCode,
    sourceStatus: revision.state,
    applicableAreas: [],
    appliesTo: [],
    details: revision.details as WasteScheduleItem['details'],
  };
}

function parseEvidenceArray(value: Prisma.JsonValue): Evidence[] {
  if (Array.isArray(value)) return value as unknown as Evidence[];
  if (value && typeof value === 'object') return [value as unknown as Evidence];
  return [];
}

function normalizeSearchText(value?: string | null): string {
  return (value ?? '').trim().normalize('NFC').toLocaleLowerCase('ko-KR');
}

function buildUnresolvedHref(query: Partial<AreaQuery>): string {
  const params = new URLSearchParams({ coverage: 'unresolved' });
  if (query.city) params.set('city', query.city);
  if (query.district) params.set('district', query.district);
  if (query.keyword) params.set('keyword', query.keyword);
  return `/trash?${params.toString()}`;
}

function buildAreaHref(areaId: number): string {
  return `/trash/areas/${areaId}`;
}

function effectiveWhere(requestDate: Date): {
  validFrom: { lte: Date };
  OR: Array<{ validTo: null } | { validTo: { gte: Date } }>;
} {
  const activeDate = effectiveDateKey(requestDate);
  return {
    validFrom: { lte: activeDate },
    OR: [{ validTo: null }, { validTo: { gte: activeDate } }],
  };
}

function isEffectiveRow(row: Pick<AreaEntryRow, 'validFrom' | 'validTo'>, requestDate: Date): boolean {
  const activeDate = effectiveDateKey(requestDate);
  return row.validFrom <= activeDate && (!row.validTo || row.validTo >= activeDate);
}

function effectiveDateKey(value: Date): Date {
  const [date] = value.toISOString().split('T');
  return new Date(`${date}T00:00:00.000Z`);
}

async function translateAreaRead<T>(read: () => Promise<T>): Promise<T> {
  try {
    return await read();
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new ServiceUnavailableError('동별 쓰레기 배출 안내를 조회할 수 없습니다', 'WASTE_AREA_UNAVAILABLE');
  }
}
