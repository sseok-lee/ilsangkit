#!/usr/bin/env tsx
/**
 * adoptRegionReform — 2026-07-01 전남광주통합특별시 출범에 따른 광주/전남 이중저장 데이터
 * 정규화 마이그레이션 (프로덕션 운영용).
 *
 * 배경: 광주광역시(bjdCode 29xxx)·전라남도(46xxx) 데이터가 옛 city명 + 옛 bjdCode로 저장돼
 * 있고, Phase A 배포 이후 sync는 신명(전남광주통합특별시 / 12xxx)으로 적재한다. 그 결과
 * 경계에서 옛/신 이중저장이 발생한다. 이 스크립트는 **기존(옛)** 행을 신명 + 12xxx로 정규화하며,
 * sourceId(옛 bjdCode 임베드)를 신 bjdCode로 재코딩하고, 신 sync가 이미 넣은 행과의 unique
 * 충돌은 옛 행 삭제(dedup)로 해소한다.
 *
 * ⚠️ 최고위험 코드. 반드시 먼저 dry-run으로 계획을 검토한 뒤 --apply 하라.
 *
 * 안전 설계(스펙 §D2·D3·D4·U2):
 *  - **PK id 목록 기반 청크 UPDATE** — 비-sargable `LEFT(bjdCode,2)` 풀스캔 금지.
 *    (후보 SELECT는 인덱스 sargable 조건 `city LIKE '광주%'` 등으로만 수집하고,
 *     실제 뮤테이션은 `WHERE id IN (...)` PK 타깃으로만 수행)
 *  - **`max_execution_time` 사용 안 함**(UPDATE에 무효) → 작은 오토커밋 배치 +
 *    짧은 `innodb_lock_wait_timeout` + 배치 간 sleep + 진행/PROCESSLIST 로그.
 *  - **sourceId 재코딩(D2)**: 옛 bjdCode 토큰 **전체**를 신 bjdCode로 치환(단순 접두치환 아님).
 *    치환값이 이미 존재하면(신 sync가 넣음) 옛 행 **삭제(dedup)**, 아니면 UPDATE.
 *  - **AuctionItem 하이브리드(D4)**: bjdCode=''(빈) 스냅샷 → city만; bjdCode 있는 행 → 재코딩.
 *    단 AuctionItem.sourceId=`auction-{cltrMngNo}`는 bjdCode 미임베드 → sourceId 재코딩 없음.
 *  - **Region**: 옛 29/46 27행 삭제 → (city,district)/(city,slug) 중복 0 assert →
 *    신 12xxx 27행 city 보정. (@@unique 충돌 방지 순서)
 *  - **U2 레거시 폴백맵**: Region 삭제 **전** oldBjd(29/46)→districtName 맵을 파일로 캡처.
 *  - **백업**: 대상 행 (id,city,bjdCode,sourceId) → `_reform_bak2_{table}` 테이블 + 파일 덤프.
 *
 * 사용법:
 *   npx tsx src/scripts/adoptRegionReform.ts                   # dry-run (기본, DB 미변경)
 *   npx tsx src/scripts/adoptRegionReform.ts --apply           # 실제 마이그레이션
 *   npx tsx src/scripts/adoptRegionReform.ts --only=AptSaleTransaction,Aed  # 특정 테이블만
 *   npx tsx src/scripts/adoptRegionReform.ts --apply --force-region         # 신 12xxx Region 부재여도 진행(위험)
 *
 * 운영은 dist 실행: node dist/scripts/adoptRegionReform.js --apply
 */

import { fileURLToPath } from 'url';
import { resolve, join } from 'path';
import * as fs from 'fs';
import { prisma } from '../lib/prisma.js';
import {
  normalizeRegionName,
  JNGJ_CITY,
  JNGJ_DISTRICTS,
} from '../lib/normalizeRegionName.js';

// ============================================================================
// 정본 static 매핑 (region12-mapping.md 실측 2026-07-21) — Region 존재 비의존(S4).
// 시작 시 27쌍 완비 + JNGJ_DISTRICTS 커버 assert.
// ============================================================================

/** district → 신 bjdCode(12xxx). 27쌍(광주 5구 + 전남 22시군, 이름 충돌 없음). */
export const REGION12_LOOKUP: Map<string, string> = new Map([
  ['목포시', '12110'],
  ['여수시', '12130'],
  ['순천시', '12150'],
  ['나주시', '12170'],
  ['광양시', '12190'],
  ['동구', '12210'],
  ['서구', '12240'],
  ['남구', '12270'],
  ['북구', '12300'],
  ['광산구', '12330'],
  ['담양군', '12710'],
  ['곡성군', '12720'],
  ['구례군', '12730'],
  ['고흥군', '12740'],
  ['보성군', '12750'],
  ['화순군', '12760'],
  ['장흥군', '12770'],
  ['강진군', '12780'],
  ['해남군', '12790'],
  ['영암군', '12800'],
  ['무안군', '12810'],
  ['함평군', '12820'],
  ['영광군', '12830'],
  ['장성군', '12840'],
  ['완도군', '12850'],
  ['진도군', '12860'],
  ['신안군', '12870'],
]);

/**
 * REGION12_LOOKUP 무결성 검증 — 시작 시 호출. 27쌍 완비 + JNGJ_DISTRICTS 양방향 일치.
 * 순수함수(테스트 가능). 실패 시 Error throw.
 */
