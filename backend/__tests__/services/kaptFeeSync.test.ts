import { describe, it, expect, vi, beforeEach } from 'vitest';

const db = vi.hoisted(() => ({
  $queryRaw: vi.fn(),
  $executeRaw: vi.fn(),
  kaptSourceFile: { findUnique: vi.fn(), upsert: vi.fn() },
}));
vi.mock('../../src/lib/prisma.js', () => ({ prisma: db }));

const base = vi.hoisted(() => ({ batchUpsertRaw: vi.fn() }));
vi.mock('../../src/services/baseSyncService.js', () => base);

const source = vi.hoisted(() => ({
  fetchKaptBoardPosts: vi.fn(),
  findFeePosts: vi.fn(),
  downloadKaptFile: vi.fn(),
}));
vi.mock('../../src/services/kaptFileSource.js', () => source);

const parser = vi.hoisted(() => ({ readKaptFeeXlsx: vi.fn() }));
vi.mock('../../src/services/kaptFeeParser.js', () => parser);

import { syncKaptFees, minFeeRows } from '../../src/services/kaptFeeSync.js';

const RUN_START = new Date('2026-10-29T03:20:00Z');
const SESSION = { cookie: 'c', csrf: 't' };
const CURRENT = { postSeq: 21, title: '관리비정보(2026.10.26.)', fileDate: '2026-10-26' };
const PREVIOUS = { postSeq: 123541, title: '관리비정보(2025년)', fileDate: null };

function stats() {
  return { totalRecords: 0, newRecords: 0, updatedRecords: 0, skippedRecords: 0, errors: [] as string[] };
}

function items(n: number, yearMonth = '202601') {
  return Array.from({ length: n }, (_, i) => ({ kaptCode: `A${i}`, yearMonth, commonTotal: 1 }));
}

/** 행 n 개를 batch 크기로 나눠 내보내는 가짜 스트리밍 리더 */
function reader(n: number, batch = 50_000) {
  return async function* () {
    for (let i = 0; i < n; i += batch) yield items(Math.min(batch, n - i));
  };
}

