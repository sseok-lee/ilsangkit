#!/usr/bin/env tsx
// @TASK Phase2-8 - 카카오 Geocoding 좌표 보강 스크립트

import { fileURLToPath } from 'url';
import { resolve } from 'path';
import { PrismaClient } from '@prisma/client';
import { installRuntimeGuard } from './_runtimeGuard.js';
import { withRealEstateWriteLock } from '../utils/realEstateWriteLock.js';
import { recentMonthsCondition } from '../lib/sargableDate.js';

export interface UniqueBuilding {
  buildingName: string;
  bjdCode: string;
  city: string;
  district: string;
  dongName: string;
  roadName: string | null;
  jibun: string | null;
}

export interface Coordinates {
  lat: number;
  lng: number;
}

interface KakaoResponse {
  documents: Array<{
    x: string;
    y: string;
    place_name?: string;
    address_name?: string;
  }>;
}

export type RealEstateTable =
  | 'aptSaleTransaction'
  | 'aptRentTransaction'
  | 'villaSaleTransaction'
  | 'villaRentTransaction'
  | 'offitelSaleTransaction'
  | 'offitelRentTransaction';

const REAL_ESTATE_TABLES: RealEstateTable[] = [
  'aptSaleTransaction',
  'aptRentTransaction',
  'villaSaleTransaction',
  'villaRentTransaction',
  'offitelSaleTransaction',
  'offitelRentTransaction',
];

/**
 * 좌표 공유 가능한 쌍 테이블 (매매 ↔ 전월세)
 * store/land는 쌍이 없으므로 매핑 없음
 */
const SIBLING_TABLE: Partial<Record<RealEstateTable, RealEstateTable>> = {
  aptSaleTransaction: 'aptRentTransaction',
  aptRentTransaction: 'aptSaleTransaction',
  villaSaleTransaction: 'villaRentTransaction',
  villaRentTransaction: 'villaSaleTransaction',
  offitelSaleTransaction: 'offitelRentTransaction',
  offitelRentTransaction: 'offitelSaleTransaction',
};

/**
 * Prisma 델리게이트명 → 실제 SQL 테이블명.
 * raw SQL 에서 사용. schema.prisma 에 @@map 이 없어 모델명 = 테이블명이다.
 * realEstateService 의 TABLE_NAME_MAP 은 슬러그('apt-sale') 기준이라 재사용 불가.
 */
export const SQL_TABLE_NAME: Record<RealEstateTable, string> = {
  aptSaleTransaction: 'AptSaleTransaction',
  aptRentTransaction: 'AptRentTransaction',
  villaSaleTransaction: 'VillaSaleTransaction',
  villaRentTransaction: 'VillaRentTransaction',
  offitelSaleTransaction: 'OffitelSaleTransaction',
  offitelRentTransaction: 'OffitelRentTransaction',
};

/**
 * 좌표 판정 단위 = 요약(RealEstateBuildingSummaryV2)·상세 위치와 같은 "주소 건물".
 * 요약은 (buildingName, bjdCode, TRIM(dongName), jibun) 으로 나누므로, (bjdCode, buildingName) 만으로 묶으면
 * 같은 법정동의 동명 빌라 중 한 곳에 좌표가 있다는 이유로 다른 지번이 영영 좌표를 못 받는다
 * (2026-10-20 운영: 빌라 매매에서 이런 지번 624곳).
 */
export interface BuildingKey {
  bjdCode: string;
  buildingName: string;
  dongName: string;
  jibun: string;
}

const ADDRESS_COLUMNS = `bjdCode, buildingName, COALESCE(TRIM(dongName), '') AS dongName, COALESCE(TRIM(jibun), '') AS jibun`;

function addressMatch(alias = ''): string {
  const a = alias ? `${alias}.` : '';
  return `${a}bjdCode = ? AND ${a}buildingName = ? AND COALESCE(TRIM(${a}dongName), '') = ? AND COALESCE(TRIM(${a}jibun), '') = ?`;
}

function addressParams(key: BuildingKey): string[] {
  return [key.bjdCode, key.buildingName, key.dongName, key.jibun];
}

