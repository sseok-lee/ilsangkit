// 동기화 서비스 공통 추상화
// toilet, parking, clothes 동기화 서비스의 중복 코드를 추출

import { prisma } from '../lib/prisma.js';
import type { SyncStatus, SyncHistory } from '@prisma/client';

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
 * 배치 upsert 헬퍼
 */
export async function batchUpsert<T>(
  items: T[],
  upsertFn: (item: T) => Promise<'new' | 'updated'>,
  batchSize: number = 100
): Promise<{ newCount: number; updateCount: number }> {
  let newCount = 0;
  let updateCount = 0;

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);

    await Promise.all(
      batch.map(async (item) => {
        const result = await upsertFn(item);
        if (result === 'new') newCount++;
        else updateCount++;
      })
    );

    console.info(`Processed ${Math.min(i + batchSize, items.length)}/${items.length} records`);
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
