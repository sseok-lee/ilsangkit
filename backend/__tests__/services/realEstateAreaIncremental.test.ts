import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const { query, execute, writer, transaction, lock } = vi.hoisted(() => ({ query: vi.fn(), execute: vi.fn(), writer: vi.fn(), transaction: vi.fn(), lock: vi.fn() }));
vi.mock('../../src/lib/prisma.js', () => ({ prisma: { $queryRaw: query, $executeRaw: execute, $transaction: transaction } }));
vi.mock('../../src/utils/realEstateWriteLock.js', () => ({ withRealEstateWriteLock: lock }));
vi.mock('../../src/services/realEstateAreaSummaryService.js', () => ({ writeAreaSummaryBatch: writer }));
import { refreshBuildingAreaSummariesIncremental as refresh, areaRefreshExitCode, rotateAreaTypes, changedTransactionsQuery, metadataChangesQuery, maturityQuery } from '../../src/services/realEstateAreaIncrementalService.js';

const initial = { startedAt: new Date('2026-10-26T00:00Z'), completedAt: new Date(), dateThrough: '2026-10-26', readyAt: new Date(), incrementalThrough: new Date('2026-10-26T12:00Z'), incrementalDateThrough: '2026-10-27', incrementalJob: null };
let states: Map<string, Record<string, any>>;
let work: Map<string, Set<string>>;
let buildings: Map<string, Array<{ buildingKey: string }>>;
let metadata: Map<string, Set<string>>;
let sources: Map<string, Array<{ id: number; syncedAt: Date; buildingKey: string }>>;
let maturities: Map<string, Array<{ id: number; buildingKey: string }>>;
let writerMs: number;
let queryMs: number;
function seed(type: string, count: number) {
  states.set(type, structuredClone(initial)); work.set(type, new Set());
  const rows = Array.from({ length: count }, (_, i) => ({ buildingKey: String(i + 1).padStart(64, '0') }));
  buildings.set(type, rows); metadata.set(type, new Set(rows.map((r) => r.buildingKey)));
  return rows;
}
function pending() {
  return { version: 1, mode: 'full', phase: 'full', runId: 'fixed', upper: '2026-10-27T12:00:00.000Z', lower: '2026-10-26T00:00:00.000Z', dateThrough: '2026-10-27', metadataCursor: '', sourceTime: '2026-10-26T00:00:00.000Z', sourceId: 0, maturityDay: '2026-10-28', maturityId: 0, fullCursor: '', remaining: 0, processed: 0, partialDays: 0, lastPartialDate: null };
}
function tick(ms: number) { vi.setSystemTime(Date.now() + ms); }
beforeEach(() => {
  vi.resetAllMocks(); vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-27T12:00Z'));
  states = new Map(); work = new Map(); buildings = new Map(); metadata = new Map(); sources = new Map(); maturities = new Map(); writerMs = 0; queryMs = 1;
  lock.mockImplementation((_label, cb) => cb());
  query.mockImplementation(async (q) => {
    tick(queryMs); const sql = q.sql; const v = q.values;
    if (sql.includes('FROM RealEstateAreaSummaryState')) return states.has(v[0]) ? [structuredClone(states.get(v[0]))] : [];
    if (sql.includes('AS dirty')) return (buildings.get(v[0]) ?? []).slice(Number(v[1]), Number(v[1]) + 1000).map((r) => ({ ...r, dirty: metadata.get(v[0])!.has(r.buildingKey) ? 1 : 0 }));
    if (sql.includes('t.syncedAt')) {
      const name = sql.match(/FROM (\w+) t/)![1];
      const type = name.replace('Transaction', '').replace(/(Apt|Villa|Offitel)(Sale|Rent)/, (_m: string, a: string, b: string) => `${a.toLowerCase()}-${b.toLowerCase()}`);
      return (sources.get(type) ?? []).filter((r) => r.syncedAt >= v[1] && r.syncedAt <= v[2] && (r.syncedAt > v[3] || (+r.syncedAt === +v[3] && r.id > v[5]))).slice(0, 1000);
    }
    if (sql.includes('COALESCE(t.dealDay')) return (maturities.get(`${v[0]}-sale`) ?? []).filter((r) => r.id > v[3]).slice(0, 1000);
    if (sql.includes('FROM RealEstateAreaSummaryWork')) return [...work.get(v[0])!].sort().slice(0, 25).map((buildingKey) => ({ buildingKey }));
    if (sql.includes('FROM RealEstateBuildingSummaryV2')) {
      const rows = buildings.get(v[0]) ?? [];
      return sql.includes(' IN (') ? v.slice(1).map((key: string) => rows[Number(key) - 1]).filter(Boolean) : rows.slice(Number(v[1]), Number(v[1]) + 25);
    }
    throw new Error(`Unhandled query ${sql}`);
  });
  execute.mockImplementation(async (q) => {
    const v = q.values; const sql = q.sql;
    if (sql.includes('INSERT IGNORE')) {
      let count = 0; for (let i = 0; i < v.length; i += 2) { const set = work.get(v[i])!; if (!set.has(v[i + 1])) { set.add(v[i + 1]); count++; } } return count;
    }
    if (sql.includes('DELETE FROM RealEstateAreaSummaryWork')) {
      const set = work.get(v[0])!; const keys = sql.includes(' IN (') ? v.slice(1) : [...set].slice(0, 500);
      keys.forEach((k: string) => set.delete(k)); return keys.length;
    }
    if (sql.includes('DELETE FROM RealEstateBuildingAreaSummary')) return 0;
    if (sql.includes('incrementalJob=NULL')) { Object.assign(states.get(v[2])!, { incrementalThrough: v[0], incrementalDateThrough: v[1], incrementalJob: null }); return 1; }
    if (sql.includes('SET incrementalJob=')) { states.get(v[1])!.incrementalJob = JSON.parse(v[0]); return 1; }
    throw new Error(`Unhandled execute ${sql}`);
  });
  transaction.mockImplementation(async (cb) => {
    const oldStates = structuredClone(states); const oldWork = structuredClone(work);
    try { return await cb({ $executeRaw: execute }); } catch (e) { states = oldStates; work = oldWork; throw e; }
  });
  writer.mockImplementation(async (type, rows, _date, _run, cb) => {
    await transaction(cb); rows.forEach((r: { buildingKey: string }) => metadata.get(type)!.delete(r.buildingKey)); tick(writerMs); return rows.length * 5;
  });
});
afterEach(() => vi.useRealTimers());

