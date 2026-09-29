import { kstCalendarToday } from '../lib/kstDate.js';

const MYHOME_LIST_URL = 'https://apis.data.go.kr/1613000/HWSPR02/rsdtRcritNtcList';
const LH_LIST_URL = 'https://apis.data.go.kr/B552555/lhLeaseNoticeInfo1/lhLeaseNoticeInfo1';
const DEFAULT_TIMEOUT_MS = 30_000;
const PAGE_SIZE = 1_000;
const LH_UPP_AIS_TYPE_CODES = ['06', '13'] as const;

export type PublicRentalNoticeStatus = 'ongoing' | 'upcoming' | 'closed' | 'unknown';

export interface PublicRentalMetadata {
  provider: string;
  sources: ('MYHOME' | 'LH')[];
  sourceIds: { myhome: string[]; lh: string[] };
  sourceStatus: string | null;
  lastSyncedAt: string;
  supplies: Array<{
    key: string;
    name: string | null;
    region: string;
    address: string | null;
    supplyCount: number | null;
    deposit: number | null;
    monthlyRent: number | null;
    receptionStartDate: string | null;
    receptionEndDate: string | null;
  }>;
  isCorrection: boolean;
}

export interface PublicRentalNotice {
  canonicalId: string;
  houseName: string;
  houseType: string;
  publicRentType: string;
  regionName: string;
  supplyLocation: string | null;
  totalSupplyCount: number | null;
  announcementDate: Date | null;
  receptionStartDate: Date | null;
  receptionEndDate: Date | null;
  winnerDate: Date | null;
  pblancUrl: string;
  inquiryTel: string | null;
  status: PublicRentalNoticeStatus;
  publicRental: PublicRentalMetadata;
}

export interface NormalizePublicRentalNoticesInput {
  myhomeRows: Array<Record<string, unknown>>;
  lhRows: Array<Record<string, unknown>>;
  now?: Date;
}

interface NoticeGroup {
  canonicalId: string;
  myhomeRows: Array<Record<string, unknown>>;
  lhRows: Array<Record<string, unknown>>;
  myhomeSourceIds: string[];
  lhSourceIds: string[];
}

interface NormalizedSupply {
  key: string;
  name: string | null;
  region: string;
  address: string | null;
  supplyCount: number | null;
  deposit: number | null;
  monthlyRent: number | null;
  receptionStartDate: string | null;
  receptionEndDate: string | null;
}

export async function fetchPublicRentalNotices(
  serviceKey: string,
  now: Date = new Date()
): Promise<PublicRentalNotice[]> {
  const decodedServiceKey = decodeServiceKeyOnce(serviceKey);
  const redactionValues = serviceKeyRedactionValues(serviceKey, decodedServiceKey);
  const [myhomeRows, lhRowsByType] = await Promise.all([
    fetchMyhomeRows(decodedServiceKey, redactionValues),
    Promise.all(
      LH_UPP_AIS_TYPE_CODES.map((typeCode) => fetchLhRows(decodedServiceKey, typeCode, redactionValues))
    ),
  ]);

  return normalizePublicRentalNotices({
    myhomeRows,
    lhRows: lhRowsByType.flat(),
    now,
  });
}

export function normalizePublicRentalNotices({
  myhomeRows,
  lhRows,
  now = new Date(),
}: NormalizePublicRentalNoticesInput): PublicRentalNotice[] {
  const myhomeAliases = buildMyhomeAliasIndex(myhomeRows);
  const filteredMyhomeRows = removeSupersededMyhomeRows(myhomeRows);
  const groups = buildNoticeGroups(filteredMyhomeRows, lhRows, myhomeAliases);
  mergeCorrectionConnectedLhGroups(groups);
  const syncedAt = now.toISOString();

  return Array.from(groups.values())
    .map((group) => normalizeNoticeGroup(group, now, syncedAt))
    .sort((a, b) => a.canonicalId.localeCompare(b.canonicalId));
}