export function assertRegion12Lookup(lookup: Map<string, string> = REGION12_LOOKUP): void {
  if (lookup.size !== 27) {
    throw new Error(`REGION12_LOOKUP 는 27쌍이어야 하나 ${lookup.size}쌍입니다.`);
  }
  for (const d of JNGJ_DISTRICTS) {
    const code = lookup.get(d);
    if (!code) throw new Error(`REGION12_LOOKUP 에 district '${d}' 매핑 누락`);
    if (!/^12\d{3}$/.test(code)) throw new Error(`district '${d}' → '${code}' 는 12xxx 형식이 아님`);
  }
  for (const key of lookup.keys()) {
    if (!JNGJ_DISTRICTS.has(key)) throw new Error(`REGION12_LOOKUP 키 '${key}' 가 JNGJ_DISTRICTS에 없음(오탈자?)`);
  }
}

// ============================================================================
// 테이블 분류
// ============================================================================

/** sourceId 에 bjdCode를 2번째 토큰으로 임베드하는 거래테이블 → sourceId 재코딩 대상(D2). */
export const SOURCEID_BJD_TABLES: Set<string> = new Set([
  'AptSaleTransaction',
  'AptRentTransaction',
  'VillaSaleTransaction',
  'VillaRentTransaction',
  'OffitelSaleTransaction',
  'OffitelRentTransaction',
  'LandSaleTransaction',
]);

/** bjdCode 컬럼이 있는 시설(sourceId는 bjd 미임베드 → city+bjdCode만 재코딩). */
const BJD_FACILITY_TABLES: string[] = [
  'Aed', 'Childcare', 'Clothes', 'EvCharger', 'Hospital', 'Library', 'Market',
  'Park', 'Parking', 'Pharmacy', 'School', 'Sports', 'Toilet', 'Wifi',
];

/** AuctionItem — 하이브리드(빈 bjdCode 스냅샷은 city만). sourceId=auction-{cltrMngNo}(bjd 미임베드). */
const AUCTION_TABLE = 'AuctionItem';

/** bjdCode 컬럼이 없는 테이블 → city만 정규화. */
const CITY_ONLY_TABLES: string[] = ['SubwayStation', 'WasteSchedule'];

/** 대상 22 bjdCode 테이블(거래7 + 시설14 + Auction1) + city-only 2. Region은 별도 처리. */
const ALL_MUTATION_TABLES: string[] = [
  ...SOURCEID_BJD_TABLES,
  ...BJD_FACILITY_TABLES,
  AUCTION_TABLE,
  ...CITY_ONLY_TABLES,
];

// ============================================================================
// 순수함수 (테스트 대상) — DB·env 비의존
// ============================================================================

export interface ReformRow {
  id: number | string;
  table: string;
  city: string;
  district: string;
  /** 컬럼 자체가 없으면 undefined, 빈 스냅샷이면 '' — 둘 다 city-only 취급. */
  bjdCode?: string | null;
  sourceId?: string | null;
}

export interface ReformPlanItem {
  id: number | string;
  table: string;
  fromCity: string;
  toCity: string;
  fromBjd?: string;
  toBjd?: string;
  fromSourceId?: string;
  toSourceId?: string;
}

export interface NormalizationPlan {
  planned: ReformPlanItem[];
  /** JNGJ 대상이나 district가 lookup에 없어 bjdCode 재코딩 불가 → 안전 skip(전면중단 아님). */
  skippedDistrictUnmatched: { id: number | string; table: string; city: string; district: string; bjdCode: string }[];
  /** JNGJ 대상이나 이미 신명+신코드라 변경 불필요(멱등). */
  unchanged: number;
  /** normalizeRegionName이 JNGJ를 내지 않음(경기광주·무관지역) → 제외. */
  excludedNonTarget: number;
}

/**
 * sourceId의 옛 bjdCode 토큰을 신 bjdCode로 전체 치환(D2).
 * generateSourceId 형식은 `[category, bjdCode, ...].join('-')` — bjdCode가 2번째 토큰.
 * category(aptSale 등)는 하이픈이 없고 bjdCode(5자리)와 절대 같지 않으며, buildYear는 4자리라
 * "정확히 oldBjd와 같은 첫 토큰"을 찾아 치환하면 항상 bjdCode 토큰만 안전하게 바뀐다.
 * (단순 `29→12` 접두치환이 아니라 29140→12210처럼 뒤 3자리도 district 매핑으로 바뀜)
 */
export function reencodeSourceId(sourceId: string, oldBjd: string, newBjd: string): string {
  if (!oldBjd || !newBjd || oldBjd === newBjd) return sourceId;
  const parts = sourceId.split('-');
  const idx = parts.indexOf(oldBjd);
  if (idx === -1) return sourceId; // 토큰 없음 → 원본 유지(호출부에서 경고)
  parts[idx] = newBjd;
  return parts.join('-');
}

/**
 * 행 배열에 대한 정규화 계획을 산출한다(순수함수).
 * @param rows  {id,table,city,district,bjdCode?,sourceId?}
 * @param regionLookup  district → 신 12xxx bjdCode (static, 27쌍)
 */
