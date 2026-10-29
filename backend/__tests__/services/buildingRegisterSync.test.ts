import { describe, it, expect, vi, beforeEach } from 'vitest';
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const db = vi.hoisted(() => ({
  $queryRaw: vi.fn(),
  $executeRaw: vi.fn(),
  buildingRegisterSourceFile: { findUnique: vi.fn(), upsert: vi.fn() },
}));
vi.mock('../../src/lib/prisma.js', () => ({ prisma: db }));

const base = vi.hoisted(() => ({ batchUpsertRaw: vi.fn(), runSync: vi.fn() }));
vi.mock('../../src/services/baseSyncService.js', () => base);

const source = vi.hoisted(() => ({ openHubSession: vi.fn(), downloadHubFile: vi.fn() }));
vi.mock('../../src/services/hubFileSource.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/services/hubFileSource.js')>()),
  ...source,
}));

const zip = vi.hoisted(() => ({ lines: new Map<string, string[]>(), readZipLines: vi.fn() }));
vi.mock('../../src/lib/zipLineReader.js', () => ({ readZipLines: zip.readZipLines }));

import { syncBuildingRegister, monthDiff } from '../../src/services/buildingRegisterSync.js';
import { TITLE_COLUMNS, RECAP_COLUMNS, UNIT_COLUMNS } from '../../src/services/buildingRegisterParser.js';

function line(length: number, values: Record<number, string>): string {
  return Array.from({ length }, (_, i) => values[i + 1] ?? '').join('|');
}
const title = (pk: string, extra: Record<number, string> = {}) => line(TITLE_COLUMNS.length, {
  1: pk, 2: '2', 4: '3', 6: '서울특별시 서초구 서초동 1337-2번지', 8: '아크로텔 강남역', 9: '11650', 10: '10800',
  11: '0', 12: '1337', 13: '0002', 24: '0', 35: '14202', 36: '업무시설', 37: '업무시설(오피스텔)-471호', ...extra,
});
const recap = (pk: string) => line(RECAP_COLUMNS.length, { 1: pk, 11: '11650', 12: '10800', 13: '0', 14: '1337', 15: '0002' });
const unit = (ho: string, purpose: string) => line(UNIT_COLUMNS.length, {
  8: '아크로텔 강남역', 9: '11650', 10: '10800', 11: '0', 12: '1337', 13: '0002', 23: ho, 27: '1', 36: purpose,
});

const entry = (taskCode: string, month: string) => ({
  taskSe: '03', taskCode, title: `x (${month.replace('-', '년 ')}월)`, sourceMonth: month, fileId: `OPN${taskCode}`,
});

function setup(opts: {
  months?: Record<string, string>;
  saved?: Record<string, string | null>;
  files?: Record<string, string[]>;
}) {
  const months = { '0302': '2026-09', '0303': '2026-09', '0306': '2026-09', ...opts.months };
  source.openHubSession.mockResolvedValue({
    cookie: 'c', csrf: 't', entries: Object.entries(months).map(([code, m]) => entry(code, m)),
  });
  db.buildingRegisterSourceFile.findUnique.mockImplementation(({ where }: { where: { taskCode: string } }) => {
    const m = opts.saved?.[where.taskCode];
    return Promise.resolve(m ? { taskCode: where.taskCode, sourceMonth: m } : null);
  });
  const files = {
    '0302': [recap('R1')],
    '0303': [title('T1'), title('T2')],
    '0306': [unit('101호', '오피스텔'), unit('102호', '소매점')],
    ...opts.files,
  };
  source.downloadHubFile.mockImplementation((_s: unknown, e: { taskCode: string }, dest: string) => {
    writeFileSync(dest, 'zip');
    zip.lines.set(dest, files[e.taskCode as keyof typeof files]);
    return Promise.resolve({ bytes: 3 });
  });
  zip.readZipLines.mockImplementation(async function* (path: string) {
    for (const l of zip.lines.get(path) ?? []) yield l;
  });
}

const workDir = () => mkdtempSync(join(tmpdir(), 'bldreg-'));

