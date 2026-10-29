// 건축HUB 건축물대장 대용량 파일 동기화 (스펙 docs/superpowers/specs/2026-10-29-building-register-design.md).
//
// 매일 목록만 확인하고, 대상 월이 바뀐 파일만 받는다: 총괄표제부(0302)·표제부(0303)는 매월,
// 전유공용면적(0306, 3GB)은 3개월마다. zip 은 디스크에 받아 줄 단위로 흘려 읽고(메모리 상한 512MB),
// 처리 뒤 항상 지운다. 새 월로 다 쓴 뒤 성공했을 때만 이전 월 행을 시군구별로 지운다 —
// 중간에 실패하면 이전 월 값이 그대로 남아 상세는 계속 나온다.

import { mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { readZipLines } from '../lib/zipLineReader.js';
import { batchUpsertRaw, runSync, type SyncStats } from './baseSyncService.js';
import {
  downloadHubFile,
  findHubFile,
  openHubSession,
  type HubSession,
  type HubTaskCode,
} from './hubFileSource.js';
import {
  RECAP_COLUMNS,
  TITLE_COLUMNS,
  UNIT_COLUMNS,
  dongNamesFromPlatPlc,
  parcelKeyString,
  parseRecapRow,
  parseTitleRow,
  parseUnitRow,
  shouldKeepTitle,
  splitRow,
} from './buildingRegisterParser.js';
import { OffitelUnitCounter } from './buildingRegisterUnitCounter.js';

const BATCH_SIZE = 500;
/** 열 수가 맞지 않아 건너뛴 줄이 이 비율을 넘으면 형식이 바뀐 것으로 보고 실패시킨다. */
const MAX_SKIPPED_RATIO = 0.01;
/** 전유공용면적은 이 개월 수마다 받는다 (사용자 결정 2026-10-29). */
const UNIT_REFRESH_MONTHS = 3;

const TABLE: Record<HubTaskCode, string> = {
  '0302': 'BuildingRegisterRecap',
  '0303': 'BuildingRegisterTitle',
  '0306': 'BuildingRegisterUnitCount',
};

export interface BuildingRegisterSyncOptions {
  /** 대상 월이 같아도 총괄·표제부를 다시 받는다 */
  force?: boolean;
  /** 3개월이 안 됐어도 전유공용면적을 다시 받는다 */
  forceUnits?: boolean;
  workDir?: string;
  fetchFn?: typeof fetch;
}

export interface DatasetResult {
  taskCode: HubTaskCode;
  status: 'updated' | 'unchanged' | 'not-due';
  sourceMonth: string | null;
  rows: number;
  skipped: number;
}

/** 'YYYY-MM' a − b (개월) */
export function monthDiff(a: string, b: string): number {
  const index = (m: string): number => Number(m.slice(0, 4)) * 12 + Number(m.slice(5, 7));
  return index(a) - index(b);
}

interface LoadCounts {
  rows: number;
  skipped: number;
  lines: number;
}

function checkSkipped(taskCode: HubTaskCode, counts: LoadCounts): void {
  if (counts.lines === 0) throw new Error(`건축HUB ${taskCode} 파일에 행이 없다`);
  if (counts.skipped / counts.lines > MAX_SKIPPED_RATIO) {
    throw new Error(
      `건축HUB ${taskCode} 건너뛴 줄 ${counts.skipped}/${counts.lines} — 열 구성이 바뀌었을 수 있다(교체하지 않음)`,
    );
  }
}

/** 같은 배치 안에서 같은 키는 뒤 행으로 덮어쓰고, 배치가 차면 저장한다. */
class BatchWriter<T extends Record<string, unknown>> {
  private buffer = new Map<string, T>();
  stored = 0;

  constructor(private readonly table: string, private readonly keyOf: (row: T) => string, private readonly stats: SyncStats) {}

  async add(row: T): Promise<void> {
    this.buffer.set(this.keyOf(row), row);
    if (this.buffer.size >= BATCH_SIZE) await this.flush();
  }

  async flush(): Promise<void> {
    if (this.buffer.size === 0) return;
    const rows = [...this.buffer.values()];
    this.buffer = new Map();
    const { newCount, updateCount } = await batchUpsertRaw(this.table, rows, BATCH_SIZE);
    this.stored += rows.length;
    this.stats.newRecords += newCount;
    this.stats.updatedRecords += updateCount;
  }
}

async function loadRecap(zipPath: string, sourceMonth: string, stats: SyncStats): Promise<LoadCounts> {
  const writer = new BatchWriter<Record<string, unknown>>(TABLE['0302'], (r) => String(r.mgmPk), stats);
  const counts: LoadCounts = { rows: 0, skipped: 0, lines: 0 };
  for await (const line of readZipLines(zipPath)) {
    counts.lines++;
    const cols = splitRow(line, RECAP_COLUMNS.length);
    if (!cols) { counts.skipped++; continue; }
    const row = parseRecapRow(cols, sourceMonth);
    await writer.add({ ...row, raw: JSON.stringify(row.raw) });
  }
  await writer.flush();
  counts.rows = writer.stored;
  return counts;
}

async function loadTitles(zipPath: string, sourceMonth: string, stats: SyncStats): Promise<LoadCounts> {
  const writer = new BatchWriter<Record<string, unknown>>(TABLE['0303'], (r) => String(r.mgmPk), stats);
  const dongs = new Map<string, { sggCode: string; bjdongCode: string; dongName: string }>();
  const counts: LoadCounts = { rows: 0, skipped: 0, lines: 0 };
  for await (const line of readZipLines(zipPath)) {
    counts.lines++;
    const cols = splitRow(line, TITLE_COLUMNS.length);
    if (!cols) { counts.skipped++; continue; }
    const row = parseTitleRow(cols, sourceMonth);
    if (!shouldKeepTitle(row)) continue;
    await writer.add({ ...row, raw: JSON.stringify(row.raw) });
    for (const dongName of dongNamesFromPlatPlc(row.raw['대지_위치'] ?? '')) {
      if (!row.sggCode || !row.bjdongCode || dongName.length > 50) continue;
      dongs.set(`${row.sggCode}|${row.bjdongCode}|${dongName}`, { sggCode: row.sggCode, bjdongCode: row.bjdongCode, dongName });
    }
  }
  await writer.flush();
  counts.rows = writer.stored;
  checkSkipped('0303', counts);
  await batchUpsertRaw('BuildingRegisterDong', [...dongs.values()], BATCH_SIZE);
  return counts;
}

/** 표제부에서 오피스텔이 있는 지번 — 시군구 단위로 읽는다(전국 일괄 조회 금지). */
async function offitelTargets(): Promise<Set<string>> {
  const targets = new Set<string>();
  const sggs = await prisma.$queryRaw<Array<{ sggCode: string }>>(
    Prisma.sql`SELECT DISTINCT sggCode FROM BuildingRegisterTitle`,
  );
  for (const { sggCode } of sggs) {
    const rows = await prisma.$queryRaw<Array<{ sggCode: string; bjdongCode: string; platGbCd: string; bun: string; ji: string }>>(
      Prisma.sql`SELECT DISTINCT sggCode, bjdongCode, platGbCd, bun, ji FROM BuildingRegisterTitle
        WHERE sggCode = ${sggCode} AND (mainPurpsCdNm LIKE '%오피스텔%' OR etcPurps LIKE '%오피스텔%')`,
    );
    for (const row of rows) targets.add(parcelKeyString(row));
  }
  return targets;
}

async function loadUnits(zipPath: string, sourceMonth: string, stats: SyncStats): Promise<LoadCounts> {
  const targets = await offitelTargets();
  console.info(`[building-register] 오피스텔 대상 지번 ${targets.size.toLocaleString()}곳`);
  const counter = new OffitelUnitCounter(targets);
  const counts: LoadCounts = { rows: 0, skipped: 0, lines: 0 };
  for await (const line of readZipLines(zipPath)) {
    counts.lines++;
    const cols = splitRow(line, UNIT_COLUMNS.length);
    if (!cols) { counts.skipped++; continue; }
    counter.add(parseUnitRow(cols));
  }
  checkSkipped('0306', counts);
  const rows = counter.results(sourceMonth);
  const { newCount, updateCount } = await batchUpsertRaw(TABLE['0306'], rows as unknown as Record<string, unknown>[], BATCH_SIZE);
  stats.newRecords += newCount;
  stats.updatedRecords += updateCount;
  counts.rows = rows.length;
  return counts;
}

/** 새 월로 다 쓴 뒤에만 부른다. 시군구마다 나눠 지운다(넓은 단일 DELETE 금지). */
async function deleteOtherMonths(table: string, sourceMonth: string): Promise<void> {
  const name = Prisma.raw(table);
  const sggs = await prisma.$queryRaw<Array<{ sggCode: string }>>(Prisma.sql`SELECT DISTINCT sggCode FROM ${name}`);
  for (const { sggCode } of sggs) {
    await prisma.$executeRaw(Prisma.sql`DELETE FROM ${name} WHERE sggCode = ${sggCode} AND sourceMonth <> ${sourceMonth}`);
  }
}

async function syncDataset(
  session: HubSession,
  taskCode: HubTaskCode,
  options: BuildingRegisterSyncOptions,
  workDir: string,
  stats: SyncStats,
): Promise<DatasetResult> {
  const entry = findHubFile(session.entries, taskCode);
  if (!entry) throw new Error(`건축HUB 목록에서 ${taskCode} 파일을 찾지 못했다 — 목록 구조 변경 확인 필요`);
  const saved = await prisma.buildingRegisterSourceFile.findUnique({ where: { taskCode } });

  if (taskCode === '0306') {
    const due = options.forceUnits || !saved || monthDiff(entry.sourceMonth, saved.sourceMonth) >= UNIT_REFRESH_MONTHS;
    if (!due) return { taskCode, status: 'not-due', sourceMonth: saved?.sourceMonth ?? null, rows: 0, skipped: 0 };
  } else if (!options.force && saved?.sourceMonth === entry.sourceMonth) {
    return { taskCode, status: 'unchanged', sourceMonth: entry.sourceMonth, rows: 0, skipped: 0 };
  }

  const zipPath = join(workDir, `${taskCode}.zip`);
  try {
    const { bytes } = await downloadHubFile(session, entry, zipPath, options.fetchFn);
    console.info(`[building-register] ${taskCode} ${entry.title} 받음 ${(bytes / 1048576).toFixed(0)}MB`);
    const load = taskCode === '0302' ? loadRecap : taskCode === '0303' ? loadTitles : loadUnits;
    const counts = await load(zipPath, entry.sourceMonth, stats);
    checkSkipped(taskCode, counts);
    await deleteOtherMonths(TABLE[taskCode], entry.sourceMonth);

    stats.totalRecords += counts.rows;
    stats.skippedRecords += counts.skipped;
    const record = { sourceMonth: entry.sourceMonth, fileId: entry.fileId, rowCount: counts.rows, skippedCount: counts.skipped };
    await prisma.buildingRegisterSourceFile.upsert({ where: { taskCode }, create: { taskCode, ...record }, update: record });
    return { taskCode, status: 'updated', sourceMonth: entry.sourceMonth, rows: counts.rows, skipped: counts.skipped };
  } finally {
    rmSync(zipPath, { force: true });
  }
}

export async function syncBuildingRegister(
  options: BuildingRegisterSyncOptions = {},
): Promise<{ results: DatasetResult[]; maxRssMb: number }> {
  const workDir = options.workDir ?? join(tmpdir(), 'building-register');
  mkdirSync(workDir, { recursive: true });
  const results: DatasetResult[] = [];
  // 새 파일이 없는 날이 정상이라 0건을 실패로 보지 않는다. 형식 이상은 건너뛴 줄 비율로 fail-closed.
  await runSync('building-register', async (stats) => {
    const session = await openHubSession(options.fetchFn);
    // 오피스텔 대상 지번을 표제부에서 고르므로 0306 은 0303 다음.
    for (const taskCode of ['0302', '0303', '0306'] as const) {
      results.push(await syncDataset(session, taskCode, options, workDir, stats));
    }
  }, { allowEmpty: true });
  return { results, maxRssMb: Math.round(process.resourceUsage().maxRSS / 1024) };
}