export function computeNormalizationPlan(
  rows: ReformRow[],
  regionLookup: Map<string, string>
): NormalizationPlan {
  const planned: ReformPlanItem[] = [];
  const skippedDistrictUnmatched: NormalizationPlan['skippedDistrictUnmatched'] = [];
  let unchanged = 0;
  let excludedNonTarget = 0;

  for (const row of rows) {
    const norm = normalizeRegionName(row.city ?? '', row.district ?? '');

    // 대상 판정 = normalizeRegionName이 JNGJ_CITY를 낼 때만.
    //   경기도 광주시(city='경기'/'경기도')는 passthrough → non-target으로 제외.
    if (norm.city !== JNGJ_CITY) {
      excludedNonTarget++;
      continue;
    }

    const oldBjd = (row.bjdCode ?? '').trim();
    let toBjd: string | undefined;
    let bjdChanged = false;

    if (oldBjd === '') {
      // bjdCode 컬럼 없음 / 빈 스냅샷(Auction) / city-only → bjdCode 유지
      toBjd = undefined;
    } else if (oldBjd.startsWith('12')) {
      // 이미 신 코드 → 변경 없음
      toBjd = undefined;
    } else {
      // 옛 29/46(또는 기타) → district 매핑으로 신 12xxx
      const mapped = regionLookup.get(norm.district);
      if (!mapped) {
        skippedDistrictUnmatched.push({
          id: row.id,
          table: row.table,
          city: row.city,
          district: row.district,
          bjdCode: oldBjd,
        });
        continue;
      }
      toBjd = mapped;
      bjdChanged = mapped !== oldBjd;
    }

    // sourceId 재코딩 — bjdCode를 임베드하는 거래테이블 + 실제 bjd 변경 시에만
    let toSourceId: string | undefined;
    let srcChanged = false;
    const oldSrc = row.sourceId ?? undefined;
    if (bjdChanged && oldSrc && toBjd && SOURCEID_BJD_TABLES.has(row.table)) {
      const rec = reencodeSourceId(oldSrc, oldBjd, toBjd);
      if (rec !== oldSrc) {
        toSourceId = rec;
        srcChanged = true;
      }
    }

    const cityChanged = norm.city !== row.city;
    if (!cityChanged && !bjdChanged && !srcChanged) {
      unchanged++;
      continue;
    }

    const item: ReformPlanItem = {
      id: row.id,
      table: row.table,
      fromCity: row.city,
      toCity: norm.city,
    };
    if (bjdChanged) {
      item.fromBjd = oldBjd;
      item.toBjd = toBjd;
    }
    if (srcChanged) {
      item.fromSourceId = oldSrc;
      item.toSourceId = toSourceId;
    }
    planned.push(item);
  }

  return { planned, skippedDistrictUnmatched, unchanged, excludedNonTarget };
}

/** 스펙 인터페이스(T2) — planned 만 반환. */
export function planCityNormalization(
  rows: ReformRow[],
  regionLookup: Map<string, string>
): ReformPlanItem[] {
  return computeNormalizationPlan(rows, regionLookup).planned;
}

/**
 * sourceId 재코딩 대상(SOURCEID_BJD_TABLES)의 계획을 기존 sourceId 집합에 대해
 * update / dedup-delete로 분할한다(순수함수 — dry-run·apply 공통).
 *   - toSourceId가 이미 테이블에 존재(신 sync 삽입분)하거나, 이번 실행에서 먼저 배정(claimed)됐으면
 *     → 옛 행 DELETE(dedup).
 *   - 아니면 → UPDATE(city+bjdCode+sourceId).
 */
export function splitDedup(
  srcItems: ReformPlanItem[],
  existing: Set<string>
): { toUpdate: ReformPlanItem[]; toDeleteIds: (number | string)[] } {
  const claimed = new Set<string>();
  const toUpdate: ReformPlanItem[] = [];
  const toDeleteIds: (number | string)[] = [];
  for (const p of srcItems) {
    const sid = p.toSourceId as string;
    if (existing.has(sid) || claimed.has(sid)) {
      toDeleteIds.push(p.id);
    } else {
      claimed.add(sid);
      toUpdate.push(p);
    }
  }
  return { toUpdate, toDeleteIds };
}

/**
 * M-1 사전경고(순수함수): 거래테이블(sourceId에 bjd 임베드)에서 **bjdChanged인데 srcChanged가 아닌**
 * 계획 행 수. reencodeSourceId가 옛 bjd 토큰을 못 찾아 원본을 반환하면 sourceId가 그대로 남아,
 * bjdCode만 신 코드로 바뀐다. 이 경우 다음 sync가 신 bjd로 sourceId를 재생성 → **dedup 무력화(중복 생성)** 위험.
 * 0이 정상. apply를 막지 않고 경고만 낸다.
 */
export function countDedupDefeatRisk(table: string, planned: ReformPlanItem[]): number {
  if (!SOURCEID_BJD_TABLES.has(table)) return 0;
  // toBjd 존재 = bjdChanged, toSourceId 부재 = srcChanged 아님.
  return planned.filter((p) => p.toBjd !== undefined && p.toSourceId === undefined).length;
}

/**
 * MySQL duplicate-key(ER_DUP_ENTRY, 1062) / Prisma P2002 판정(near-pure, DB 비의존).
 * $executeRawUnsafe의 raw 오류는 보통 P2010로 래핑되며 meta/message에 원 드라이버 오류(1062)를 담는다.
 */
export function isDuplicateKeyError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { code?: unknown; meta?: { code?: unknown; message?: unknown }; message?: unknown };
  if (e.code === 'P2002') return true;
  const codeStr = String(e.code ?? '');
  const metaCode = String(e.meta?.code ?? '');
  if (metaCode === '1062' || codeStr === '1062' || codeStr === 'ER_DUP_ENTRY') return true;
  const text = `${String(e.message ?? '')} ${String(e.meta?.message ?? '')}`;
  return /duplicate entry/i.test(text) || /er_dup_entry/i.test(text);
}

// ============================================================================
// DB 실행부 (apply) — 아래는 --apply 경로에서만 동작. 테스트에서는 prisma를 mock.
// ============================================================================

