// 동기화 서비스 공통 추상화
// toilet, parking, clothes 동기화 서비스의 중복 코드를 추출

import { prisma } from '../lib/prisma.js';
import type { SyncStatus, SyncHistory } from '@prisma/client';
import { SYNC } from '../constants/index.js';

export interface SyncStats {
  totalRecords: number;
  newRecords: number;
  updatedRecords: number;
  skippedRecords: number;
  errors: string[];
}

export interface SyncHistoryUpdateData {
  status?: SyncStatus;
  totalRecords?: number;
  newRecords?: number;
  updatedRecords?: number;
  errorMessage?: string;
}

/**
 * 동기화 히스토리 레코드 생성 (시작 시점)
 */
export async function createSyncHistory(category: string): Promise<SyncHistory> {
  return prisma.syncHistory.create({
    data: {
      category,
      status: 'running',
      totalRecords: 0,
      newRecords: 0,
      updatedRecords: 0,
    },
  });
}

/**
 * 동기화 히스토리 업데이트 (완료/실패 시점)
 */
export async function updateSyncHistory(
  id: number,
  data: SyncHistoryUpdateData
): Promise<SyncHistory> {
  return prisma.syncHistory.update({
    where: { id },
    data: {
      ...data,
      completedAt: new Date(),
    },
  });
}

/**
 * 새로운 SyncStats 객체 생성
 */
export function createSyncStats(): SyncStats {
  return {
    totalRecords: 0,
    newRecords: 0,
    updatedRecords: 0,
    skippedRecords: 0,
    errors: [],
  };
}

/**
 * 동기화 실행 래퍼 - 공통 히스토리 관리 패턴
 */
export async function runSync(
  category: string,
  syncFn: (stats: SyncStats) => Promise<void>
): Promise<SyncStats> {
  const stats = createSyncStats();
  const syncHistory = await createSyncHistory(category);

  try {
    console.info(`Starting ${category} data sync...`);
    await syncFn(stats);

    await updateSyncHistory(syncHistory.id, {
      status: 'success',
      totalRecords: stats.totalRecords,
      newRecords: stats.newRecords,
      updatedRecords: stats.updatedRecords,
    });

    console.info(`${category} sync completed: Total=${stats.totalRecords}, New=${stats.newRecords}, Updated=${stats.updatedRecords}, Skipped=${stats.skippedRecords}`);
    return stats;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    stats.errors.push(errorMessage);

    await updateSyncHistory(syncHistory.id, {
      status: 'failed',
      errorMessage,
    });

    console.error(`${category} sync failed:`, errorMessage);
    throw error;
  }
}

/**
 * 배치 upsert 헬퍼 (트랜잭션 래핑)
 * 각 배치를 독립된 트랜잭션으로 실행하여 원자성 보장
 * 배치 실패 시 해당 배치만 롤백, 이전 배치는 유지
 */