export function toBuildingKey(row: { bjdCode: string; buildingName: string; dongName?: string | null; jibun?: string | null }): BuildingKey {
  return {
    bjdCode: row.bjdCode,
    buildingName: row.buildingName,
    dongName: (row.dongName ?? '').trim(),
    jibun: (row.jibun ?? '').trim(),
  };
}

/**
 * 행 단위 좌표 복사 범위.
 *
 * 거래 행 좌표를 행마다 쓰는 곳은 지도 동 단위 집계(realEstateMapService, 최근 3개월·당월 포함)뿐이다.
 * 요약·상세·검증은 주소 건물마다 "좌표 있는 행 하나"만 있으면 된다. 그래서 행 복사는 최근 4개월(1개월 여유)로
 * 한정한다 — 과거 행까지 채우면 2021·2022 백필 후 하루 280만 행 UPDATE 로 45분 watchdog 을 넘겼다(2026-10-20).
 * 좌표가 하나도 없는 주소 건물은 날짜와 무관하게 별도 단계(짝 테이블 복사 → 카카오)에서 채운다.
 */
export const ROW_COPY_RECENT_MONTHS = 4;

export interface DealYearMonth {
  year: number;
  month: number;
}

export function recentRowCopySince(now: Date = new Date()): DealYearMonth {
  const [year, month] = recentMonthsCondition(ROW_COPY_RECENT_MONTHS, now).params;
  return { year, month };
}

function recentCondition(since: DealYearMonth): { sql: string; params: number[] } {
  return {
    sql: '((dealYear = ? AND dealMonth >= ?) OR dealYear > ?)',
    params: [since.year, since.month, since.year],
  };
}

/**
 * 최근 거래 행 중 lat 이 빈 주소 건물 — 행 복사 대상.
 * Prisma distinct 는 앱 메모리에서 돈다(2026-07-16 OOM) — 반드시 SQL DISTINCT.
 */
export async function getRecentBuildingsNeedingCoords(
  prisma: PrismaClient,
  table: RealEstateTable,
  since: DealYearMonth,
): Promise<BuildingKey[]> {
  const sqlTable = SQL_TABLE_NAME[table];
  const recent = recentCondition(since);
  return prisma.$queryRawUnsafe<BuildingKey[]>(
    `SELECT DISTINCT ${ADDRESS_COLUMNS} FROM \`${sqlTable}\` WHERE lat IS NULL AND ${recent.sql}`,
    ...recent.params,
  );
}

/**
 * 이 테이블에 좌표 있는 행이 하나도 없는 주소 건물(날짜 무관).
 * 과거 거래만 있는 건물도 여기서 잡힌다 — 요약은 유형별로 자기 테이블에서만 좌표를 가져가므로
 * 이런 건물이 빠지면 요약 좌표가 비게 된다. 운영 실측: 아파트 전월세 549만 행 17초.
 */
export async function getBuildingsWithoutAnyCoords(
  prisma: PrismaClient,
  table: RealEstateTable,
  retryCutoff?: Date,
): Promise<BuildingKey[]> {
  const sqlTable = SQL_TABLE_NAME[table];
  const retry = retryCutoff ? ' AND (geocodedAt IS NULL OR geocodedAt < ?)' : '';
  return prisma.$queryRawUnsafe<BuildingKey[]>(
    `SELECT n.bjdCode, n.buildingName, n.dongName, n.jibun
     FROM (SELECT DISTINCT ${ADDRESS_COLUMNS} FROM \`${sqlTable}\` WHERE lat IS NULL${retry}) n
     WHERE NOT EXISTS (
       SELECT 1 FROM \`${sqlTable}\` c
       WHERE c.bjdCode = n.bjdCode AND c.buildingName = n.buildingName
         AND COALESCE(TRIM(c.dongName), '') = n.dongName AND COALESCE(TRIM(c.jibun), '') = n.jibun
         AND c.lat IS NOT NULL
     )`,
    ...(retryCutoff ? [retryCutoff] : []),
  );
}

/** 실패한 지오코딩 재시도 최소 대기 기간 (일) — 카카오 coverage 개선/전략 변경 대비 */
const GEOCODE_RETRY_DAYS = 30;

