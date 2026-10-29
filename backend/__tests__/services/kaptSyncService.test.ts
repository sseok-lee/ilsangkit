import { describe, it, expect, vi, beforeEach } from 'vitest';

const db = vi.hoisted(() => ({
  $queryRaw: vi.fn(),
  $executeRaw: vi.fn(),
  $executeRawUnsafe: vi.fn(),
  kaptSourceFile: { findUnique: vi.fn(), upsert: vi.fn() },
}));
vi.mock('../../src/lib/prisma.js', () => ({ prisma: db }));

const base = vi.hoisted(() => ({
  batchUpsertRaw: vi.fn(),
  runSync: vi.fn(),
}));
vi.mock('../../src/services/baseSyncService.js', () => base);

const source = vi.hoisted(() => ({
  openKaptSession: vi.fn(),
  fetchLatestKaptPost: vi.fn(),
  downloadKaptFile: vi.fn(),
}));
vi.mock('../../src/services/kaptFileSource.js', () => source);

const parsers = vi.hoisted(() => ({
  parseKaptBasicXlsx: vi.fn(),
  parseKaptAreaXlsx: vi.fn(),
  parseKaptParcelXlsx: vi.fn(),
}));
vi.mock('../../src/services/kaptFileParsers.js', () => parsers);

const fees = vi.hoisted(() => ({ syncKaptFees: vi.fn() }));
vi.mock('../../src/services/kaptFeeSync.js', () => fees);

const feeStats = vi.hoisted(() => ({ refreshFeeSggMedians: vi.fn(), hasFeeSggMedians: vi.fn() }));
vi.mock('../../src/services/kaptFeeStats.js', () => feeStats);

import { syncKaptFiles, KAPT_MIN_ROWS } from '../../src/services/kaptSyncService.js';

const RUN_START = new Date('2026-10-28T03:10:00Z');

function stats() {
  return { totalRecords: 0, newRecords: 0, updatedRecords: 0, skippedRecords: 0, errors: [] as string[] };
}

function basicItems(n: number) {
  return Array.from({ length: n }, (_, i) => ({ kaptCode: `A${i}`, name: `단지${i}`, raw: { 단지코드: `A${i}` } }));
}

beforeEach(() => {
  vi.clearAllMocks();
  base.runSync.mockImplementation(async (_c: string, fn: (s: ReturnType<typeof stats>) => Promise<void>) => {
    const s = stats();
    await fn(s);
    return s;
  });
  base.batchUpsertRaw.mockResolvedValue({ newCount: 1, updateCount: 0 });
  db.$queryRaw.mockResolvedValue([{ now: RUN_START }]);
  db.$executeRaw.mockResolvedValue(0);
  db.$executeRawUnsafe.mockResolvedValue(0);
  source.openKaptSession.mockResolvedValue({ cookie: 'c', csrf: 't' });
  source.fetchLatestKaptPost.mockImplementation(async (_s: unknown, dataset: string) => ({
    postSeq: { basic: 1, area: 2, parcel: 3 }[dataset], title: dataset, fileDate: '2026-10-26',
  }));
  source.downloadKaptFile.mockResolvedValue({ fileName: 'f.xlsx', buffer: Buffer.from('x') });
  parsers.parseKaptBasicXlsx.mockResolvedValue({ headers: [], items: basicItems(KAPT_MIN_ROWS.basic) });
  parsers.parseKaptAreaXlsx.mockResolvedValue({
    areas: Array.from({ length: KAPT_MIN_ROWS.area }, (_, i) => ({ kaptCode: `A${i}`, exclusiveArea: '84.0000', householdCount: 1 })),
    complexes: new Map([['A0', { managementArea: '100.00', exclusiveAreaTotal: '80.00' }]]),
  });
  fees.syncKaptFees.mockResolvedValue([
    { dataset: 'fee', status: 'unchanged', fileDate: '2026-10-26', rows: 1 },
    { dataset: 'fee-prev', status: 'unchanged', fileDate: '2026-10-26', rows: 1 },
  ]);
  feeStats.refreshFeeSggMedians.mockResolvedValue({ baseMonth: '202608', sggCount: 1 });
  feeStats.hasFeeSggMedians.mockResolvedValue(true);
  parsers.parseKaptParcelXlsx.mockResolvedValue({
    items: Array.from({ length: KAPT_MIN_ROWS.parcel }, (_, i) => ({ kaptCode: `A${i}`, pnu: '1'.repeat(19) })),
    skipped: 0,
  });
});