export async function batchUpsert<T>(
  items: T[],
  upsertFn: (item: T) => Promise<'new' | 'updated'>,
  batchSize: number = SYNC.BATCH_SIZE,
  syncHistoryId?: number
): Promise<{ newCount: number; updateCount: number }> {
  let newCount = 0;
  let updateCount = 0;
  let processedRecords = 0;

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchNumber = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(items.length / batchSize);

    try {
      // 각 배치를 트랜잭션으로 래핑 (대량 데이터 대비 타임아웃 30초)
      await prisma.$transaction(async (_tx) => {
        const results = await Promise.all(
          batch.map(async (item) => {
            const result = await upsertFn(item);
            return result;
          })
        );

        // 배치 내 결과 집계
        for (const result of results) {
          if (result === 'new') newCount++;
          else updateCount++;
        }
      }, { timeout: 30000 });

      processedRecords += batch.length;

      // SyncHistory 진행 상황 업데이트 (배치 완료마다)
      if (syncHistoryId) {
        await prisma.syncHistory.update({
          where: { id: syncHistoryId },
          data: {
            newRecords: newCount,
            updatedRecords: updateCount,
          },
        });
      }

      console.info(`Batch ${batchNumber}/${totalBatches} completed: ${Math.min(i + batchSize, items.length)}/${items.length} records`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Batch ${batchNumber}/${totalBatches} failed: ${errorMsg}`);
      console.error(`Processed records before failure: ${processedRecords}`);

      // 배치 실패 시 이전 배치는 유지되고 해당 배치만 롤백됨
      throw new Error(`Batch ${batchNumber} upsert failed: ${errorMsg}. Processed: ${processedRecords}/${items.length}`);
    }
  }

  return { newCount, updateCount };
}

/**
 * 배치 bulk upsert 헬퍼 — INSERT ... ON DUPLICATE KEY UPDATE 방식
 *
 * 개별 Prisma upsert 루프 대신 단일 bulk SQL로 처리하여 대용량 데이터(EV 충전기 49만건 등)에서
 * 수십 배 빠른 성능을 제공한다.
 *
 * @param tableName  MySQL 테이블명 (CATEGORY_REGISTRY에서 오는 값 — 신뢰 가능한 소스)
 * @param items      삽입/업데이트할 레코드 배열. 각 객체의 키가 컬럼명이 된다.
 *                   주의: 모든 항목의 키 집합이 동일해야 한다 (배치 단위로 첫 항목 기준).
 * @param batchSize  배치 크기 (기본값: SYNC.BATCH_SIZE)
 * @param syncHistoryId  진행 상황을 기록할 SyncHistory ID (선택)
 *
 * 동작:
 *  - `id`, `sourceId`는 INSERT 컬럼에 포함되며 ON DUPLICATE KEY UPDATE에서는 제외
 *  - `viewCount`, `createdAt`은 UPDATE에서 제외 (기존 값 유지)
 *  - `updatedAt`, `syncedAt`은 UPDATE 시 NOW()로 자동 갱신
 *  - 나머지 컬럼은 VALUES(col) 패턴으로 갱신
 *  - 모든 값은 파라미터 바인딩으로 처리 (SQL 인젝션 방지)
 *  - 신규/업데이트 구분: INSERT 후 ROW_COUNT()가 1이면 신규(insert), 2면 업데이트(duplicate)
 *    → bulk 실행이므로 전체 affected rows로 추정 (affectedRows / 2 = updated, 나머지 = new)
 */
export async function batchUpsertRaw<T extends Record<string, unknown>>(
  tableName: string,
  items: T[],
  batchSize: number = SYNC.BATCH_SIZE,
  syncHistoryId?: number
): Promise<{ newCount: number; updateCount: number }> {
  if (items.length === 0) return { newCount: 0, updateCount: 0 };

  // 테이블명 안전성 검증 (영문자, 숫자, 하이픈, 언더스코어만 허용)
  if (!/^[A-Za-z0-9_-]+$/.test(tableName)) {
    throw new Error(`Invalid table name: ${tableName}`);
  }

  let newCount = 0;
  let updateCount = 0;
  let processedRecords = 0;

  // ON DUPLICATE KEY UPDATE에서 제외할 컬럼 (삽입 시 세팅되고 이후 불변이어야 하는 것들)
  const SKIP_UPDATE_COLS = new Set(['id', 'sourceId', 'viewCount', 'createdAt', 'updatedAt', 'syncedAt']);

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchNumber = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(items.length / batchSize);

    try {
      // 컬럼 목록은 배치 첫 항목 기준으로 결정
      const columns = Object.keys(batch[0]);

      // camelCase → snake_case 변환 (Prisma는 camelCase, MySQL은 camelCase 그대로 저장)
      // Prisma가 MySQL 컬럼명을 camelCase로 매핑하므로 그대로 사용
      const colList = columns.map((c) => `\`${c}\``).join(', ');

      // VALUES 절: 각 행마다 (?, ?, ...) 플레이스홀더
      const rowPlaceholders = columns.map(() => '?').join(', ');
      const allPlaceholders = batch.map(() => `(${rowPlaceholders})`).join(', ');

      // ON DUPLICATE KEY UPDATE 절: 제외 컬럼 제외, updatedAt/syncedAt은 NOW()
      const updateClauses = columns
        .filter((c) => !SKIP_UPDATE_COLS.has(c))
        .map((c) => `\`${c}\` = VALUES(\`${c}\`)`)
        .join(', ');

      // updatedAt, syncedAt이 데이터에 없더라도 항상 갱신
      const timestampUpdates: string[] = [];
      if (columns.includes('updatedAt')) {
        // already handled via VALUES() above if not in SKIP list — but we do skip it,
        // so we add it explicitly as NOW()
        timestampUpdates.push('`updatedAt` = NOW()');
      }
      if (columns.includes('syncedAt')) {
        timestampUpdates.push('`syncedAt` = NOW()');
      }

      const fullUpdateClause = [updateClauses, ...timestampUpdates].filter(Boolean).join(', ');

      const sql = `INSERT INTO \`${tableName}\` (${colList}) VALUES ${allPlaceholders} ON DUPLICATE KEY UPDATE ${fullUpdateClause}`;

      // 파라미터 배열: 모든 행의 값을 평탄화
      const params: unknown[] = batch.flatMap((item) =>
        columns.map((col) => {
          const val = item[col];
          // undefined → null 변환
          return val === undefined ? null : val;
        })
      );

      // 트랜잭션으로 배치 실행 (원자성 보장)
      const affectedRows = await prisma.$transaction(async (tx) => {
        return tx.$executeRawUnsafe(sql, ...params);
      }, { timeout: 30000 });

      // MySQL INSERT ... ON DUPLICATE KEY UPDATE 규칙:
      //   신규 삽입: affected rows += 1
      //   업데이트: affected rows += 2
      //   변경 없음: affected rows += 0
      // 따라서: updated = affectedRows - batchLength, new = batchLength - updated
      const updatedInBatch = Math.max(0, affectedRows - batch.length);
      const newInBatch = batch.length - updatedInBatch;
      newCount += newInBatch;
      updateCount += updatedInBatch;

      processedRecords += batch.length;

      // SyncHistory 진행 상황 업데이트 (배치 완료마다)
      if (syncHistoryId) {
        await prisma.syncHistory.update({
          where: { id: syncHistoryId },
          data: {
            newRecords: newCount,
            updatedRecords: updateCount,
          },
        });
      }

      console.info(`Batch ${batchNumber}/${totalBatches} completed: ${Math.min(i + batchSize, items.length)}/${items.length} records (new=${newInBatch}, updated=${updatedInBatch})`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Batch ${batchNumber}/${totalBatches} failed: ${errorMsg}`);
      console.error(`Processed records before failure: ${processedRecords}`);

      throw new Error(`Batch ${batchNumber} upsert failed: ${errorMsg}. Processed: ${processedRecords}/${items.length}`);
    }
  }

  return { newCount, updateCount };
}

/**
 * 데이터 변환 + 중복 제거 헬퍼
 */
export function transformAndDedupe<TRaw, TTransformed>(
  rows: TRaw[],
  transformFn: (row: TRaw) => TTransformed | null,
  keyFn: (item: TTransformed) => string,
  stats: SyncStats
): TTransformed[] {
  const items: TTransformed[] = [];

  for (const row of rows) {
    try {
      const item = transformFn(row);
      if (item) {
        items.push(item);
      } else {
        stats.skippedRecords++;
      }
    } catch (error) {
      stats.skippedRecords++;
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      stats.errors.push(`Row transform error: ${errorMsg}`);
    }
  }

  const uniqueMap = new Map<string, TTransformed>();
  for (const item of items) {
    uniqueMap.set(keyFn(item), item);
  }
  const uniqueItems = Array.from(uniqueMap.values());
  const duplicateCount = items.length - uniqueItems.length;
  stats.skippedRecords += duplicateCount;

  if (duplicateCount > 0) {
    console.info(`Removed ${duplicateCount} duplicate records`);
  }

  return uniqueItems;
}