function getPropertySuffix(table: RealEstateTable): string {
  if (table.startsWith('apt')) return '아파트';
  if (table.startsWith('offitel')) return '오피스텔';
  return '';
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseCoords(response: KakaoResponse): Coordinates | null {
  if (!response.documents || response.documents.length === 0) return null;
  const doc = response.documents[0];
  const lat = parseFloat(doc.y);
  const lng = parseFloat(doc.x);
  if (isNaN(lat) || isNaN(lng)) return null;
  return { lat, lng };
}

const apiKey = process.env.KAKAO_REST_API_KEY;

/**
 * 카카오 주소 검색 API (법정동+지번 → 정확한 좌표)
 */
async function searchByAddress(query: string): Promise<Coordinates | null> {
  if (!apiKey) return null;
  try {
    const url = `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(query)}&size=1`;
    const res = await fetch(url, { headers: { Authorization: `KakaoAK ${apiKey}` } });
    if (!res.ok) return null;
    return parseCoords((await res.json()) as KakaoResponse);
  } catch { return null; }
}

/**
 * 카카오 키워드 검색 API (건물명 → 장소 검색)
 */
async function searchByKeyword(query: string): Promise<Coordinates | null> {
  if (!apiKey) return null;
  try {
    const url = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}&size=1`;
    const res = await fetch(url, { headers: { Authorization: `KakaoAK ${apiKey}` } });
    if (!res.ok) return null;
    return parseCoords((await res.json()) as KakaoResponse);
  } catch { return null; }
}

// 하위 호환
export const geocodeAddress = searchByKeyword;
export const geocodeByKeyword = searchByKeyword;

/**
 * buildingName 정제: 카카오 검색에 방해되는 패턴 제거
 * - "(xxx-xx)" 번지 괄호: 삼도주택(414-11) → 삼도주택
 * - "(A동)", "(C동)", "(A-B동)" 등 동 괄호: 렉스빌(C동) → 렉스빌
 * - 끝의 "27동" 등 숫자+동: 효성빌라27동 → 효성빌라
 * - 끝의 "D동" 등 영문+동: 삼성에센빌D동 → 삼성에센빌
 * - 끝의 "가동" 등 한글+동: 유동빌라가동 → 유동빌라
 */
export function cleanBuildingName(name: string): string {
  let cleaned = name;
  cleaned = cleaned.replace(/\(\d+-\d+\)/g, '');
  cleaned = cleaned.replace(/\([A-Za-z가-힣0-9,-]+동\)/g, '');
  cleaned = cleaned.replace(/\d+동$/, '');
  cleaned = cleaned.replace(/[A-Za-z]+동$/, '');
  cleaned = cleaned.replace(/[가나다라마바사]동$/, '');
  cleaned = cleaned.replace(/\(\s*\)/g, '');
  return cleaned.trim();
}

/**
 * 6단계 지오코딩 전략
 * 1) 주소 API: "시 구 동 지번" (가장 정확)
 * 2) 주소 API: 도로명 주소
 * 3) 키워드 API: "구 건물명 아파트"
 * 4) 키워드 API: "시 구 동 건물명"
 * 5) 키워드 API: "구 정제된건물명" (괄호/동호수 제거)
 * 6) 키워드 API: "시 구 동 정제된건물명"
 */
async function geocodeBuilding(
  building: UniqueBuilding,
  table: RealEstateTable
): Promise<Coordinates | null> {
  const { city, district, dongName, jibun, buildingName, roadName } = building;
  const suffix = getPropertySuffix(table);

  // 1) 주소 API: 법정동 + 지번 (가장 정확)
  if (dongName && jibun) {
    const addrQuery = `${city} ${district} ${dongName} ${jibun}`;
    const coords = await searchByAddress(addrQuery);
    if (coords) return coords;
    await sleep(100);
  }

  // 2) 주소 API: 도로명 주소
  if (roadName && roadName.trim()) {
    const roadQuery = `${city} ${district} ${roadName}`;
    const coords = await searchByAddress(roadQuery);
    if (coords) return coords;
    await sleep(100);
  }

  // 3) 키워드 API: "구 건물명 아파트"
  const kwName = suffix && !buildingName.includes(suffix) ? `${buildingName}${suffix}` : buildingName;
  const kwQuery = `${district} ${kwName}`;
  const coords2 = await searchByKeyword(kwQuery);
  if (coords2) return coords2;
  await sleep(100);

  // 4) 키워드 API: "시 구 동 건물명"
  if (dongName) {
    const lastQuery = `${city} ${district} ${dongName} ${buildingName}`;
    const coords3 = await searchByKeyword(lastQuery);
    if (coords3) return coords3;
    await sleep(100);
  }

  // 5) 정제된 건물명으로 재시도 (괄호/동호수 제거)
  const cleaned = cleanBuildingName(buildingName);
  if (cleaned && cleaned !== buildingName) {
    const coords4 = await searchByKeyword(`${district} ${cleaned}`);
    if (coords4) return coords4;
    await sleep(100);

    // 6) "시 구 동 정제된건물명"
    if (dongName) {
      const coords5 = await searchByKeyword(`${city} ${district} ${dongName} ${cleaned}`);
      if (coords5) return coords5;
    }
  }

  return null;
}

/**
 * 카카오 조회 대상 — 좌표 있는 행이 하나도 없는 주소 건물(최근 실패 건 제외).
 * 주소 상세(시·구·도로명)는 조회 직전에 건물별로 한 행에서 읽는다(loadBuildingAddress) —
 * 미리 수만 건을 읽으면 그 시간이 테이블당 카카오 시간 상한 밖에서 흘러간다.
 */
export async function getGeocodeTargets(
  prisma: PrismaClient,
  table: RealEstateTable,
  now: Date = new Date(),
): Promise<BuildingKey[]> {
  const retryCutoff = new Date(now.getTime() - GEOCODE_RETRY_DAYS * 24 * 60 * 60 * 1000);
  return getBuildingsWithoutAnyCoords(prisma, table, retryCutoff);
}

/**
 * 주소 필드를 **한 행에서** 읽는다. MIN()/ANY_VALUE() 로 뽑으면 서로 다른 행의 roadName 과 jibun 이
 * 섞여 존재하지 않는 주소가 만들어진다.
 */
export async function loadBuildingAddress(
  prisma: PrismaClient,
  table: RealEstateTable,
  key: BuildingKey,
): Promise<UniqueBuilding | null> {
  const rows = await prisma.$queryRawUnsafe<UniqueBuilding[]>(
    `SELECT buildingName, bjdCode, city, district, dongName, roadName, jibun
     FROM \`${SQL_TABLE_NAME[table]}\` WHERE ${addressMatch()} AND lat IS NULL LIMIT 1`,
    ...addressParams(key),
  );
  return rows[0] ?? null;
}