const UPDATE_CHUNK = 1000; // WHERE id IN (...) 배치 크기(1k~5k 권장 하한)
const DELETE_CHUNK = 1000;
const ROW_UPDATE_CHUNK = 500; // per-row sourceId UPDATE 트랜잭션 묶음
const SELECT_IN_CHUNK = 1000; // sourceId 충돌 조회 IN 배치
const BATCH_SLEEP_MS = Number(process.env.REFORM_BATCH_SLEEP_MS) || 120;
const LOCK_WAIT_TIMEOUT = Number(process.env.REFORM_LOCK_WAIT_TIMEOUT) || 5;

/** 후보 SELECT용 city 접두(sargable). 경기도 광주시는 city='경기도'라 여기 안 걸림(보호). */
const CITY_LIKE_PREFIXES = ['광주', '전남', '전라'];

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function backupDir(): string {
  const dir = process.env.REFORM_BACKUP_DIR || resolve(fileURLToPath(import.meta.url), '../../../.reform-backup');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** raw SQL에 안전하게 넣을 테이블명인지 확인(화이트리스트). */
function assertKnownTable(table: string): void {
  if (![...ALL_MUTATION_TABLES, 'Region'].includes(table)) {
    throw new Error(`알 수 없는 테이블: ${table}`);
  }
}

interface RawRow {
  id: number | string;
  city: string;
  district: string;
  bjdCode?: string | null;
  sourceId?: string | null;
}

/** 후보 행을 인덱스 sargable 조건으로만 수집(과수집은 순수함수가 정확히 필터). */
async function selectCandidates(table: string, hasBjd: boolean): Promise<RawRow[]> {
  assertKnownTable(table);
  const cityLike = CITY_LIKE_PREFIXES.map((p) => `city LIKE '${p}%'`);
  const bjdLike = hasBjd ? [`bjdCode LIKE '29%'`, `bjdCode LIKE '46%'`] : [];
  const where = [...cityLike, ...bjdLike].join(' OR ');
  const cols = hasBjd ? 'id, city, district, bjdCode, sourceId' : 'id, city, district, sourceId';
  // sourceId 컬럼이 없는 테이블은 없음(대상 전부 sourceId 보유). city-only도 sourceId 존재.
  const rows = (await prisma.$queryRawUnsafe(
    `SELECT ${cols} FROM \`${table}\` WHERE ${where}`
  )) as RawRow[];
  return rows;
}

/** 백업: _reform_bak2_{table} 테이블 생성/적재 + 파일 덤프. */
async function backupRows(table: string, rows: RawRow[]): Promise<void> {
  assertKnownTable(table);
  // 파일 덤프(항상)
  const file = join(backupDir(), `${table}.json`);
  fs.writeFileSync(file, JSON.stringify(rows, (_k, v) => (typeof v === 'bigint' ? v.toString() : v), 2));
  console.info(`   [backup] ${table}: ${rows.length}행 파일 덤프 → ${file}`);

  if (rows.length === 0) return;
  const bak = `_reform_bak2_${table}`;
  await prisma.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS \`${bak}\` (` +
      `bak_id BIGINT AUTO_INCREMENT PRIMARY KEY, ` +
      `orig_id VARCHAR(200), city VARCHAR(100), bjdCode VARCHAR(20), sourceId VARCHAR(255), ` +
      `backedUpAt DATETIME DEFAULT CURRENT_TIMESTAMP)`
  );
  for (let i = 0; i < rows.length; i += SELECT_IN_CHUNK) {
    const chunk = rows.slice(i, i + SELECT_IN_CHUNK);
    const placeholders = chunk.map(() => '(?, ?, ?, ?)').join(', ');
    const params: (string | null)[] = [];
    for (const r of chunk) {
      params.push(String(r.id), r.city ?? null, r.bjdCode ?? null, r.sourceId ?? null);
    }
    await prisma.$executeRawUnsafe(
      `INSERT INTO \`${bak}\` (orig_id, city, bjdCode, sourceId) VALUES ${placeholders}`,
      ...params
    );
  }
  console.info(`   [backup] ${table}: ${rows.length}행 → \`${bak}\``);
}

/** 그룹 IN-list UPDATE (sourceId 미변경 케이스: city[+bjdCode]). PK 타깃, 배치 청크. */
async function applyGroupedUpdate(table: string, items: ReformPlanItem[]): Promise<number> {
  assertKnownTable(table);
  // (toCity, toBjd) 별 그룹핑 → 동일 SET 값으로 id IN 배치
  const groups = new Map<string, ReformPlanItem[]>();
  for (const it of items) {
    const key = `${it.toCity} ${it.toBjd ?? ''}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(it);
  }
  let updated = 0;
  for (const [, group] of groups) {
    const first = group[0];
    const setBjd = first.toBjd !== undefined;
    const setClause = setBjd ? 'city = ?, bjdCode = ?' : 'city = ?';
    for (let i = 0; i < group.length; i += UPDATE_CHUNK) {
      const chunk = group.slice(i, i + UPDATE_CHUNK);
      const placeholders = chunk.map(() => '?').join(', ');
      const params: (string | number)[] = setBjd
        ? [first.toCity, first.toBjd as string, ...chunk.map((c) => c.id)]
        : [first.toCity, ...chunk.map((c) => c.id)];
      const affected = await prisma.$executeRawUnsafe(
        `UPDATE \`${table}\` SET ${setClause} WHERE id IN (${placeholders})`,
        ...params
      );
      updated += Number(affected);
      console.info(`   [${table}] grouped update ${Math.min(i + UPDATE_CHUNK, group.length)}/${group.length} (bjd=${first.toBjd ?? '유지'})`);
      await sleep(BATCH_SLEEP_MS);
    }
  }
  return updated;
}