async function fetchMyhomeRows(
  serviceKey: string,
  redactionValues: string[] = serviceKeyRedactionValues(serviceKey)
): Promise<Array<Record<string, unknown>>> {
  const rows: Array<Record<string, unknown>> = [];
  let pageNo = 1;
  let totalCount: number | null = null;

  do {
    const payload = await fetchJson(
      MYHOME_LIST_URL,
      {
        serviceKey,
        type: 'json',
        pageNo,
        numOfRows: PAGE_SIZE,
      },
      redactionValues
    );
    const { body } = normalizeStandardRoot(payload, redactionValues);
    const pageRows = normalizeItems(body.item ?? body.items);
    totalCount = toNonNegativeInteger(body.totalCount) ?? pageRows.length;
    rows.push(...pageRows);

    if (rows.length >= totalCount) {
      break;
    }
    if (pageRows.length === 0) {
      throw new Error(`MyHome API pagination ended before totalCount (${rows.length}/${totalCount})`);
    }
    pageNo += 1;
  } while (totalCount === null || rows.length < totalCount);

  return rows;
}

async function fetchLhRows(
  serviceKey: string,
  uppAisTypeCode: (typeof LH_UPP_AIS_TYPE_CODES)[number],
  redactionValues: string[] = serviceKeyRedactionValues(serviceKey)
): Promise<Array<Record<string, unknown>>> {
  const rows: Array<Record<string, unknown>> = [];
  let pageNo = 1;
  let totalCount: number | null = null;

  do {
    const payload = await fetchJson(
      LH_LIST_URL,
      {
        serviceKey,
        PG_SZ: PAGE_SIZE,
        PAGE: pageNo,
        UPP_AIS_TP_CD: uppAisTypeCode,
      },
      redactionValues
    );
    const pageRows = extractLhListRows(payload, redactionValues);
    const pageTotal = pageRows
      .map((row) => toNonNegativeInteger(row.ALL_CNT))
      .find((count): count is number => count !== null);
    totalCount = pageTotal ?? totalCount ?? pageRows.length;
    rows.push(...pageRows);

    if (rows.length >= totalCount) {
      break;
    }
    if (pageRows.length === 0) {
      throw new Error(`LH API pagination ended before ALL_CNT (${rows.length}/${totalCount})`);
    }
    pageNo += 1;
  } while (totalCount === null || rows.length < totalCount);

  return rows;
}

async function fetchJson(
  endpoint: string,
  params: Record<string, string | number>,
  redactionValues: string[]
): Promise<unknown> {
  const url = new URL(endpoint);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Public rental API request failed: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    throw sanitizeApiError(error, redactionValues);
  } finally {
    clearTimeout(timeoutId);
  }
}

function normalizeStandardRoot(
  payload: unknown,
  redactionValues: string[]
): { header: Record<string, unknown>; body: Record<string, unknown> } {
  throwIfPublicDataError(payload, redactionValues);
  const root = asRecord(payload);
  if (!root) {
    throw new Error('MyHome API returned an unexpected JSON structure');
  }

  const response = asRecord(root.response);
  const standardRoot = response?.header ? response : root;
  const header = asRecord(standardRoot.header);
  const body = asRecord(standardRoot.body);

  if (!header || !body) {
    throw new Error('MyHome API returned an unexpected JSON structure');
  }

  const resultCode = asString(header.resultCode);
  if (resultCode && resultCode !== '00' && resultCode !== '0') {
    const resultMsg = asString(header.resultMsg) ?? 'unknown error';
    throw sanitizeApiError(new Error(`MyHome API error ${resultCode}: ${resultMsg}`), redactionValues);
  }

  return { header, body };
}