beforeEach(() => {
  vi.clearAllMocks();
  zip.lines.clear();
  base.runSync.mockImplementation(async (_c: string, fn: (s: unknown) => Promise<void>) => {
    const stats = { totalRecords: 0, newRecords: 0, updatedRecords: 0, skippedRecords: 0, errors: [] };
    await fn(stats);
    return stats;
  });
  base.batchUpsertRaw.mockResolvedValue({ newCount: 0, updateCount: 0 });
  db.$executeRaw.mockResolvedValue(0);
  // 1) 이전 월 행이 있는 시군구 목록  2) 오피스텔 대상 지번
  db.$queryRaw.mockImplementation((query: { strings?: string[] }) => {
    const sql = (query.strings ?? []).join('?');
    if (sql.includes('오피스텔')) {
      return Promise.resolve([{ sggCode: '11650', bjdongCode: '10800', platGbCd: '0', bun: '1337', ji: '0002' }]);
    }
    if (sql.includes('DISTINCT sggCode')) return Promise.resolve([{ sggCode: '11650' }, { sggCode: '41135' }]);
    return Promise.resolve([]);
  });
});

function upsertCalls(table: string) {
  return base.batchUpsertRaw.mock.calls.filter((c) => c[0] === table);
}

describe('monthDiff', () => {
  it('개월 차', () => {
    expect(monthDiff('2026-09', '2026-06')).toBe(3);
    expect(monthDiff('2027-01', '2026-11')).toBe(2);
  });
});

