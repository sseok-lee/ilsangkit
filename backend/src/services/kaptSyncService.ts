// K-apt 주간 파일 → KaptComplex / KaptComplexArea / KaptComplexParcel 반영, 이어서 관리비(kaptFeeSync.ts).
//
// 매일 돌려도 된다: 자료실 최신 글의 기준일이 KaptSourceFile 에 기록된 것과 같으면 받지 않는다.
// 데이터셋(기본정보·면적·필지)은 서로 독립이라 새로 올라온 것만 반영한다.
//
// 사라진 행 처리 — 이번 실행에서 확인한 행은 syncedAt 이 실행 시작 시각 이상이 된다
// (신규는 그 값으로 INSERT, 기존은 ON DUPLICATE 에서 NOW()). 그보다 오래된 행은 이번 파일에 없던 것:
//   단지는 지우지 않고 active=false, 면적·필지는 삭제한다.
// 실행 시작 시각은 DB 의 NOW()(초 단위)로 잡는다. 앱 시계나 밀리초 값을 쓰면 같은 초에 갱신된 행이
// "오래됨"으로 잘못 분류될 수 있다.

import { prisma } from '../lib/prisma.js';
import { batchUpsertRaw, runSync, type SyncStats } from './baseSyncService.js';
import {
  openKaptSession,
  fetchLatestKaptPost,
  downloadKaptFile,
  type KaptDataset,
  type KaptPost,
  type KaptSession,
} from './kaptFileSource.js';
import { parseKaptBasicXlsx, parseKaptAreaXlsx, parseKaptParcelXlsx } from './kaptFileParsers.js';
import { syncKaptFees, type KaptFeeDataset } from './kaptFeeSync.js';
import { hasFeeSggMedians, refreshFeeSggMedians } from './kaptFeeStats.js';

/** 절단·빈 파일 방어 하한 (2026-10-26 실측: 단지 21,751 · 필지 21,751 · 면적 91,586행) */
export const KAPT_MIN_ROWS: Record<KaptDataset, number> = {
  basic: 18_000,
  parcel: 18_000,
  area: 70_000,
};

const ORDER: KaptDataset[] = ['basic', 'area', 'parcel'];
const UPDATE_BATCH = 500;

export interface KaptSyncOptions {
  /** 기준일이 같아도 다시 받는다 */
  force?: boolean;
  fetchFn?: typeof fetch;
}

export interface KaptDatasetResult {
  dataset: KaptDataset | KaptFeeDataset;
  status: 'updated' | 'unchanged';
  fileDate: string;
  rows: number;
}

async function dbNow(): Promise<Date> {
  const rows = await prisma.$queryRaw<Array<{ now: Date }>>`SELECT NOW() AS now`;
  return rows[0].now;
}

function toDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

async function applyBasic(buffer: Buffer, runStart: Date, stats: SyncStats): Promise<number> {
  const { items } = await parseKaptBasicXlsx(buffer);
  if (items.length < KAPT_MIN_ROWS.basic) {
    throw new Error(`K-apt 기본정보 행 수 부족(${items.length} < ${KAPT_MIN_ROWS.basic}) — 반영하지 않음`);
  }
  const rows = items.map(({ raw, ...rest }) => ({
    ...rest,
    raw: JSON.stringify(raw),
    active: true,
    updatedAt: runStart,
    syncedAt: runStart,
  }));
  const { newCount, updateCount } = await batchUpsertRaw('KaptComplex', rows);
  const deactivated = await prisma.$executeRaw`
    UPDATE KaptComplex SET active = false WHERE active = true AND syncedAt < ${runStart}`;
  stats.totalRecords += items.length;
  stats.newRecords += newCount;
  stats.updatedRecords += updateCount;
  console.info(`[kapt] 기본정보 ${items.length.toLocaleString()}단지 (신규 ${newCount}, 갱신 ${updateCount}, 비활성 ${deactivated})`);
  return items.length;
}

async function applyArea(buffer: Buffer, runStart: Date, stats: SyncStats): Promise<number> {
  const { areas, complexes } = await parseKaptAreaXlsx(buffer);
  if (areas.length < KAPT_MIN_ROWS.area) {
    throw new Error(`K-apt 면적정보 행 수 부족(${areas.length} < ${KAPT_MIN_ROWS.area}) — 반영하지 않음`);
  }
  const rows = areas.map((a) => ({ ...a, updatedAt: runStart, syncedAt: runStart }));
  const { newCount, updateCount } = await batchUpsertRaw('KaptComplexArea', rows);
  const removed = await prisma.$executeRaw`DELETE FROM KaptComplexArea WHERE syncedAt < ${runStart}`;

  // 단지별 면적 합계는 KaptComplex 컬럼에 둔다. 기본정보에 없는 단지는 건너뛴다(UPDATE JOIN).
  const totals = [...complexes.entries()];
  for (let i = 0; i < totals.length; i += UPDATE_BATCH) {
    const batch = totals.slice(i, i + UPDATE_BATCH);
    const selects = batch.map(() => 'SELECT ? AS kaptCode, ? AS m, ? AS e').join(' UNION ALL ');
    const params = batch.flatMap(([code, t]) => [code, t.managementArea, t.exclusiveAreaTotal]);
    await prisma.$executeRawUnsafe(
      `UPDATE KaptComplex k JOIN (${selects}) v ON v.kaptCode = k.kaptCode
       SET k.managementArea = v.m, k.exclusiveAreaTotal = v.e`,
      ...params,
    );
  }
  stats.totalRecords += areas.length;
  stats.newRecords += newCount;
  stats.updatedRecords += updateCount;
  console.info(`[kapt] 면적정보 ${areas.length.toLocaleString()}행 (신규 ${newCount}, 갱신 ${updateCount}, 삭제 ${removed})`);
  return areas.length;
}