function extractLhListRows(payload: unknown, redactionValues: string[]): Array<Record<string, unknown>> {
  throwIfPublicDataError(payload, redactionValues);
  if (!Array.isArray(payload)) {
    throw new Error('LH API returned an unexpected JSON structure');
  }

  const listWrapper = payload.find((entry) => Array.isArray(asRecord(entry)?.dsList));
  if (!listWrapper) {
    throw new Error('LH API returned an unexpected JSON structure');
  }

  const wrapper = asRecord(listWrapper);
  const resHeader = normalizeItems(wrapper?.resHeader);
  const successCode = asString(resHeader[0]?.SS_CODE);
  if (successCode !== 'Y') {
    throw new Error('LH API returned an unsuccessful response header');
  }

  return (wrapper?.dsList as unknown[])
    .map((row) => asRecord(row))
    .filter((row): row is Record<string, unknown> => row !== null);
}

function throwIfPublicDataError(payload: unknown, redactionValues: string[]): void {
  const root = asRecord(payload);
  const commonHeader = asRecord(asRecord(root?.OpenAPI_ServiceResponse)?.cmmMsgHeader);
  if (!commonHeader) return;

  const reasonCode = asString(commonHeader.returnReasonCode) ?? 'UNKNOWN';
  const authMsg = asString(commonHeader.returnAuthMsg) ?? 'PUBLIC_DATA_AUTH_ERROR';
  throw sanitizeApiError(new Error(`Public data API error ${reasonCode}: ${authMsg}`), redactionValues);
}

function sanitizeApiError(error: unknown, redactionValues: string[]): Error {
  const message = error instanceof Error ? error.message : String(error);
  const safeMessage = redactionValues.reduce(
    (current, value) => (value ? current.split(value).join('[REDACTED_SERVICE_KEY]') : current),
    message
  );
  return new Error(safeMessage);
}

function decodeServiceKeyOnce(serviceKey: string): string {
  try {
    return decodeURIComponent(serviceKey);
  } catch {
    return serviceKey;
  }
}

function serviceKeyRedactionValues(
  rawKey: string,
  decodedKey: string = decodeServiceKeyOnce(rawKey)
): string[] {
  return uniqueStrings([rawKey, decodedKey, encodeURIComponent(decodedKey)]);
}

function removeSupersededMyhomeRows(rows: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  const supersededIds = new Set(
    rows
      .map((row) => asString(row.beforePblancId))
      .filter((id): id is string => Boolean(id))
  );

  return rows.filter((row) => {
    const pblancId = asString(row.pblancId);
    return !pblancId || !supersededIds.has(pblancId);
  });
}

function buildNoticeGroups(
  myhomeRows: Array<Record<string, unknown>>,
  lhRows: Array<Record<string, unknown>>,
  myhomeAliases: Map<Record<string, unknown>, { myhome: string[]; lh: string[] }>
): Map<string, NoticeGroup> {
  const groups = new Map<string, NoticeGroup>();

  for (const row of myhomeRows) {
    const canonicalId = myhomeCanonicalId(row);
    if (!canonicalId) continue;
    const group = getOrCreateGroup(groups, canonicalId);
    group.myhomeRows.push(row);
    const aliases = myhomeAliases.get(row);
    group.myhomeSourceIds.push(...(aliases?.myhome ?? []));
    group.lhSourceIds.push(...(aliases?.lh ?? []));
  }

  for (const row of lhRows) {
    const panId = asString(row.PAN_ID);
    if (!panId) continue;
    const group = getOrCreateGroup(groups, panId);
    group.lhRows.push(row);
    group.lhSourceIds.push(panId);
  }

  return groups;
}

function getOrCreateGroup(groups: Map<string, NoticeGroup>, canonicalId: string): NoticeGroup {
  const existing = groups.get(canonicalId);
  if (existing) return existing;

  const group: NoticeGroup = {
    canonicalId,
    myhomeRows: [],
    lhRows: [],
    myhomeSourceIds: [],
    lhSourceIds: [],
  };
  groups.set(canonicalId, group);
  return group;
}

function mergeCorrectionConnectedLhGroups(groups: Map<string, NoticeGroup>): void {
  for (const group of Array.from(groups.values())) {
    if (group.myhomeRows.length === 0) continue;

    for (const lhSourceId of uniqueStrings(group.lhSourceIds)) {
      if (lhSourceId === group.canonicalId) continue;
      const connectedGroup = groups.get(lhSourceId);
      if (!connectedGroup || connectedGroup === group || connectedGroup.myhomeRows.length > 0) continue;

      group.lhRows.push(...connectedGroup.lhRows);
      group.lhSourceIds.push(...connectedGroup.lhSourceIds);
      groups.delete(lhSourceId);
    }
  }
}

