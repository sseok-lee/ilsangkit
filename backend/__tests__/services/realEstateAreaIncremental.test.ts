import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const { query, execute, writer, cleanup, lock } = vi.hoisted(() => ({ query: vi.fn(), execute: vi.fn(), writer: vi.fn(), cleanup: vi.fn(), lock: vi.fn() }));
vi.mock('../../src/lib/prisma.js', () => ({ prisma: { $queryRaw: query, $executeRaw: execute } }));
vi.mock('../../src/utils/realEstateWriteLock.js', () => ({ withRealEstateWriteLock: lock }));
vi.mock('../../src/services/realEstateAreaSummaryService.js', () => ({ writeAreaSummaryBatch: writer, cleanupAreaSummaries: cleanup }));
import { refreshBuildingAreaSummariesIncremental as refresh, changedTransactionsQuery, metadataChangesQuery, maturityQuery } from '../../src/services/realEstateAreaIncrementalService.js';
const state = { startedAt: new Date('2026-10-26T00:00Z'), dateThrough: '2026-10-26', readyAt: new Date(), incrementalThrough: new Date('2026-10-26T12:00Z'), incrementalDateThrough: '2026-10-27' };
const building = { buildingKey: 'a'.repeat(64) };
beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-27T12:00Z'));
  lock.mockImplementation((_label, cb) => cb());
  query.mockResolvedValue([]);
  execute.mockResolvedValue(1);
  writer.mockResolvedValue(5);
  cleanup.mockResolvedValue(0);
});
afterEach(() => vi.useRealTimers());
describe('면적 일일 증분', () => {
  it('변화 없으면 요약 writer를 호출하지 않고 성공 기준만 전진한다', async () => {
    query.mockResolvedValueOnce([state]);
    expect((await refresh(['apt-sale']))[0]).toMatchObject({ buildings: 0, writtenRows: 0 });
    expect(writer).not.toHaveBeenCalled();
    expect(execute.mock.calls[0][0].values).toContainEqual(new Date('2026-10-27T12:00Z'));
  });
  it('새 거래·정정 키가 중복되어도 그 단지만 재계산한다', async () => {
    query.mockResolvedValueOnce([state]).mockResolvedValueOnce([]).mockResolvedValueOnce([{ ...building, id: 1, syncedAt: new Date() }, { ...building, id: 2, syncedAt: new Date() }]).mockResolvedValueOnce([building]);
    expect((await refresh(['apt-sale']))[0].buildings).toBe(1);
    expect(writer).toHaveBeenCalledTimes(1);
    expect(writer.mock.calls[0][1]).toEqual([building]);
  });
  it('band0 누락·V2 메타데이터 변경 키를 합치고 사라진 단지를 정리한다', async () => {
    query.mockResolvedValueOnce([state]).mockResolvedValueOnce([{ ...building, dirty: 1 }, { buildingKey: 'b', dirty: 0 }]).mockResolvedValueOnce([]).mockResolvedValueOnce([building]);
    cleanup.mockResolvedValue(5);
    expect((await refresh(['apt-sale']))[0]).toMatchObject({ buildings: 1, writtenRows: 5, deletedRows: 5 });
  });
  it('취소/정정으로 결과가 같으면 요약 기록 수가 0이다', async () => {
    query.mockResolvedValueOnce([state]).mockResolvedValueOnce([]).mockResolvedValueOnce([{ ...building, id: 1, syncedAt: new Date() }]).mockResolvedValueOnce([building]);
    writer.mockResolvedValue(0);
    expect((await refresh(['apt-sale']))[0].writtenRows).toBe(0);
  });
  it('계산 실패는 성공 기준 시각을 전진시키지 않는다', async () => {
    query.mockResolvedValueOnce([state]).mockResolvedValueOnce([{ ...building, dirty: 1 }]).mockResolvedValueOnce([]).mockResolvedValueOnce([building]);
    writer.mockRejectedValue(new Error('interrupted'));
    await expect(refresh(['apt-sale'])).rejects.toThrow('interrupted');
    expect(execute).not.toHaveBeenCalled();
  });
  it('날짜가 도래한 미래 거래도 syncedAt 변경 없이 재계산한다', async () => {
    query.mockResolvedValueOnce([{ ...state, incrementalDateThrough: '2026-10-26' }]).mockResolvedValueOnce([]).mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ ...building, id: 1 }]).mockResolvedValueOnce([building]);
    expect((await refresh(['apt-sale']))[0].buildings).toBe(1);
    const maturity = query.mock.calls[3][0];
    expect(maturity.sql).toContain('COALESCE(t.dealDay,1)');
    expect(maturity.values).toEqual(expect.arrayContaining([2026, 10, 26, 27]));
  });
  it('전체 백필 완료 전에는 일일 전체 계산으로 전환하지 않는다', async () => {
    query.mockResolvedValueOnce([{ ...state, readyAt: null }]);
    await expect(refresh(['apt-sale'])).rejects.toThrow('full area backfill required');
    expect(writer).not.toHaveBeenCalled();
  });
  it('감지는 존재하는 인덱스를 사용하고 DISTINCT/GROUP BY/window가 없다', () => {
    for (const q of [metadataChangesQuery('apt-sale', ''), changedTransactionsQuery('apt-sale', new Date(), new Date(), new Date(), 0), maturityQuery('apt-sale', 2026, 10, 0, 27, 0)]) {
      expect(q.sql).toContain('FORCE INDEX');
      expect(q.sql).not.toMatch(/DISTINCT|GROUP BY|ROW_NUMBER/i);
    }
  });
});
