// K-apt 관리비 파일 2개 → KaptMaintenanceFee (단지 × 월).
//
// - fee: 올해 주간 파일 "관리비정보(2026.10.26.)". 기준일이 저장된 것보다 새로우면 받는다.
// - fee-prev: 전년도 파일 "관리비정보(2025년)". 매주 정정본이 다시 올라온다(파일명 날짜 접두가 바뀐다).
//   69MB 를 매일 받지 않도록 주간 기준일이 바뀐 실행에서만 받고, 파일명이 같으면 반영하지 않는다.
//   KaptSourceFile.fileDate 에는 그 실행의 주간 기준일을 적는다.
// 단지코드+발생년월로 upsert 만 한다. 두 파일이 서로의 달을 덮지 않으므로 지우는 규칙은 두지 않는다.
// 파일이 커서 스트리밍으로 읽고 배치마다 바로 넣는다. 행 수 하한은 다 읽은 뒤 확인하므로 하한에 걸려도
// 이미 넣은 행은 남는다(정상 값의 upsert 라 해가 없다) — 출처를 기록하지 않아 다음 실행이 다시 받는다.

import { prisma } from '../lib/prisma.js';
import { batchUpsertRaw, type SyncStats } from './baseSyncService.js';
import { fetchKaptBoardPosts, findFeePosts, downloadKaptFile, type KaptPost, type KaptSession } from './kaptFileSource.js';
import { readKaptFeeXlsx } from './kaptFeeParser.js';
import type { KaptDatasetResult, KaptSyncOptions } from './kaptSyncService.js';

export type KaptFeeDataset = 'fee' | 'fee-prev';

const FEE_TAB = '03';
/** 올해 파일에 완결된 달 하나당 하한 (2026-08: 20,083단지) */
const FEE_MIN_ROWS_PER_MONTH = 15_000;
/** 전년도 파일 하한 (2025년 파일 255,019행) */
const FEE_PREV_MIN_ROWS = 200_000;

/**
 * 잘린 파일 방어 하한. 올해 파일은 기준일 월 − 2 개월이 완결돼 있다고 본다
 * (10월 26일 파일은 1~8월 완결 + 9월 일부). 1~2월에는 하한 0.
 */
export function minFeeRows(dataset: KaptFeeDataset, fileDate: string): number {
  if (dataset === 'fee-prev') return FEE_PREV_MIN_ROWS;
  return FEE_MIN_ROWS_PER_MONTH * Math.max(0, Number(fileDate.slice(5, 7)) - 2);
}

const LABEL: Record<KaptFeeDataset, string> = { fee: '관리비(올해)', 'fee-prev': '관리비(전년도)' };

async function dbNow(): Promise<Date> {
  const rows = await prisma.$queryRaw<Array<{ now: Date }>>`SELECT NOW() AS now`;
  return rows[0].now;
}

function toDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

async function applyFeeFile(dataset: KaptFeeDataset, buffer: Buffer, fileDate: string, stats: SyncStats): Promise<number> {
  const runStart = await dbNow();
  let rows = 0;
  let newCount = 0;
  let updateCount = 0;
  for await (const batch of readKaptFeeXlsx(buffer)) {
    const result = await batchUpsertRaw(
      'KaptMaintenanceFee',
      batch.map((item) => ({ ...item, updatedAt: runStart, syncedAt: runStart })),
    );
    rows += batch.length;
    newCount += result.newCount;
    updateCount += result.updateCount;
  }
  const min = minFeeRows(dataset, fileDate);
  if (rows < min) {
    throw new Error(`K-apt ${LABEL[dataset]} 행 수 부족(${rows} < ${min}) — 출처를 기록하지 않음`);
  }
  stats.totalRecords += rows;
  stats.newRecords += newCount;
  stats.updatedRecords += updateCount;
  console.info(`[kapt] ${LABEL[dataset]} ${rows.toLocaleString()}행 (신규 ${newCount}, 갱신 ${updateCount})`);
  return rows;
}

async function recordSource(dataset: KaptFeeDataset, fileDate: string, post: KaptPost, fileName: string, rowCount: number): Promise<void> {
  const record = { fileDate: new Date(`${fileDate}T00:00:00Z`), postSeq: post.postSeq, fileName, rowCount };
  await prisma.kaptSourceFile.upsert({ where: { dataset }, create: { dataset, ...record }, update: record });
}

async function syncFeeDataset(
  session: KaptSession,
  dataset: KaptFeeDataset,
  post: KaptPost | null,
  weeklyDate: string,
  options: KaptSyncOptions,
  stats: SyncStats,
): Promise<KaptDatasetResult> {
  const previous = await prisma.kaptSourceFile.findUnique({ where: { dataset } });
  const unchanged = (rows: number): KaptDatasetResult => ({ dataset, status: 'unchanged', fileDate: weeklyDate, rows });
  if (!post) {
    console.warn(`[kapt] ${LABEL[dataset]} 글이 없어 건너뜀`);
    return unchanged(previous?.rowCount ?? 0);
  }
  if (!options.force && previous && toDateOnly(previous.fileDate) >= weeklyDate) {
    console.info(`[kapt] ${LABEL[dataset]} 변경 없음 (기준일 ${weeklyDate})`);
    return unchanged(previous.rowCount);
  }

  const file = await downloadKaptFile(session, post.postSeq, options.fetchFn);
  if (dataset === 'fee-prev' && !options.force && previous?.fileName === file.fileName) {
    console.info(`[kapt] ${LABEL[dataset]} 파일 동일(${file.fileName}) — 반영 생략`);
    await recordSource(dataset, weeklyDate, post, file.fileName, previous.rowCount);
    return unchanged(previous.rowCount);
  }
  const rows = await applyFeeFile(dataset, file.buffer, weeklyDate, stats);
  await recordSource(dataset, weeklyDate, post, file.fileName, rows);
  return { dataset, status: 'updated', fileDate: weeklyDate, rows };
}

export async function syncKaptFees(
  session: KaptSession,
  options: KaptSyncOptions,
  stats: SyncStats,
): Promise<KaptDatasetResult[]> {
  const { current, previous } = findFeePosts(await fetchKaptBoardPosts(session, FEE_TAB, options.fetchFn));
  if (!current?.fileDate) {
    throw new Error('K-apt 자료실에서 관리비 최신 글을 찾지 못했다 — 목록 구조 변경 확인 필요');
  }
  return [
    await syncFeeDataset(session, 'fee', current, current.fileDate, options, stats),
    await syncFeeDataset(session, 'fee-prev', previous, current.fileDate, options, stats),
  ];
}