function records(map: Record<string, { fileDate: string; fileName?: string; rowCount?: number } | null>) {
  db.kaptSourceFile.findUnique.mockImplementation(async ({ where }: { where: { dataset: string } }) => {
    const r = map[where.dataset];
    return r ? { fileDate: new Date(`${r.fileDate}T00:00:00Z`), fileName: r.fileName ?? 'old.xlsx', rowCount: r.rowCount ?? 0 } : null;
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  db.$queryRaw.mockResolvedValue([{ now: RUN_START }]);
  base.batchUpsertRaw.mockResolvedValue({ newCount: 1, updateCount: 0 });
  source.fetchKaptBoardPosts.mockResolvedValue([CURRENT, PREVIOUS]);
  source.findFeePosts.mockReturnValue({ current: CURRENT, previous: PREVIOUS });
  source.downloadKaptFile.mockImplementation(async (_s: unknown, postSeq: number) => ({
    fileName: postSeq === 21 ? '20261026_단지_관리비정보.xlsx' : '20261026_단지_관리비정보_2025.xlsx',
    buffer: Buffer.from(String(postSeq)),
  }));
  parser.readKaptFeeXlsx.mockImplementation((buffer: Buffer) => reader(buffer.toString() === '21' ? 182_060 : 255_019)());
});

describe('minFeeRows', () => {
  it('올해 파일은 (기준일 월 − 2) × 15,000, 전년도 파일은 200,000', () => {
    expect(minFeeRows('fee', '2026-10-26')).toBe(120_000);
    expect(minFeeRows('fee', '2027-02-02')).toBe(0);
    expect(minFeeRows('fee', '2027-01-05')).toBe(0);
    expect(minFeeRows('fee-prev', '2026-10-26')).toBe(200_000);
  });
});

describe('syncKaptFees', () => {
  it('03 탭 목록에서 주간·연도 글을 찾는다', async () => {
    records({ fee: { fileDate: '2026-10-26' }, 'fee-prev': { fileDate: '2026-10-26' } });
    await syncKaptFees(SESSION, {}, stats());
    expect(source.fetchKaptBoardPosts).toHaveBeenCalledWith(SESSION, '03', undefined);
  });

  it('두 파일 모두 이번 주간 기준일까지 반영돼 있으면 받지 않는다', async () => {
    records({ fee: { fileDate: '2026-10-26', rowCount: 7 }, 'fee-prev': { fileDate: '2026-10-26', rowCount: 9 } });
    const results = await syncKaptFees(SESSION, {}, stats());
    expect(results).toEqual([
      { dataset: 'fee', status: 'unchanged', fileDate: '2026-10-26', rows: 7 },
      { dataset: 'fee-prev', status: 'unchanged', fileDate: '2026-10-26', rows: 9 },
    ]);
    expect(source.downloadKaptFile).not.toHaveBeenCalled();
  });

  it('새 주간 글이면 올해 → 전년도 순서로 받아 배치마다 upsert 하고 출처를 기록한다', async () => {
    records({ fee: { fileDate: '2026-10-23' }, 'fee-prev': { fileDate: '2026-10-23' } });
    const s = stats();
    const results = await syncKaptFees(SESSION, {}, s);

    expect(source.downloadKaptFile.mock.calls.map((c) => c[1])).toEqual([21, 123541]);
    expect(results.map((r) => [r.dataset, r.status, r.rows])).toEqual([['fee', 'updated', 182_060], ['fee-prev', 'updated', 255_019]]);
    expect(base.batchUpsertRaw).toHaveBeenCalledTimes(4 + 6);
    const [table, rows] = base.batchUpsertRaw.mock.calls[0];
    expect(table).toBe('KaptMaintenanceFee');
    expect(rows[0]).toMatchObject({ kaptCode: 'A0', yearMonth: '202601', updatedAt: RUN_START, syncedAt: RUN_START });
    expect(db.$executeRaw).not.toHaveBeenCalled(); // 지우지 않는다
    expect(db.kaptSourceFile.upsert.mock.calls.map((c) => c[0].update)).toEqual([
      { fileDate: new Date('2026-10-26T00:00:00Z'), postSeq: 21, fileName: '20261026_단지_관리비정보.xlsx', rowCount: 182_060 },
      { fileDate: new Date('2026-10-26T00:00:00Z'), postSeq: 123541, fileName: '20261026_단지_관리비정보_2025.xlsx', rowCount: 255_019 },
    ]);
    expect(s.totalRecords).toBe(182_060 + 255_019);
  });

  it('전년도 파일명이 저장된 것과 같으면 파싱하지 않고 기준일만 갱신한다', async () => {
    records({
      fee: { fileDate: '2026-10-23' },
      'fee-prev': { fileDate: '2026-10-23', fileName: '20261026_단지_관리비정보_2025.xlsx', rowCount: 255_019 },
    });
    const results = await syncKaptFees(SESSION, {}, stats());
    expect(results[1]).toEqual({ dataset: 'fee-prev', status: 'unchanged', fileDate: '2026-10-26', rows: 255_019 });
    expect(parser.readKaptFeeXlsx).toHaveBeenCalledTimes(1);
    expect(db.kaptSourceFile.upsert.mock.calls[1][0].update).toMatchObject({ fileDate: new Date('2026-10-26T00:00:00Z'), rowCount: 255_019 });
  });

  it('전년도 연도 글이 없으면 전년도는 건너뛴다', async () => {
    records({ fee: { fileDate: '2026-10-23' }, 'fee-prev': null });
    source.findFeePosts.mockReturnValue({ current: CURRENT, previous: null });
    const results = await syncKaptFees(SESSION, {}, stats());
    expect(results.map((r) => [r.dataset, r.status])).toEqual([['fee', 'updated'], ['fee-prev', 'unchanged']]);
    expect(source.downloadKaptFile).toHaveBeenCalledTimes(1);
  });

  it('행 수가 하한보다 적으면 출처를 기록하지 않고 실패한다(다음 실행이 다시 받는다)', async () => {
    records({ fee: { fileDate: '2026-10-23' }, 'fee-prev': { fileDate: '2026-10-23' } });
    parser.readKaptFeeXlsx.mockImplementation(() => reader(1_000)());
    await expect(syncKaptFees(SESSION, {}, stats())).rejects.toThrow(/관리비.*행 수 부족\(1000 < 120000\)/);
    expect(db.kaptSourceFile.upsert).not.toHaveBeenCalled();
  });

  it('force 면 기준일이 같아도 다시 받고 파일명이 같아도 반영한다', async () => {
    records({
      fee: { fileDate: '2026-10-26' },
      'fee-prev': { fileDate: '2026-10-26', fileName: '20261026_단지_관리비정보_2025.xlsx' },
    });
    const results = await syncKaptFees(SESSION, { force: true }, stats());
    expect(results.map((r) => r.status)).toEqual(['updated', 'updated']);
  });

  it('주간 글을 못 찾으면 실패한다', async () => {
    source.findFeePosts.mockReturnValue({ current: null, previous: null });
    await expect(syncKaptFees(SESSION, {}, stats())).rejects.toThrow(/관리비 최신 글을 찾지 못했다/);
  });
});