describe('syncKaptFiles', () => {
  it('기준일이 이미 반영된 데이터셋은 받지 않는다', async () => {
    db.kaptSourceFile.findUnique.mockResolvedValue({ fileDate: new Date('2026-10-26T00:00:00Z'), rowCount: 21751 });
    const results = await syncKaptFiles();
    expect(results.map((r) => r.status)).toEqual(['unchanged', 'unchanged', 'unchanged', 'unchanged', 'unchanged']);
    expect(source.downloadKaptFile).not.toHaveBeenCalled();
    expect(feeStats.refreshFeeSggMedians).not.toHaveBeenCalled();
    expect(base.runSync).toHaveBeenCalledWith('kapt', expect.any(Function), { allowEmpty: true });
  });

  it('새 파일이면 기본정보 → 면적 → 필지 순으로 반영하고 출처를 기록한다', async () => {
    db.kaptSourceFile.findUnique.mockResolvedValue({ fileDate: new Date('2026-10-23T00:00:00Z'), rowCount: 1 });
    const results = await syncKaptFiles();

    expect(results.map((r) => [r.dataset, r.status])).toEqual([
      ['basic', 'updated'], ['area', 'updated'], ['parcel', 'updated'], ['fee', 'unchanged'], ['fee-prev', 'unchanged'],
    ]);
    expect(base.batchUpsertRaw.mock.calls.map((c) => c[0])).toEqual(['KaptComplex', 'KaptComplexArea', 'KaptComplexParcel']);
    expect(db.kaptSourceFile.upsert).toHaveBeenCalledTimes(3);
    expect(db.kaptSourceFile.upsert.mock.calls[0][0].update).toMatchObject({ postSeq: 1, fileName: 'f.xlsx', rowCount: KAPT_MIN_ROWS.basic });
  });

  it('단지 행은 raw 를 JSON 문자열로, syncedAt 을 DB 실행 시작 시각으로 넣는다', async () => {
    db.kaptSourceFile.findUnique.mockResolvedValue(null);
    await syncKaptFiles();
    const rows = base.batchUpsertRaw.mock.calls[0][1];
    expect(rows[0]).toMatchObject({ kaptCode: 'A0', raw: '{"단지코드":"A0"}', active: true, syncedAt: RUN_START, updatedAt: RUN_START });
  });

  it('이번 파일에 없던 단지는 비활성, 면적·필지는 삭제한다 (실행 시작 시각 기준)', async () => {
    db.kaptSourceFile.findUnique.mockResolvedValue(null);
    await syncKaptFiles();
    const sqls = db.$executeRaw.mock.calls.map((c) => (c[0] as TemplateStringsArray).join('?'));
    expect(sqls[0]).toMatch(/UPDATE KaptComplex SET active = false WHERE active = true AND syncedAt < \?/);
    expect(sqls[1]).toMatch(/DELETE FROM KaptComplexArea WHERE syncedAt < \?/);
    expect(sqls[2]).toMatch(/DELETE FROM KaptComplexParcel WHERE syncedAt < \?/);
    expect(db.$executeRaw.mock.calls.every((c) => c[1] === RUN_START)).toBe(true);
  });

  it('면적 합계는 기존 단지에만 UPDATE JOIN 으로 넣는다', async () => {
    db.kaptSourceFile.findUnique.mockResolvedValue(null);
    await syncKaptFiles();
    const [sql, ...params] = db.$executeRawUnsafe.mock.calls[0];
    expect(sql).toMatch(/UPDATE KaptComplex k JOIN/);
    expect(params).toEqual(['A0', '100.00', '80.00']);
  });

  it('행 수가 하한보다 적으면 반영·비활성화 없이 실패한다', async () => {
    db.kaptSourceFile.findUnique.mockResolvedValue(null);
    parsers.parseKaptBasicXlsx.mockResolvedValue({ headers: [], items: basicItems(10) });
    await expect(syncKaptFiles()).rejects.toThrow(/행 수 부족/);
    expect(base.batchUpsertRaw).not.toHaveBeenCalled();
    expect(db.$executeRaw).not.toHaveBeenCalled();
    expect(db.kaptSourceFile.upsert).not.toHaveBeenCalled();
  });

  it('force 면 기준일이 같아도 다시 받는다', async () => {
    db.kaptSourceFile.findUnique.mockResolvedValue({ fileDate: new Date('2026-10-26T00:00:00Z'), rowCount: 1 });
    await syncKaptFiles({ force: true });
    expect(source.downloadKaptFile).toHaveBeenCalledTimes(3);
  });

  it('최신 글을 못 찾으면 실패한다', async () => {
    source.fetchLatestKaptPost.mockResolvedValue(null);
    await expect(syncKaptFiles()).rejects.toThrow(/최신 글을 찾지 못했다/);
  });

  it('관리비는 같은 세션으로 기본정보·면적·필지 다음에 받는다', async () => {
    db.kaptSourceFile.findUnique.mockResolvedValue({ fileDate: new Date('2026-10-26T00:00:00Z'), rowCount: 1 });
    await syncKaptFiles({ force: false });
    expect(fees.syncKaptFees).toHaveBeenCalledWith({ cookie: 'c', csrf: 't' }, { force: false }, expect.any(Object));
  });

  it('관리비·기본정보·면적 중 하나라도 새로 반영하면 시군구 중간값을 다시 계산한다', async () => {
    db.kaptSourceFile.findUnique.mockResolvedValue({ fileDate: new Date('2026-10-26T00:00:00Z'), rowCount: 1 });
    fees.syncKaptFees.mockResolvedValue([
      { dataset: 'fee', status: 'updated', fileDate: '2026-10-26', rows: 1 },
      { dataset: 'fee-prev', status: 'unchanged', fileDate: '2026-10-26', rows: 1 },
    ]);
    await syncKaptFiles();
    expect(feeStats.refreshFeeSggMedians).toHaveBeenCalledTimes(1);
  });

  it('바뀐 파일이 없어도 중간값 테이블이 비어 있으면 계산한다', async () => {
    db.kaptSourceFile.findUnique.mockResolvedValue({ fileDate: new Date('2026-10-26T00:00:00Z'), rowCount: 1 });
    feeStats.hasFeeSggMedians.mockResolvedValue(false);
    await syncKaptFiles();
    expect(feeStats.refreshFeeSggMedians).toHaveBeenCalledTimes(1);
  });
});