function normalizeNoticeGroup(group: NoticeGroup, now: Date, syncedAt: string): PublicRentalNotice {
  const firstMyhome = group.myhomeRows[0];
  const firstLh = group.lhRows[0];
  const supplies = uniqueSupplies(group.myhomeRows.map(normalizeMyhomeSupply));
  const statusLh = latestLhRow(group.lhRows);
  const sourceStatus = firstString([
    asString(statusLh?.PAN_SS),
    ...group.myhomeRows.map((row) => asString(row.sttusNm)),
  ]);
  const receptionRange = noticeReceptionRange(supplies);
  const status = noticeStatus(receptionRange, sourceStatus, now);
  const sourceIds = {
    myhome: uniqueStrings(group.myhomeSourceIds),
    lh: uniqueStrings(group.lhSourceIds),
  };

  return {
    canonicalId: group.canonicalId,
    houseName:
      asString(firstMyhome?.pblancNm) ??
      stripCorrectionPrefix(asString(firstLh?.PAN_NM)) ??
      group.canonicalId,
    houseType: asString(firstMyhome?.houseTyNm) ?? asString(firstLh?.UPP_AIS_TP_NM) ?? '임대주택',
    publicRentType: asString(firstMyhome?.suplyTyNm) ?? asString(firstLh?.AIS_TP_CD_NM) ?? '공공임대',
    regionName: noticeRegionName(group.myhomeRows, firstLh),
    supplyLocation: uniqueNullableString(supplies.map((supply) => supply.address)),
    totalSupplyCount: totalSupplyCount(supplies, firstLh),
    announcementDate: parseDate(asString(firstMyhome?.rcritPblancDe) ?? asString(firstLh?.PAN_DT)),
    receptionStartDate: receptionRange?.start ? parseDate(receptionRange.start) : null,
    receptionEndDate: receptionRange?.end ? parseDate(receptionRange.end) : null,
    winnerDate: parseDate(asString(firstMyhome?.przwnerPresnatnDe)),
    pblancUrl:
      asString(firstMyhome?.url) ??
      asString(firstMyhome?.pcUrl) ??
      asString(firstLh?.DTL_URL) ??
      asString(firstLh?.DTL_URL_MOB) ??
      '',
    inquiryTel: firstString(group.myhomeRows.map((row) => asString(row.refrnc))),
    status,
    publicRental: {
      provider: asString(firstMyhome?.suplyInsttNm) ?? (firstLh ? 'LH' : 'MYHOME'),
      sources: [
        ...(group.myhomeRows.length > 0 ? (['MYHOME'] as const) : []),
        ...(group.lhRows.length > 0 ? (['LH'] as const) : []),
      ],
      sourceIds,
      sourceStatus,
      lastSyncedAt: syncedAt,
      supplies,
      isCorrection: isCorrection(group.myhomeRows, group.lhRows),
    },
  };
}

function normalizeMyhomeSupply(row: Record<string, unknown>): NormalizedSupply {
  const pblancId = asString(row.pblancId) ?? '';
  const houseSn = asString(row.houseSn) ?? '';
  const region = regionName(asString(row.brtcNm), asString(row.signguNm));
  const address = emptyToNull(asString(row.fullAdres));
  const name = emptyToNull(asString(row.hsmpNm));
  const startDate = formatDateString(asString(row.beginDe));
  const endDate = formatDateString(asString(row.endDe));
  const supplyCount = positiveNumberOrNull(row.sumSuplyCo ?? row.suplyHoCo);
  const deposit = positiveNumberOrNull(row.rentGtn);
  const monthlyRent = positiveNumberOrNull(row.mtRntchrg);

  return {
    key: [
      pblancId,
      houseSn,
      region,
      address ?? '',
      name ?? '',
      supplyCount ?? '',
      deposit ?? '',
      monthlyRent ?? '',
      startDate ?? '',
      endDate ?? '',
    ].join('|'),
    name,
    region,
    address,
    supplyCount,
    deposit,
    monthlyRent,
    receptionStartDate: startDate,
    receptionEndDate: endDate,
  };
}