/** per-row UPDATE (sourceId 재코딩): city,bjdCode,sourceId 동시. PK 타깃, 트랜잭션 청크. */
async function applyRowUpdatesWithSourceId(table: string, items: ReformPlanItem[]): Promise<number> {
  assertKnownTable(table);
  let updated = 0;
  for (let i = 0; i < items.length; i += ROW_UPDATE_CHUNK) {
    const chunk = items.slice(i, i + ROW_UPDATE_CHUNK);
    await prisma.$transaction(
      chunk.map((it) =>
        prisma.$executeRawUnsafe(
          `UPDATE \`${table}\` SET city = ?, bjdCode = ?, sourceId = ? WHERE id = ?`,
          it.toCity,
          it.toBjd as string,
          it.toSourceId as string,
          it.id
        )
      )
    );
    updated += chunk.length;
    console.info(`   [${table}] sourceId row-update ${Math.min(i + ROW_UPDATE_CHUNK, items.length)}/${items.length}`);
    await sleep(BATCH_SLEEP_MS);
  }
  return updated;
}

/** id 청크 DELETE (dedup: 신 sync가 이미 넣은 sourceId와 충돌한 옛 행 제거). */
async function applyDeletes(table: string, ids: (number | string)[]): Promise<number> {
  assertKnownTable(table);
  let deleted = 0;
  for (let i = 0; i < ids.length; i += DELETE_CHUNK) {
    const chunk = ids.slice(i, i + DELETE_CHUNK);
    const placeholders = chunk.map(() => '?').join(', ');
    const affected = await prisma.$executeRawUnsafe(
      `DELETE FROM \`${table}\` WHERE id IN (${placeholders})`,
      ...chunk
    );
    deleted += Number(affected);
    console.info(`   [${table}] dedup delete ${Math.min(i + DELETE_CHUNK, ids.length)}/${ids.length}`);
    await sleep(BATCH_SLEEP_MS);
  }
  return deleted;
}

/** 어떤 toSourceId 들이 이미 테이블에 존재하는지 조회(신 sync 삽입분 = 충돌). */
async function findExistingSourceIds(table: string, sourceIds: string[]): Promise<Set<string>> {
  assertKnownTable(table);
  const found = new Set<string>();
  for (let i = 0; i < sourceIds.length; i += SELECT_IN_CHUNK) {
    const chunk = sourceIds.slice(i, i + SELECT_IN_CHUNK);
    const placeholders = chunk.map(() => '?').join(', ');
    const rows = (await prisma.$queryRawUnsafe(
      `SELECT sourceId FROM \`${table}\` WHERE sourceId IN (${placeholders})`,
      ...chunk
    )) as { sourceId: string }[];
    for (const r of rows) found.add(r.sourceId);
  }
  return found;
}

/**
 * I-2(a) dry-run pre-check: city-only 리네임 후 `(JNGJ_CITY, district, sourceId)`가 **이미 존재하는**
 * 행 수(= apply 시 unique 충돌로 스킵 예정 건수)를 SELECT(read-only)로 센다.
 * WasteSchedule `@@unique([city,district,sourceId])` 처럼 unique에 city가 포함된 테이블 대상.
 */
async function countCityRenameConflicts(
  table: string,
  targets: { district: string; sourceId: string }[]
): Promise<number> {
  assertKnownTable(table);
  if (targets.length === 0) return 0;
  const matched = new Set<string>();
  for (let i = 0; i < targets.length; i += SELECT_IN_CHUNK) {
    const chunk = targets.slice(i, i + SELECT_IN_CHUNK);
    const placeholders = chunk.map(() => '(?, ?)').join(', ');
    const params: string[] = [JNGJ_CITY];
    for (const t of chunk) params.push(t.district, t.sourceId);
    const rows = (await prisma.$queryRawUnsafe(
      `SELECT district, sourceId FROM \`${table}\` WHERE city = ? AND (district, sourceId) IN (${placeholders})`,
      ...params
    )) as { district: string; sourceId: string }[];
    for (const r of rows) matched.add(`${r.district} ${r.sourceId}`);
  }
  let conflicts = 0;
  for (const t of targets) {
    if (matched.has(`${t.district} ${t.sourceId}`)) conflicts++;
  }
  return conflicts;
}

/**
 * I-2(b) apply 견고 경로: city-only UPDATE를 **per-row try/catch**로 실행.
 * duplicate-key(ER_DUP_ENTRY/P2002) 충돌은 **skip+카운트+로그**하고 다음 행으로 계속(전체 abort 금지).
 * 그래서 WasteSchedule 충돌이 있어도 processTable가 정상 반환 → main이 Region 정규화까지 도달한다.
 */
export async function applyCityOnlyWithConflictSkip(
  table: string,
  items: ReformPlanItem[]
): Promise<{ updated: number; skipped: number }> {
  assertKnownTable(table);
  let updated = 0;
  let skipped = 0;
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    try {
      const affected = await prisma.$executeRawUnsafe(
        `UPDATE \`${table}\` SET city = ? WHERE id = ?`,
        it.toCity,
        it.id
      );
      updated += Number(affected);
    } catch (err) {
      if (isDuplicateKeyError(err)) {
        skipped++;
        console.warn(`   [${table}] dup-key skip id=${it.id} → city='${it.toCity}' (이미 JNGJ 행 존재)`);
      } else {
        throw err;
      }
    }
    if ((i + 1) % ROW_UPDATE_CHUNK === 0) {
      console.info(`   [${table}] city-only update ${i + 1}/${items.length} (skip ${skipped})`);
      await sleep(BATCH_SLEEP_MS);
    }
  }
  console.info(`   [${table}] city-only 완료 update=${updated} conflict-skip=${skipped}`);
  return { updated, skipped };
}