describe('syncBuildingRegister', () => {
  it('저장 월과 같으면 다운로드하지 않는다', async () => {
    setup({ saved: { '0302': '2026-09', '0303': '2026-09', '0306': '2026-09' } });
    const { results } = await syncBuildingRegister({ workDir: workDir() });
    expect(source.downloadHubFile).not.toHaveBeenCalled();
    expect(results.map((r) => [r.taskCode, r.status])).toEqual([['0302', 'unchanged'], ['0303', 'unchanged'], ['0306', 'not-due']]);
  });

  it('새 월이면 저장 후 이전 월을 시군구별로 지우고 기록을 남긴다', async () => {
    setup({ saved: { '0302': '2026-08', '0303': '2026-08', '0306': '2026-08' } });
    const { results } = await syncBuildingRegister({ workDir: workDir() });
    expect(results.find((r) => r.taskCode === '0303')).toMatchObject({ status: 'updated', sourceMonth: '2026-09', rows: 2, skipped: 0 });
    const titleRows = upsertCalls('BuildingRegisterTitle').flatMap((c) => c[1]);
    expect(titleRows.map((r: { mgmPk: string }) => r.mgmPk)).toEqual(['T1', 'T2']);
    expect(typeof titleRows[0].raw).toBe('string');
    expect(upsertCalls('BuildingRegisterDong').flatMap((c) => c[1])).toEqual([{ sggCode: '11650', bjdongCode: '10800', dongName: '서초동' }]);
    // 표제부 삭제: 시군구 2곳
    const titleDeletes = db.$executeRaw.mock.calls.filter((c) => c[0].strings.join('?').includes('BuildingRegisterTitle'));
    expect(titleDeletes.map((c) => c[0].values)).toEqual([['11650', '2026-09'], ['41135', '2026-09']]);
    expect(db.buildingRegisterSourceFile.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { taskCode: '0303' },
      update: expect.objectContaining({ sourceMonth: '2026-09', fileId: 'OPN0303', rowCount: 2, skippedCount: 0 }),
    }));
  });

  it('같은 PK 가 두 번 나오면 뒤 행으로 저장하고 오류로 세지 않는다', async () => {
    setup({ saved: { '0306': '2026-09' }, files: { '0303': [title('T1', { 41: '1' }), title('T1', { 41: '2' })] } });
    const { results } = await syncBuildingRegister({ workDir: workDir() });
    const rows = upsertCalls('BuildingRegisterTitle').flatMap((c) => c[1]);
    expect(rows).toHaveLength(1);
    expect(rows[0].hhldCnt).toBe(2);
    expect(results.find((r) => r.taskCode === '0303')).toMatchObject({ rows: 1, skipped: 0 });
  });

  it('저장하지 않는 행(일반 대장 단독주택)은 건너뜀으로 세지 않는다', async () => {
    setup({ saved: { '0306': '2026-09' }, files: { '0303': [title('T1'), title('T9', { 2: '1', 35: '01000' })] } });
    const { results } = await syncBuildingRegister({ workDir: workDir() });
    expect(results.find((r) => r.taskCode === '0303')).toMatchObject({ rows: 1, skipped: 0 });
  });

  it('건너뛴 줄이 1% 를 넘으면 실패하고 이전 행을 지우지 않는다', async () => {
    setup({ saved: { '0306': '2026-09' }, files: { '0302': [recap('R1'), 'a|b'] } });
    await expect(syncBuildingRegister({ workDir: workDir() })).rejects.toThrow(/건너뛴 줄/);
    expect(db.$executeRaw).not.toHaveBeenCalled();
    expect(db.buildingRegisterSourceFile.upsert).not.toHaveBeenCalled();
  });

  it('기준 월 기록을 먼저 바꾸고 이전 월 행을 지운다(삭제 중에도 새 월 행이 보이게)', async () => {
    setup({ saved: { '0302': '2026-09', '0303': '2026-09' } });
    await syncBuildingRegister({ workDir: workDir() });
    const recordOrder = db.buildingRegisterSourceFile.upsert.mock.invocationCallOrder[0];
    const unitDelete = db.$executeRaw.mock.calls.findIndex((c) => c[0].strings.join('?').includes('BuildingRegisterUnitCount'));
    expect(recordOrder).toBeLessThan(db.$executeRaw.mock.invocationCallOrder[unitDelete]);
  });

  it('형식이 깨진 파일은 한 행도 쓰지 않는다', async () => {
    setup({ saved: { '0306': '2026-09' }, files: { '0302': [recap('R1'), 'a|b'] } });
    await expect(syncBuildingRegister({ workDir: workDir() })).rejects.toThrow(/건너뛴 줄/);
    expect(upsertCalls('BuildingRegisterRecap')).toHaveLength(0);
  });

  it('전유공용면적은 3개월이 지나야 받는다', async () => {
    setup({ saved: { '0302': '2026-09', '0303': '2026-09', '0306': '2026-07' } });
    expect((await syncBuildingRegister({ workDir: workDir() })).results.find((r) => r.taskCode === '0306')?.status).toBe('not-due');

    setup({ saved: { '0302': '2026-09', '0303': '2026-09', '0306': '2026-06' } });
    expect((await syncBuildingRegister({ workDir: workDir() })).results.find((r) => r.taskCode === '0306')?.status).toBe('updated');

    setup({ saved: { '0302': '2026-09', '0303': '2026-09' } });
    expect((await syncBuildingRegister({ workDir: workDir() })).results.find((r) => r.taskCode === '0306')?.status).toBe('updated');
  });

  it('전유공용면적은 대상 지번의 오피스텔 호실만 센다', async () => {
    setup({ saved: { '0302': '2026-09', '0303': '2026-09' } });
    await syncBuildingRegister({ workDir: workDir() });
    expect(upsertCalls('BuildingRegisterUnitCount').flatMap((c) => c[1])).toEqual([{
      sggCode: '11650', bjdongCode: '10800', platGbCd: '0', bun: '1337', ji: '0002',
      bldNm: '아크로텔 강남역', dongNm: '', offitelUnits: 1, totalUnits: 2, sourceMonth: '2026-09',
    }]);
  });

  it('실패해도 zip 을 지운다', async () => {
    const dir = workDir();
    setup({ saved: { '0306': '2026-09' }, files: { '0302': ['a|b'] } });
    await expect(syncBuildingRegister({ workDir: dir })).rejects.toThrow();
    expect(existsSync(join(dir, '0302.zip'))).toBe(false);
  });

  it('목록에 파일이 없으면 실패', async () => {
    setup({});
    source.openHubSession.mockResolvedValue({ cookie: 'c', csrf: 't', entries: [] });
    await expect(syncBuildingRegister({ workDir: workDir() })).rejects.toThrow(/0302/);
  });
});