function uniqueSupplies(supplies: NormalizedSupply[]): NormalizedSupply[] {
  const seen = new Set<string>();
  const unique: NormalizedSupply[] = [];
  for (const supply of supplies) {
    if (seen.has(supply.key)) continue;
    seen.add(supply.key);
    unique.push(supply);
  }
  return unique;
}

function noticeReceptionRange(
  supplies: NormalizedSupply[]
): { start: string; end: string } | null {
  if (supplies.length === 0) return null;
  if (supplies.some((supply) => !supply.receptionStartDate || !supply.receptionEndDate)) {
    return null;
  }

  const ranges = uniqueStrings(
    supplies
      .map((supply) =>
        supply.receptionStartDate && supply.receptionEndDate
          ? `${supply.receptionStartDate}|${supply.receptionEndDate}`
          : null
      )
      .filter((range): range is string => range !== null)
  );

  if (ranges.length !== 1) return null;
  const [start, end] = ranges[0].split('|');
  if (start && end && start > end) return null;
  return start && end ? { start, end } : null;
}

function noticeStatus(
  receptionRange: { start: string; end: string } | null,
  sourceStatus: string | null,
  now: Date
): PublicRentalNoticeStatus {
  if (!receptionRange) {
    return sourceStatus?.includes('접수마감') ? 'closed' : 'unknown';
  }

  const today = toDateKey(kstCalendarToday(now));
  if (today < receptionRange.start) return 'upcoming';
  if (today > receptionRange.end) return 'closed';
  return 'ongoing';
}

function totalSupplyCount(supplies: NormalizedSupply[], firstLh?: Record<string, unknown>): number | null {
  const myhomeTotal = supplies.reduce((sum, supply) => sum + (supply.supplyCount ?? 0), 0);
  if (myhomeTotal > 0) return myhomeTotal;
  return positiveNumberOrNull(firstLh?.SUM_HSH_CNT ?? firstLh?.SUM_SUPLY_CO ?? firstLh?.SUPLY_HO_CO);
}

function noticeRegionName(
  myhomeRows: Array<Record<string, unknown>>,
  firstLh?: Record<string, unknown>
): string {
  const lhRegion = asString(firstLh?.CNP_CD_NM);
  if (lhRegion) return lhRegion;

  const regions = uniqueStrings(
    myhomeRows.map((row) => regionName(asString(row.brtcNm), asString(row.signguNm)))
  );
  if (regions.length === 0) return '전국';
  if (regions.length === 1) return regions[0];
  return `${regions[0]} 외`;
}

function isCorrection(
  myhomeRows: Array<Record<string, unknown>>,
  lhRows: Array<Record<string, unknown>>
): boolean {
  return (
    myhomeRows.some(
      (row) => Boolean(asString(row.beforePblancId)) || asString(row.sttusNm)?.includes('정정')
    ) ||
    lhRows.some(
      (row) => asString(row.PAN_SS)?.includes('정정') || asString(row.PAN_NM)?.includes('정정')
    )
  );
}

function latestLhRow(rows: Array<Record<string, unknown>>): Record<string, unknown> | undefined {
  return [...rows].sort((left, right) => {
    const leftDate = formatDateString(asString(left.PAN_DT)) ?? '';
    const rightDate = formatDateString(asString(right.PAN_DT)) ?? '';
    if (leftDate !== rightDate) return rightDate.localeCompare(leftDate);

    const leftId = asString(left.PAN_ID) ?? '';
    const rightId = asString(right.PAN_ID) ?? '';
    return rightId.localeCompare(leftId);
  })[0];
}