export interface TableResult {
  table: string;
  candidates: number;
  planned: number;
  unchanged: number;
  excludedNonTarget: number;
  skippedDistrictUnmatched: number;
  /** 계획상 UPDATE 예정 건수(dry-run에서도 산출). */
  plannedUpdate: number;
  /** 계획상 dedup-DELETE 예정 건수(I-1 — dry-run에서도 산출). */
  plannedDedupDelete: number;
  /** I-2(a) city-only 리네임 시 (JNGJ,district,sourceId) 기존행 충돌 예정 수(dry-run pre-check). */
  cityConflictExisting: number;
  /** M-1 dedup 무력화 위험(bjdChanged인데 srcChanged 아님) 건수. 0이 정상. */
  dedupDefeatWarn: number;
  updated: number;
  deletedDedup: number;
  /** I-2(b) apply 시 duplicate-key로 실제 스킵된 city-only 건수. */
  cityConflictSkipped: number;
}

export async function processTable(table: string, apply: boolean): Promise<TableResult> {
  const isCityOnly = CITY_ONLY_TABLES.includes(table);
  const hasBjd = !isCityOnly;
  const candidates = await selectCandidates(table, hasBjd);
  const rows: ReformRow[] = candidates.map((r) => ({ ...r, table }));
  const plan = computeNormalizationPlan(rows, REGION12_LOOKUP);

  console.info(
    `\n[${table}] 후보 ${candidates.length} | 계획 ${plan.planned.length} | 멱등 ${plan.unchanged} | ` +
      `non-target ${plan.excludedNonTarget} | district미매칭(skip) ${plan.skippedDistrictUnmatched.length}`
  );
  for (const s of plan.skippedDistrictUnmatched.slice(0, 10)) {
    console.warn(`   [skip] id=${s.id} city=${s.city} district=${s.district} bjd=${s.bjdCode}`);
  }

  const result: TableResult = {
    table,
    candidates: candidates.length,
    planned: plan.planned.length,
    unchanged: plan.unchanged,
    excludedNonTarget: plan.excludedNonTarget,
    skippedDistrictUnmatched: plan.skippedDistrictUnmatched.length,
    plannedUpdate: 0,
    plannedDedupDelete: 0,
    cityConflictExisting: 0,
    dedupDefeatWarn: 0,
    updated: 0,
    deletedDedup: 0,
    cityConflictSkipped: 0,
  };

  // ────────────────────────────────────────────────────────────────────────
  // 계획 세분화 — dry-run에서도 산출한다(SELECT는 read-only라 안전). 실제 mutation만 apply로 가드.
  // ────────────────────────────────────────────────────────────────────────

  // I-1: sourceId 재코딩 대상은 충돌 조회(SELECT)로 update vs dedup-DELETE를 미리 분할.
  let srcToUpdate: ReformPlanItem[] = [];
  let srcToDeleteIds: (number | string)[] = [];
  let cityBjdOnly: ReformPlanItem[] = [];
  if (SOURCEID_BJD_TABLES.has(table)) {
    const srcItems = plan.planned.filter((p) => p.toSourceId);
    cityBjdOnly = plan.planned.filter((p) => !p.toSourceId); // bjd 미변경(예: 이미 12)이거나 city만
    const existing = await findExistingSourceIds(table, srcItems.map((p) => p.toSourceId as string));
    ({ toUpdate: srcToUpdate, toDeleteIds: srcToDeleteIds } = splitDedup(srcItems, existing));
    result.plannedUpdate = srcToUpdate.length + cityBjdOnly.length;
    result.plannedDedupDelete = srcToDeleteIds.length;
    console.info(
      `   [${table}] sourceId 재코딩 update=${srcToUpdate.length} dedup-delete=${srcToDeleteIds.length} ` +
        `city-only=${cityBjdOnly.length}${apply ? '' : ' (dry-run 미리보기)'}`
    );

    // M-1: dedup 무력화 사전경고(bjdChanged인데 srcChanged 아님 — 0이 정상).
    result.dedupDefeatWarn = countDedupDefeatRisk(table, plan.planned);
    if (result.dedupDefeatWarn > 0) {
      console.warn(
        `   [${table}] ⚠️ M-1: bjdChanged인데 sourceId 미재코딩 ${result.dedupDefeatWarn}건 — ` +
          `다음 sync가 신 bjd로 sourceId 재생성 시 중복 생성 위험(옛 bjd 토큰 부재로 reencode 무효).`
      );
    }
  } else {
    result.plannedUpdate = plan.planned.length;
  }

  // I-2(a): city-only 리네임 충돌 pre-check(dry-run 포함) — unique에 city 포함(WasteSchedule 등).
  if (isCityOnly && plan.planned.length > 0) {
    const candById = new Map(candidates.map((c) => [String(c.id), c]));
    const targets = plan.planned
      .map((p) => candById.get(String(p.id)))
      .filter((c): c is RawRow => !!c && c.sourceId != null)
      .map((c) => ({ district: c.district, sourceId: c.sourceId as string }));
    result.cityConflictExisting = await countCityRenameConflicts(table, targets);
    if (result.cityConflictExisting > 0) {
      console.warn(
        `   [${table}] ⚠️ I-2: city 리네임 후 (${JNGJ_CITY}, district, sourceId) 기존행과 충돌 예정 ` +
          `${result.cityConflictExisting}건 — apply 시 스킵됩니다.`
      );
    }
  }

  // ── 여기부터 실제 mutation(apply 전용) — SELECT 기반 계획/경고는 위에서 이미 완료 ──
  if (!apply || plan.planned.length === 0) return result;

  // 백업 — 계획된 행의 원본만 (충돌·삭제 포함 전부 보존)
  const plannedIdSet = new Set(plan.planned.map((p) => String(p.id)));
  await backupRows(table, candidates.filter((c) => plannedIdSet.has(String(c.id))));

  if (SOURCEID_BJD_TABLES.has(table)) {
    // sourceId 재코딩 대상: 위에서 계산한 dedup(delete) / update 분기를 그대로 실행.
    result.deletedDedup += await applyDeletes(table, srcToDeleteIds);
    result.updated += await applyRowUpdatesWithSourceId(table, srcToUpdate);
    if (cityBjdOnly.length > 0) result.updated += await applyGroupedUpdate(table, cityBjdOnly);
  } else if (isCityOnly) {
    // I-2(b): city-only는 per-row conflict-skip 경로로 실행(duplicate-key skip+continue).
    const r = await applyCityOnlyWithConflictSkip(table, plan.planned);
    result.updated += r.updated;
    result.cityConflictSkipped += r.skipped;
  } else {
    // 시설 / Auction : city[+bjdCode] 그룹 IN 업데이트
    result.updated += await applyGroupedUpdate(table, plan.planned);
  }

  return result;
}