async function applyParcel(buffer: Buffer, runStart: Date, stats: SyncStats): Promise<number> {
  const { items, skipped } = await parseKaptParcelXlsx(buffer);
  if (items.length < KAPT_MIN_ROWS.parcel) {
    throw new Error(`K-apt 필지고유번호 행 수 부족(${items.length} < ${KAPT_MIN_ROWS.parcel}) — 반영하지 않음`);
  }
  const rows = items.map((p) => ({ ...p, updatedAt: runStart, syncedAt: runStart }));
  const { newCount, updateCount } = await batchUpsertRaw('KaptComplexParcel', rows);
  const removed = await prisma.$executeRaw`DELETE FROM KaptComplexParcel WHERE syncedAt < ${runStart}`;
  stats.totalRecords += items.length;
  stats.newRecords += newCount;
  stats.updatedRecords += updateCount;
  stats.skippedRecords += skipped;
  console.info(`[kapt] 필지고유번호 ${items.length.toLocaleString()}행 (신규 ${newCount}, 갱신 ${updateCount}, 삭제 ${removed}, 형식오류 ${skipped})`);
  return items.length;
}

const APPLY: Record<KaptDataset, (buffer: Buffer, runStart: Date, stats: SyncStats) => Promise<number>> = {
  basic: applyBasic,
  area: applyArea,
  parcel: applyParcel,
};

async function syncDataset(
  session: KaptSession,
  dataset: KaptDataset,
  options: KaptSyncOptions,
  stats: SyncStats,
): Promise<KaptDatasetResult> {
  const post: KaptPost | null = await fetchLatestKaptPost(session, dataset, options.fetchFn);
  if (!post?.fileDate) {
    throw new Error(`K-apt 자료실에서 ${dataset} 최신 글을 찾지 못했다 — 목록 구조 변경 확인 필요`);
  }
  const previous = await prisma.kaptSourceFile.findUnique({ where: { dataset } });
  if (!options.force && previous && toDateOnly(previous.fileDate) >= post.fileDate) {
    console.info(`[kapt] ${dataset} 변경 없음 (기준일 ${post.fileDate})`);
    return { dataset, status: 'unchanged', fileDate: post.fileDate, rows: previous.rowCount };
  }

  const file = await downloadKaptFile(session, post.postSeq, options.fetchFn);
  const runStart = await dbNow();
  const rows = await APPLY[dataset](file.buffer, runStart, stats);

  const record = { fileDate: new Date(`${post.fileDate}T00:00:00Z`), postSeq: post.postSeq, fileName: file.fileName, rowCount: rows };
  await prisma.kaptSourceFile.upsert({ where: { dataset }, create: { dataset, ...record }, update: record });
  return { dataset, status: 'updated', fileDate: post.fileDate, rows };
}

export async function syncKaptFiles(options: KaptSyncOptions = {}): Promise<KaptDatasetResult[]> {
  const results: KaptDatasetResult[] = [];
  // 새 파일이 없는 날이 정상이라 0건을 실패로 보지 않는다. 대신 각 단계가 행 수 하한·헤더로 fail-closed.
  await runSync('kapt', async (stats) => {
    const session = await openKaptSession(options.fetchFn);
    for (const dataset of ORDER) {
      results.push(await syncDataset(session, dataset, options, stats));
    }
    results.push(...await syncKaptFees(session, options, stats));

    // 세대수·관리비부과면적(기본정보·면적)이나 관리비가 바뀌면 시군구 ㎡당 공용관리비 중간값을 다시 계산한다.
    const affected = results.some((r) => r.status === 'updated' && r.dataset !== 'parcel');
    if (affected || !(await hasFeeSggMedians())) {
      const { baseMonth, sggCount } = await refreshFeeSggMedians();
      console.info(`[kapt] 시군구 관리비 중간값 기준월 ${baseMonth ?? '-'} · 시군구 ${sggCount}곳`);
    }
  }, { allowEmpty: true });
  return results;
}