function myhomeCanonicalId(row: Record<string, unknown>): string | null {
  const panId = extractPanId(asString(row.url) ?? asString(row.pcUrl) ?? asString(row.mobileUrl));
  return truncateCanonicalId(panId ?? asString(row.pblancId));
}

function buildMyhomeAliasIndex(
  rows: Array<Record<string, unknown>>
): Map<Record<string, unknown>, { myhome: string[]; lh: string[] }> {
  const rowsByPblancId = new Map<string, Record<string, unknown>>();
  const beforeByPblancId = new Map<string, string>();

  for (const row of rows) {
    const pblancId = asString(row.pblancId);
    if (!pblancId) continue;
    if (!rowsByPblancId.has(pblancId)) {
      rowsByPblancId.set(pblancId, row);
    }

    const beforePblancId = asString(row.beforePblancId);
    if (beforePblancId) {
      beforeByPblancId.set(pblancId, beforePblancId);
    }
  }

  const aliases = new Map<Record<string, unknown>, { myhome: string[]; lh: string[] }>();
  for (const row of rows) {
    const myhomeIds: string[] = [];
    const lhIds: string[] = [];
    const visited = new Set<string>();
    let currentId = asString(row.pblancId);

    while (currentId && !visited.has(currentId)) {
      visited.add(currentId);
      myhomeIds.push(currentId);
      const currentRow = rowsByPblancId.get(currentId);
      const panId = currentRow ? myhomePanId(currentRow) : null;
      if (panId) {
        lhIds.push(panId);
      }
      currentId = beforeByPblancId.get(currentId) ?? null;
    }

    aliases.set(row, {
      myhome: uniqueStrings(myhomeIds),
      lh: uniqueStrings(lhIds),
    });
  }

  return aliases;
}

function myhomePanId(row: Record<string, unknown>): string | null {
  return truncateCanonicalId(
    extractPanId(asString(row.url) ?? asString(row.pcUrl) ?? asString(row.mobileUrl))
  );
}

function extractPanId(url: string | null): string | null {
  if (!url) return null;
  const match = url.match(/[?&]panId=(\d{1,20})/);
  return match?.[1] ?? null;
}

function truncateCanonicalId(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.slice(0, 20);
}

function normalizeItems(items: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(items)) {
    return items.map((item) => asRecord(item)).filter((item): item is Record<string, unknown> => item !== null);
  }

  const record = asRecord(items);
  if (!record) return [];
  if ('item' in record) return normalizeItems(record.item);
  return [record];
}

function stripCorrectionPrefix(value: string | null): string | null {
  if (!value) return null;
  return value.replace(/^\[[^\]]*정정[^\]]*\]\s*/, '');
}

function uniqueNullableString(values: Array<string | null>): string | null {
  const unique = uniqueStrings(values);
  return unique.length === 1 ? unique[0] : null;
}

function firstString(values: Array<string | null | undefined>): string | null {
  return values.find((value): value is string => Boolean(value)) ?? null;
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function regionName(primary: string | null, secondary: string | null): string {
  return [primary, secondary].filter(Boolean).join(' ') || '전국';
}

function positiveNumberOrNull(value: unknown): number | null {
  const numeric = toNonNegativeInteger(value);
  return numeric && numeric > 0 ? numeric : null;
}

function toNonNegativeInteger(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(String(value).replaceAll(',', ''));
  if (!Number.isFinite(numeric) || numeric < 0) return null;
  return Math.trunc(numeric);
}

function parseDate(value: string | null | undefined): Date | null {
  const formatted = formatDateString(value);
  return formatted ? new Date(`${formatted}T00:00:00.000Z`) : null;
}

function formatDateString(value: string | null | undefined): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, '');
  if (digits.length !== 8) return null;
  const formatted = `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
  const date = new Date(`${formatted}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime())) return null;
  return date.toISOString().slice(0, 10) === formatted ? formatted : null;
}

function toDateKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function emptyToNull(value: string | null): string | null {
  return value && value.trim() ? value : null;
}

function asString(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}