/**
 * Region 특수 처리. @@unique([bjdCode]) / ([city,district]) / ([city,slug]) 충돌 방지 순서:
 *   (0) U2 폴백맵 캡처(삭제 전) → (1) 옛 29/46 삭제 → (2) 중복 0 assert → (3) 신 12xxx city 보정.
 */
async function processRegion(apply: boolean, forceRegion: boolean): Promise<{ oldCount: number; newCount: number; deleted: number; corrected: number }> {
  const oldRows = (await prisma.$queryRawUnsafe(
    `SELECT id, bjdCode, city, district, slug FROM \`Region\` WHERE bjdCode LIKE '29%' OR bjdCode LIKE '46%'`
  )) as { id: number; bjdCode: string; city: string; district: string; slug: string }[];

  const newRows = (await prisma.$queryRawUnsafe(
    `SELECT id, bjdCode, city, district, slug FROM \`Region\` WHERE bjdCode LIKE '12%'`
  )) as { id: number; bjdCode: string; city: string; district: string; slug: string }[];

  console.info(`\n[Region] 옛 29/46 행 ${oldRows.length} | 신 12xxx 행 ${newRows.length}`);

  // (0) U2 레거시 폴백맵: oldBjd → districtName (삭제 전 캡처, Phase C detail 역조회용)
  const u2: Record<string, string> = {};
  for (const r of oldRows) u2[r.bjdCode] = r.district;
  const u2File = join(backupDir(), 'u2-oldbjd-to-district.json');
  fs.writeFileSync(u2File, JSON.stringify(u2, null, 2));
  console.info(`   [Region] U2 폴백맵 ${Object.keys(u2).length}쌍 → ${u2File}`);

  const summary = { oldCount: oldRows.length, newCount: newRows.length, deleted: 0, corrected: 0 };
  if (!apply) {
    console.info('   [Region] dry-run — 삭제/보정 미실행');
    return summary;
  }

  // 신 12xxx 행이 없으면 옛 행 삭제는 데이터 소실 → 기본 중단(운영은 syncRegion 선행).
  if (newRows.length < 27 && !forceRegion) {
    console.warn(
      `   [Region] ⚠️ 신 12xxx Region 행이 ${newRows.length}개(<27)라 삭제를 건너뜁니다. ` +
        `먼저 syncRegion으로 신 지역을 적재한 뒤 재실행하거나 --force-region 을 사용하세요.`
    );
    return summary;
  }

  // 백업(삭제 대상)
  await backupRows('Region', oldRows.map((r) => ({ id: r.id, city: r.city, district: r.district, bjdCode: r.bjdCode, sourceId: r.slug })));

  // (1) 옛 29/46 삭제 (Region은 소형 테이블이라 LIKE 스캔 무해)
  const del = await prisma.$executeRawUnsafe(`DELETE FROM \`Region\` WHERE bjdCode LIKE '29%' OR bjdCode LIKE '46%'`);
  summary.deleted = Number(del);
  console.info(`   [Region] 옛 행 삭제: ${summary.deleted}`);

  // (2) 중복 0 assert
  const dupCD = (await prisma.$queryRawUnsafe(
    `SELECT city, district, COUNT(*) c FROM \`Region\` GROUP BY city, district HAVING c > 1`
  )) as unknown[];
  const dupCS = (await prisma.$queryRawUnsafe(
    `SELECT city, slug, COUNT(*) c FROM \`Region\` GROUP BY city, slug HAVING c > 1`
  )) as unknown[];
  if (dupCD.length > 0 || dupCS.length > 0) {
    throw new Error(`[Region] 삭제 후 중복 발견 (city,district=${dupCD.length}, city,slug=${dupCS.length}) — @@unique 충돌 위험, 중단`);
  }

  // (3) 신 12xxx 행 city 보정
  const corr = await prisma.$executeRawUnsafe(
    `UPDATE \`Region\` SET city = ? WHERE bjdCode LIKE '12%' AND city <> ?`,
    JNGJ_CITY,
    JNGJ_CITY
  );
  summary.corrected = Number(corr);
  console.info(`   [Region] 신 12xxx city 보정: ${summary.corrected}`);
  return summary;
}

// ============================================================================
// main
// ============================================================================