export async function updateBuildingCoordinates(
  prisma: PrismaClient,
  table: RealEstateTable,
  building: UniqueBuilding,
  coords: Coordinates
): Promise<number> {
  return withRealEstateWriteLock('updateBuildingCoordinates', async () => {
  return prisma.$executeRawUnsafe(
    `UPDATE \`${SQL_TABLE_NAME[table]}\` SET lat = ?, lng = ?, geocodedAt = NOW(3)
     WHERE ${addressMatch()} AND lat IS NULL`,
    coords.lat, coords.lng, ...addressParams(toBuildingKey(building)),
  );
  });
}

/**
 * 좌표 보강 시도 기록 — 실패 시 geocodedAt만 갱신해 일정 기간 재시도 스킵
 */
export async function markGeocodeAttempted(
  prisma: PrismaClient,
  table: RealEstateTable,
  building: UniqueBuilding,
): Promise<void> {
  return withRealEstateWriteLock('markGeocodeAttempted', async () => {
  await prisma.$executeRawUnsafe(
    `UPDATE \`${SQL_TABLE_NAME[table]}\` SET geocodedAt = NOW(3) WHERE ${addressMatch()} AND lat IS NULL`,
    ...addressParams(toBuildingKey(building)),
  );
  });
}

/**
 * 대상 주소 건물들의 좌표를 seedTable 의 같은 주소 건물에서 찾아 채운다. since 가 있으면 최근 거래 행만.
 *
 * 구동 방향에 주의: 반드시 '좌표가 없는 건물'(수천 건)에서 출발한다.
 * '좌표가 있는 행'(수백만)에서 출발하면 힙이 터진다.
 */
