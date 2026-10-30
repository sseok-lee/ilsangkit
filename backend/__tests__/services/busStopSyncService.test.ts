import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  count: vi.fn(),
  deleteMany: vi.fn(),
  batchUpsertRaw: vi.fn(),
}));

vi.mock('../../src/lib/prisma.js', () => ({
  default: { busStop: { count: mocks.count, deleteMany: mocks.deleteMany } },
}));

vi.mock('../../src/services/baseSyncService.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/services/baseSyncService.js')>();
  return {
    ...actual,
    // 히스토리 기록은 DB 없이 stats만 넘겨 실행한다
    runSync: async (_c: string, fn: (s: ReturnType<typeof actual.createSyncStats>) => Promise<void>) => {
      const stats = actual.createSyncStats();
      await fn(stats);
      return stats;
    },
    batchUpsertRaw: mocks.batchUpsertRaw,
  };
});

import { syncBusStops } from '../../src/services/busStopSyncService.js';

function rawRows(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    정류장번호: String(10000 + i),
    정류장명: `정류장${i}`,
    위도: 37.5 + i * 1e-6,
    경도: 127.0 + i * 1e-6,
  }));
}

describe('syncBusStops', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.count.mockResolvedValue(0);
    mocks.batchUpsertRaw.mockResolvedValue({ newCount: 2, updateCount: 0 });
    mocks.deleteMany.mockResolvedValue({ count: 0 });
  });

  it('저장된 판과 같으면 loadRows를 호출하지 않는다', async () => {
    // 전체 1000건, 옛 판 0건
    mocks.count.mockImplementation(async (args?: unknown) => (args ? 0 : 1000));
    const loadRows = vi.fn();
    const stats = await syncBusStops({ version: '20251031', loadRows });
    expect(loadRows).not.toHaveBeenCalled();
    expect(mocks.batchUpsertRaw).not.toHaveBeenCalled();
    expect(mocks.deleteMany).not.toHaveBeenCalled();
    expect(stats.outcome).toBe('skipped');
  });

  it('일부 행만 새 판이면(이전 실행 중간 실패) skip하지 않고 다시 적재한다', async () => {
    // 전체 1000건 중 옛 판 400건 남음
    mocks.count.mockImplementation(async (args?: unknown) => (args ? 400 : 1000));
    const loadRows = vi.fn(async () => rawRows(900));
    const stats = await syncBusStops({ version: '20251031', loadRows });
    expect(loadRows).toHaveBeenCalledTimes(1);
    expect(mocks.batchUpsertRaw).toHaveBeenCalledTimes(1);
    expect(mocks.deleteMany).toHaveBeenCalledWith({ where: { sourceVersion: { not: '20251031' } } });
    expect(stats.outcome).toBe('loaded');
  });

  it('빈 테이블이면 적재 후 옛 판을 삭제한다', async () => {
    const stats = await syncBusStops({ version: '20251031', loadRows: async () => rawRows(2) });
    expect(mocks.batchUpsertRaw).toHaveBeenCalledTimes(1);
    const [table, rows, , , opts] = mocks.batchUpsertRaw.mock.calls[0];
    expect(table).toBe('BusStop');
    expect(rows).toHaveLength(2);
    expect(rows[0].sourceVersion).toBe('20251031');
    expect(opts).toMatchObject({ uniqueKey: 'nodeId', exactStats: true });
    expect(mocks.deleteMany).toHaveBeenCalledWith({ where: { sourceVersion: { not: '20251031' } } });
    expect(stats.outcome).toBe('loaded');
    expect(stats.newRecords).toBe(2);
  });

  it('새 판이 이전 건수의 80% 미만이면 쓰기·삭제 없이 reject한다', async () => {
    mocks.count.mockResolvedValue(1000);
    await expect(
      syncBusStops({ version: '20251031', loadRows: async () => rawRows(799) }),
    ).rejects.toThrow(/799.*1000|1000.*799/);
    expect(mocks.batchUpsertRaw).not.toHaveBeenCalled();
    expect(mocks.deleteMany).not.toHaveBeenCalled();
  });

  it('새 판이 정확히 80%이면 적재한다(경계값)', async () => {
    mocks.count.mockResolvedValue(1000);
    const stats = await syncBusStops({ version: '20251031', loadRows: async () => rawRows(800) });
    expect(mocks.batchUpsertRaw).toHaveBeenCalledTimes(1);
    expect(stats.outcome).toBe('loaded');
  });

  it('upsert가 실패하면 삭제하지 않는다', async () => {
    mocks.batchUpsertRaw.mockRejectedValue(new Error('db down'));
    await expect(
      syncBusStops({ version: '20251031', loadRows: async () => rawRows(2) }),
    ).rejects.toThrow('db down');
    expect(mocks.deleteMany).not.toHaveBeenCalled();
  });

  it('정규화 결과가 0건이면 이전 데이터가 없어도 throw하고 삭제하지 않는다', async () => {
    await expect(
      syncBusStops({ version: '20251031', loadRows: async () => [{ 정류장번호: '', 정류장명: '' }] }),
    ).rejects.toThrow(/0건/);
    expect(mocks.batchUpsertRaw).not.toHaveBeenCalled();
    expect(mocks.deleteMany).not.toHaveBeenCalled();
  });
});