function parseArgs(argv: string[]): { apply: boolean; forceRegion: boolean; only: string[] | null } {
  const apply = argv.includes('--apply');
  const forceRegion = argv.includes('--force-region');
  const onlyArg = argv.find((a) => a.startsWith('--only='));
  const only = onlyArg ? onlyArg.slice('--only='.length).split(',').map((s) => s.trim()).filter(Boolean) : null;
  return { apply, forceRegion, only };
}

async function main(): Promise<void> {
  const { apply, forceRegion, only } = parseArgs(process.argv.slice(2));

  // 시작 시 27쌍 완비 assert (S4)
  assertRegion12Lookup();

  console.info('====================================================');
  console.info(`adoptRegionReform — mode=${apply ? 'APPLY' : 'DRY-RUN'}${forceRegion ? ' (force-region)' : ''}`);
  console.info(`대상 city 접두: ${CITY_LIKE_PREFIXES.join('/')} | 목표 city='${JNGJ_CITY}' bjd 접두 12`);
  console.info(`백업 디렉터리: ${backupDir()}`);
  if (only) console.info(`--only: ${only.join(', ')}`);
  console.info('====================================================');

  if (apply) {
    // 짧은 락 대기(장시간 락 방지). max_execution_time은 UPDATE에 무효라 사용하지 않음.
    await prisma.$executeRawUnsafe(`SET SESSION innodb_lock_wait_timeout = ${LOCK_WAIT_TIMEOUT}`);
  }

  const results: TableResult[] = [];
  const targetTables = only ? ALL_MUTATION_TABLES.filter((t) => only.includes(t)) : ALL_MUTATION_TABLES;
  for (const table of targetTables) {
    try {
      results.push(await processTable(table, apply));
    } catch (err) {
      console.error(`[${table}] 처리 실패:`, err);
      throw err;
    }
  }

  // Region — 별도 처리 (only 지정 시 'Region' 포함 여부로 결정, 미지정 시 항상)
  let regionSummary: Awaited<ReturnType<typeof processRegion>> | null = null;
  if (!only || only.includes('Region')) {
    regionSummary = await processRegion(apply, forceRegion);
  }

  // 요약
  console.info('\n=================== 요약 ===================');
  let totalPlanned = 0, totalUpdated = 0, totalDeleted = 0, totalSkipped = 0;
  let totalPlannedUpdate = 0, totalPlannedDedup = 0, totalCityConflict = 0, totalCitySkipped = 0, totalDedupWarn = 0;
  for (const r of results) {
    totalPlanned += r.planned;
    totalUpdated += r.updated;
    totalDeleted += r.deletedDedup;
    totalSkipped += r.skippedDistrictUnmatched;
    totalPlannedUpdate += r.plannedUpdate;
    totalPlannedDedup += r.plannedDedupDelete;
    totalCityConflict += r.cityConflictExisting;
    totalCitySkipped += r.cityConflictSkipped;
    totalDedupWarn += r.dedupDefeatWarn;
    // I-1: dry-run에서도 UPDATE/ dedup-DELETE 예정 건수를 표기(가장 위험한 DELETE 규모를 apply 전에 노출).
    console.info(
      `  ${r.table.padEnd(24)} 계획 ${String(r.planned).padStart(7)} | ` +
        `update예정 ${String(r.plannedUpdate).padStart(7)} | dedup삭제예정 ${String(r.plannedDedupDelete).padStart(6)} | ` +
        (apply
          ? `적용 ${String(r.updated).padStart(7)} | dedup삭제 ${String(r.deletedDedup).padStart(6)} | city충돌skip ${r.cityConflictSkipped} | `
          : '') +
        `skip ${r.skippedDistrictUnmatched}` +
        (r.cityConflictExisting > 0 ? ` | ⚠️city충돌예정 ${r.cityConflictExisting}` : '') +
        (r.dedupDefeatWarn > 0 ? ` | ⚠️M-1 ${r.dedupDefeatWarn}` : '')
    );
  }
  if (regionSummary) {
    console.info(
      `  ${'Region'.padEnd(24)} 옛 ${regionSummary.oldCount} → 삭제 ${regionSummary.deleted} | 신 12xxx ${regionSummary.newCount} → city보정 ${regionSummary.corrected}`
    );
  }
  console.info('--------------------------------------------');
  console.info(
    `  합계  계획 ${totalPlanned} | update예정 ${totalPlannedUpdate} | dedup삭제예정 ${totalPlannedDedup} | ` +
      `적용 ${totalUpdated} | dedup삭제 ${totalDeleted} | district미매칭 skip ${totalSkipped}`
  );
  if (totalCityConflict > 0) {
    console.warn(`  ⚠️ I-2 city 리네임 충돌 예정(apply 시 스킵) 합계: ${totalCityConflict}건 (WasteSchedule 등 unique에 city 포함)`);
  }
  if (apply && totalCitySkipped > 0) {
    console.warn(`  ⚠️ I-2 city 리네임 duplicate-key로 실제 스킵된 합계: ${totalCitySkipped}건`);
  }
  if (totalDedupWarn > 0) {
    console.warn(`  ⚠️ M-1 dedup 무력화 위험(bjdChanged & sourceId 미재코딩) 합계: ${totalDedupWarn}건 (0이 정상)`);
  }
  if (!apply) {
    console.info('\n  DRY-RUN — DB 미변경. 실제 적용하려면 --apply 를 사용하세요.');
  }
  console.info('============================================\n');
}

// 직접 실행 시에만 main() 구동(테스트 import 시 부작용 방지).
const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === resolve(__filename)) {
  main()
    .then(() => prisma.$disconnect())
    .catch((error) => {
      console.error('Fatal error:', error);
      prisma.$disconnect().finally(() => process.exit(1));
    });
}