async function copyCoordsFor(
  prisma: PrismaClient,
  table: RealEstateTable,
  seedTable: RealEstateTable,
  targets: BuildingKey[],
  since?: DealYearMonth,
): Promise<number> {
  const recent = since ? recentCondition(since) : null;
  let totalCopied = 0;
  for (const target of targets) {
    const seeds = await prisma.$queryRawUnsafe<Array<{ lat: unknown; lng: unknown }>>(
      `SELECT lat, lng FROM \`${SQL_TABLE_NAME[seedTable]}\`
       WHERE ${addressMatch()} AND lat IS NOT NULL AND lng IS NOT NULL LIMIT 1`,
      ...addressParams(target),
    );
    const seed = seeds[0];
    if (!seed) continue;

    totalCopied += await prisma.$executeRawUnsafe(
      `UPDATE \`${SQL_TABLE_NAME[table]}\` SET lat = ?, lng = ?, geocodedAt = NOW(3)
       WHERE ${addressMatch()} AND lat IS NULL${recent ? ` AND ${recent.sql}` : ''}`,
      seed.lat, seed.lng, ...addressParams(target), ...(recent?.params ?? []),
    );
  }
  return totalCopied;
}

/**
 * 같은 테이블 안에서 같은 주소 건물의 좌표를 최근 거래 빈 행에 복사 — 카카오 호출 없이 '알려진 건물' 해결
 */
export async function copyCoordsWithinTable(
  prisma: PrismaClient,
  table: RealEstateTable,
  since: DealYearMonth = recentRowCopySince(),
): Promise<number> {
  return withRealEstateWriteLock('copyCoordsWithinTable', async () => {
  const targets = await getRecentBuildingsNeedingCoords(prisma, table, since);
  if (targets.length === 0) return 0;
  return copyCoordsFor(prisma, table, table, targets, since);
  });
}

/**
 * 쌍 테이블 (매매 ↔ 전월세) 에서 같은 주소 건물 좌표를 최근 거래 빈 행에 복사
 */
export async function copyCoordsFromSibling(
  prisma: PrismaClient,
  table: RealEstateTable,
  since: DealYearMonth = recentRowCopySince(),
): Promise<number> {
  return withRealEstateWriteLock('copyCoordsFromSibling', async () => {
  const sibling = SIBLING_TABLE[table];
  if (!sibling) return 0;

  const targets = await getRecentBuildingsNeedingCoords(prisma, table, since);
  if (targets.length === 0) return 0;
  return copyCoordsFor(prisma, table, sibling, targets, since);
  });
}

/**
 * 이 테이블에 좌표가 하나도 없는 주소 건물(예: 전월세는 2021년 거래뿐, 매매에는 좌표 있음)에
 * 짝 테이블 좌표를 날짜와 무관하게 그 건물 빈 행 전부에 복사한다. 카카오 조회 전 단계.
 */
export async function copyCoordsFromSiblingForUncoordinated(
  prisma: PrismaClient,
  table: RealEstateTable,
): Promise<number> {
  return withRealEstateWriteLock('copyCoordsFromSiblingForUncoordinated', async () => {
  const sibling = SIBLING_TABLE[table];
  if (!sibling) return 0;

  const targets = await getBuildingsWithoutAnyCoords(prisma, table);
  if (targets.length === 0) return 0;
  return copyCoordsFor(prisma, table, sibling, targets);
  });
}

// 하위 호환
export function buildSearchQuery(building: UniqueBuilding): string {
  if (building.roadName?.trim()) return `${building.city} ${building.district} ${building.roadName} ${building.buildingName}`;
  return `${building.city} ${building.district} ${building.buildingName}`;
}
export function parseKakaoCoordinates(response: KakaoResponse): Coordinates | null {
  return parseCoords(response);
}

/**
 * 테이블당 카카오 조회 시간 상한. 백필로 좌표 없는 건물이 수만 곳 생기면(2026-10-20 빌라 매매 42,008)
 * 앞 테이블이 45분 watchdog 을 다 써서 뒤 테이블(빌라 전월세·오피스텔)이 영영 차례를 못 받는다.
 * 6테이블 × 5분 + 복사 단계 ≈ 35분으로 watchdog 안에 끝난다. 남은 건물은 다음 날 이어서 한다.
 */
export const KAKAO_BUDGET_PER_TABLE_MS = 5 * 60_000;

export interface ProcessTableOptions {
  kakaoBudgetMs?: number;
  now?: () => number;
}