describe('면적 일일 작업의 영속 진행과 공정성', () => {
  it('변화 없으면 요약은 쓰지 않고 성공 기준만 전진한다', async () => {
    seed('apt-sale', 0);
    expect((await refresh(['apt-sale']))[0]).toMatchObject({ status: 'complete', writtenRows: 0 });
    expect(writer).not.toHaveBeenCalled(); expect(states.get('apt-sale')!.incrementalJob).toBeNull();
  });
  it('메타데이터와 중복 거래 키를 합쳐 그 단지만 계산한다', async () => {
    const [row] = seed('apt-sale', 1);
    sources.set('apt-sale', [{ ...row, id: 1, syncedAt: new Date() }, { ...row, id: 2, syncedAt: new Date() }]);
    expect((await refresh(['apt-sale']))[0]).toMatchObject({ buildings: 1, status: 'complete' });
    expect(writer).toHaveBeenCalledTimes(1);
  });
  it('예산이 끝나도 처리한 배치는 저장하고 다음 날 남은 키만 처리한다', async () => {
    seed('apt-sale', 60); writerMs = 30;
    const through = states.get('apt-sale')!.incrementalThrough;
    const result = await refresh(['apt-sale'], { budgetMs: 55, sliceMs: 20 });
    expect(result[0].status).toBe('partial'); expect(areaRefreshExitCode(result)).toBe(75);
    const saved = structuredClone(states.get('apt-sale')!.incrementalJob);
    expect(saved.processed).toBeGreaterThan(0); expect(saved.processed).toBeLessThan(60);
    expect(work.get('apt-sale')!.size).toBe(60 - saved.processed);
    expect(states.get('apt-sale')!.incrementalThrough).toEqual(through);
    vi.setSystemTime(new Date('2026-10-28T12:00Z')); writer.mockClear();
    const next = await refresh(['apt-sale'], { budgetMs: 1000 });
    expect(next[0]).toMatchObject({ status: 'complete', buildings: 60 - saved.processed });
    expect(states.get('apt-sale')!.incrementalThrough.toISOString()).toBe(saved.upper);
    expect(work.get('apt-sale')!.size).toBe(0);
  });
  it('감지 도중 예산이 끝나도 고정 상한과 페이지 커서를 재개한다', async () => {
    seed('apt-sale', 1001); queryMs = 10;
    await refresh(['apt-sale'], { budgetMs: 15 });
    const job = structuredClone(states.get('apt-sale')!.incrementalJob);
    expect(job.metadataCursor).toBe(String(1000).padStart(64, '0'));
    query.mockClear(); queryMs = 0;
    await refresh(['apt-sale'], { budgetMs: 1000 });
    expect(query.mock.calls.find(([q]) => q.sql.includes('AS dirty'))![0].values[1]).toBe(job.metadataCursor);
    expect(states.get('apt-sale')!.incrementalThrough.toISOString()).toBe(job.upper);
  });
  it('원본 감지 페이지도 저장해 백필 기간의 큰 sync 범위를 처음부터 읽지 않는다', async () => {
    const rows = seed('apt-sale', 1001); metadata.get('apt-sale')!.clear();
    sources.set('apt-sale', rows.map((r, i) => ({ ...r, id: i + 1, syncedAt: new Date() })));
    const job = { ...pending(), mode: 'incremental', phase: 'source', sourceTime: '2026-10-26T00:00:00.000Z' };
    states.get('apt-sale')!.incrementalJob = job; queryMs = 10;
    await refresh(['apt-sale'], { budgetMs: 15 });
    const saved = structuredClone(states.get('apt-sale')!.incrementalJob);
    expect(saved.sourceId).toBe(1000); expect(work.get('apt-sale')!.size).toBe(1000);
    queryMs = 0; query.mockClear();
    expect((await refresh(['apt-sale']))[0]).toMatchObject({ status: 'complete', buildings: 1001 });
    const sourceQuery = query.mock.calls.find(([q]) => q.sql.includes('t.syncedAt'))![0];
    expect(sourceQuery.values[5]).toBe(1000); expect(sourceQuery.values[2].toISOString()).toBe(job.upper);
  });
  it('요약/작업 체크포인트 실패는 미처리 작업과 성공 시각을 보존하며 다른 유형은 계속한다', async () => {
    seed('apt-sale', 1); seed('apt-rent', 1);
    const through = states.get('apt-sale')!.incrementalThrough;
    writer.mockImplementationOnce(async () => { throw new Error('interrupted'); });
    const result = await refresh(['apt-sale', 'apt-rent']);
    expect(areaRefreshExitCode(result)).toBe(6);
    expect(result.filter((r) => r.status === 'complete')).toHaveLength(1);
    const failed = result.find((r) => r.status === 'failed')!.type;
    expect(work.get(failed)!.size).toBe(1); expect(states.get(failed)!.incrementalThrough).toEqual(through);
    expect((await refresh([failed]))[0].status).toBe('complete');
  });
  it('큰 유형도 slice 후 양보하고 일별 시작 유형은 회전한다', async () => {
    for (const type of ['apt-sale', 'apt-rent']) { seed(type, 100); states.get(type)!.incrementalJob = pending(); }
    writerMs = 15;
    const result = await refresh(['apt-sale', 'apt-rent'], { budgetMs: 55, sliceMs: 18 });
    expect(result.every((r) => r.buildings > 0)).toBe(true);
    const types = ['apt-sale', 'apt-rent', 'villa-sale', 'villa-rent', 'offitel-sale', 'offitel-rent'];
    expect(new Set(Array.from({ length: 6 }, (_, i) => rotateAreaTypes(types, new Date(Date.UTC(2026, 9, 27 + i)))[0])).size).toBe(6);
    expect(types[0]).toBe('apt-sale');
  });
  it('dirty 2만이면 전체 모드로 전환하고 여러 실행의 커서로 완료 후 증분에 복귀한다', async () => {
    seed('apt-sale', 20001); writerMs = 2;
    const first = await refresh(['apt-sale'], { budgetMs: 100, sliceMs: 20 });
    const job = states.get('apt-sale')!.incrementalJob;
    expect(job.mode).toBe('full'); expect(first[0].status).toBe('partial');
    expect(job.processed).toBeGreaterThan(0);
    const cursor = job.fullCursor; writer.mockClear();
    const second = await refresh(['apt-sale'], { budgetMs: 20000 });
    expect(second[0]).toMatchObject({ mode: 'full', status: 'complete', buildings: 20001 - job.processed });
    expect(writer.mock.calls[0][1][0].buildingKey > cursor).toBe(true);
    expect(states.get('apt-sale')!.incrementalJob).toBeNull();
    expect((await refresh(['apt-sale']))[0]).toMatchObject({ mode: 'incremental', buildings: 0, status: 'complete' });
  }, 20000);
  it('3일 연속 미완료 경고를 내되 같은 날 여러 실행은 하루로 센다', async () => {
    seed('apt-sale', 1); states.get('apt-sale')!.incrementalJob = pending();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    for (let i = 0; i < 3; i++) {
      vi.setSystemTime(new Date(Date.UTC(2026, 9, 27 + i, 12)));
      await refresh(['apt-sale'], { budgetMs: 0 }); await refresh(['apt-sale'], { budgetMs: 0 });
    }
    expect(states.get('apt-sale')!.incrementalJob.partialDays).toBe(3);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('3 consecutive days'));
    warn.mockRestore();
  });
  it('미래 거래 도래는 syncedAt 변경 없이 큐에 넣는다', async () => {
    const [row] = seed('apt-sale', 1); metadata.get('apt-sale')!.clear();
    states.get('apt-sale')!.incrementalDateThrough = '2026-10-26'; maturities.set('apt-sale', [{ ...row, id: 1 }]);
    expect((await refresh(['apt-sale']))[0].buildings).toBe(1);
  });
  it('백필 대기는 부분 상태이며 다른 유형을 굶기지 않는다', async () => {
    seed('apt-sale', 0); seed('apt-rent', 0); states.get('apt-sale')!.readyAt = null;
    const result = await refresh(['apt-sale', 'apt-rent']);
    expect(result.find((r) => r.type === 'apt-rent')!.status).toBe('complete'); expect(areaRefreshExitCode(result)).toBe(75);
    expect(writer).not.toHaveBeenCalled();
  });
  it('없는 인덱스가 오류를 내지 않는 힌트이며 전체 집계가 없다', () => {
    for (const q of [metadataChangesQuery('apt-sale', ''), changedTransactionsQuery('apt-sale', new Date(), new Date(), new Date(), 0), maturityQuery('apt-sale', 2026, 10, 0, 27, 0)]) {
      expect(q.sql).toContain('/*+ INDEX('); expect(q.sql).not.toMatch(/FORCE INDEX|DISTINCT|GROUP BY|ROW_NUMBER/i);
    }
  });
});