export async function processTable(
  prisma: PrismaClient,
  table: RealEstateTable,
  options: ProcessTableOptions = {},
): Promise<void> {
  const now = options.now ?? Date.now;
  const kakaoBudgetMs = options.kakaoBudgetMs ?? KAKAO_BUDGET_PER_TABLE_MS;
  const since = recentRowCopySince(new Date(now()));
  return withRealEstateWriteLock('processTable', async () => {
  // 0) 사전 복사 단계 — 카카오 호출 없이 '알려진 건물' 좌표 채우기
  console.info(`\n[${table}] 같은 테이블 좌표 복사 중... (최근 거래 ${since.year}-${String(since.month).padStart(2, '0')}~)`);
  const copiedSame = await copyCoordsWithinTable(prisma, table, since);
  console.info(`[${table}] 같은 테이블에서 ${copiedSame}건 복사 완료`);

  const copiedSibling = await copyCoordsFromSibling(prisma, table, since);
  if (copiedSibling > 0) {
    console.info(`[${table}] 쌍 테이블(${SIBLING_TABLE[table]})에서 ${copiedSibling}건 복사 완료`);
  }

  const copiedUncoordinated = await copyCoordsFromSiblingForUncoordinated(prisma, table);
  if (copiedUncoordinated > 0) {
    console.info(`[${table}] 좌표 없는 건물: 쌍 테이블에서 ${copiedUncoordinated}건 복사 완료`);
  }

  // 1) 카카오 — 대상 목록 조회 시간까지 상한에 포함한다
  const kakaoDeadline = now() + kakaoBudgetMs;
  console.info(`[${table}] 좌표 없는 건물 추출 중...`);
  const targets = await getGeocodeTargets(prisma, table, new Date(now()));

  if (targets.length === 0) {
    console.info(`[${table}] 지오코딩 대상 없음`);
    return;
  }

  console.info(`[${table}] ${targets.length}개 건물 좌표 보강 시작`);
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < targets.length; i++) {
    if (now() >= kakaoDeadline) {
      console.info(`[${table}] 카카오 조회 시간 상한(${Math.round(kakaoBudgetMs / 60_000)}분) 도달 — 남은 ${targets.length - i}개 건물은 다음 실행에서 이어서 한다`);
      break;
    }
    const building = await loadBuildingAddress(prisma, table, targets[i]);
    if (!building) continue;
    const coords = await geocodeBuilding(building, table);

    if (coords) {
      const cnt = await updateBuildingCoordinates(prisma, table, building, coords);
      console.info(`[${table}] (${i + 1}/${targets.length}) ✓ ${building.buildingName} → ${coords.lat},${coords.lng} (${cnt}건)`);
      successCount++;
    } else {
      await markGeocodeAttempted(prisma, table, building);
      console.warn(`[${table}] (${i + 1}/${targets.length}) ✗ ${building.buildingName} [${building.dongName} ${building.jibun ?? ''}]`);
      failCount++;
    }

    if (i < targets.length - 1) await sleep(150);
  }

  const processed = successCount + failCount;
  const rate = processed > 0 ? ((successCount / processed) * 100).toFixed(1) : '0';
  console.info(`[${table}] 완료 — 성공: ${successCount}, 실패: ${failCount} (${rate}%), 남음: ${targets.length - processed}`);
  });
}

async function main(): Promise<void> {
  if (!process.env.KAKAO_REST_API_KEY) {
    console.error('KAKAO_REST_API_KEY 환경변수가 설정되지 않았습니다.');
    process.exit(1);
  }

  const tableArg = process.argv.find(a => a.startsWith('--table='))?.split('=')[1] as RealEstateTable | undefined;
  const tables = tableArg ? [tableArg] : REAL_ESTATE_TABLES;

  const prisma = new PrismaClient();
  try {
    console.info(`=== 부동산 데이터 좌표 보강 시작 (${tables.join(', ')}) ===`);
    for (const table of tables) {
      await processTable(prisma, table);
    }
    console.info('\n=== 좌표 보강 완료 ===');
  } finally {
    await prisma.$disconnect();
  }
}


const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === resolve(__filename)) {
  installRuntimeGuard({ maxMinutes: 45, name: 'geocodeRealEstate' });
  withRealEstateWriteLock('geocodeRealEstate', main).catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
