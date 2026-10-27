import { beforeEach, describe, expect, it, vi } from 'vitest';
const { query, execute, executeRaw, transaction, latest } = vi.hoisted(() => ({
  query: vi.fn(), execute: vi.fn(), executeRaw: vi.fn(), transaction: vi.fn(), latest: vi.fn(),
}));
vi.mock('../../src/lib/prisma.js', () => ({ prisma: {
  $queryRawUnsafe: query, $executeRawUnsafe: execute, $transaction: transaction,
} }));
vi.mock('../../src/services/realEstateLatestDeals.js', async (orig) => ({
  ...await orig<typeof import('../../src/services/realEstateLatestDeals.js')>(), getLatestDeals: latest,
}));
import { AREA_BANDS, areaBandFor, refreshBuildingAreaSummariesUnlocked as refresh } from '../../src/services/realEstateAreaSummaryService.js';
import { latestDealsKey } from '../../src/services/realEstateLatestDeals.js';
import { bucketRange } from '../../src/schemas/realEstateMap.js';
import { parseAreaSummaryArgs } from '../../src/scripts/backfillRealEstateAreaSummary.js';
import type { BuildingKey } from '../../src/types/realEstateExploration.js';
const row = { buildingKey: 'a'.repeat(64), buildingName: '단지', bjdCode: '11680', city: '서울', district: '강남구', dongName: '역삼동', jibun: '1', lat: null, lng: null, transactionCount: 10 };
const sale = { kind: 'sale', amount: 10000, deposit: null, monthlyRent: null, exclusiveArea: 60, floor: 1, dealYear: 2026, dealMonth: 10, dealDay: 1 };
beforeEach(() => {
  vi.resetAllMocks();
  execute.mockResolvedValue(0);
  transaction.mockImplementation((cb) => cb({ $executeRaw: executeRaw, $executeRawUnsafe: execute }));
  latest.mockImplementation((keys: BuildingKey[]) => Promise.resolve(new Map(keys.map((k) => [latestDealsKey(k), { sale, jeonse: null, wolse: null }]))));
});

describe('단지×면적 요약 갱신', () => {
  it('전체 및 네 구간은 API와 같은 경계를 쓴다', () => {
    expect(AREA_BANDS).toEqual([null, { min: null, max: 60 }, { min: 60, max: 85 }, { min: 85, max: 135 }, { min: 135, max: null }]);
    expect(areaBandFor(null)).toBe(0);
    expect(['0-60', '60-85', '85-135', '135-'].map((b) => areaBandFor(bucketRange(b)))).toEqual([1, 2, 3, 4]);
    expect(() => areaBandFor({ min: 1, max: 2 })).toThrow();
  });

  it('작은 배치의 다섯 구간이 getLatestDeals를 공유하고 upsert와 커서를 원자적으로 기록한다', async () => {
    query.mockResolvedValueOnce([]).mockResolvedValueOnce([row]).mockResolvedValueOnce([]).mockResolvedValueOnce([{ sourceCount: 1, summaryCount: 5 }]);
    const result = await refresh({ types: ['apt-sale'], batchSize: 1, pauseMs: 0 });
    expect(result[0].buildings).toBe(1);
    expect(latest).toHaveBeenCalledTimes(5);
    latest.mock.calls.forEach((call, i) => {
      expect(call[1]).toBe('sale');
      expect(call[2].area).toEqual(AREA_BANDS[i]);
      expect(call[2].dateThrough).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(call[0][0]).toMatchObject({ dongName: '역삼동', jibun: '1' });
    });
    expect(transaction).toHaveBeenCalledTimes(1);
    const upsert = executeRaw.mock.calls[0][0];
    expect(upsert.sql).toContain('ON DUPLICATE KEY UPDATE');
    expect(upsert.values.filter((v: unknown) => v === JSON.stringify({ sale, jeonse: null, wolse: null }))).toHaveLength(5);
    expect(execute.mock.calls.some((c) => c[0].includes('SET lastBuildingKey = ?') && c[1] === row.buildingKey)).toBe(true);
    const cleanup = execute.mock.calls.find((c) => c[0].includes('DELETE FROM'));
    expect(cleanup?.[0]).toContain('NOT EXISTS');
    expect(cleanup?.[0]).toContain('LIMIT 500');
    expect(query.mock.calls[2].slice(1)).toEqual(['apt-sale', row.buildingKey]);
  });

  it('지역별 미완료 커서·실행 기준일을 재사용하고 지역 밖은 정리하지 않는다', async () => {
    query.mockResolvedValueOnce([{ runId: 'old', lastBuildingKey: 'b'.repeat(64), dateThrough: '2026-09-01', completedAt: null }])
      .mockResolvedValueOnce([row]).mockResolvedValueOnce([]).mockResolvedValueOnce([{ sourceCount: 1, summaryCount: 5 }]);
    await refresh({ types: ['apt-rent'], bjdCode: '11680', resume: true, pauseMs: 0 });
    expect(query.mock.calls[1].slice(1)).toEqual(['apt-rent', 'b'.repeat(64), '11680']);
    expect(latest.mock.calls[0].slice(1)).toEqual(['rent', { area: null, dateThrough: '2026-09-01' }]);
    expect(execute.mock.calls.some((c) => c[0].includes('INSERT INTO RealEstateAreaSummaryState'))).toBe(false);
    expect(execute.mock.calls.find((c) => c[0].includes('DELETE FROM'))?.slice(1)).toEqual(['apt-rent', '11680']);
    expect(execute.mock.calls.at(-1)?.slice(1)).toEqual(['apt-rent', '11680', 'old']);
  });

  it('중단된 배치는 완료 표시·정리 없이 실패하고 이전 readyAt을 지우지 않는다', async () => {
    query.mockResolvedValueOnce([]).mockResolvedValueOnce([row]);
    latest.mockRejectedValueOnce(new Error('interrupted'));
    await expect(refresh({ types: ['apt-sale'] })).rejects.toThrow('interrupted');
    expect(execute.mock.calls).toHaveLength(1);
    expect(execute.mock.calls[0][0].split('ON DUPLICATE KEY UPDATE')[1]).not.toContain('readyAt');
    expect(transaction).not.toHaveBeenCalled();
  });

  it('재개 중 소스에 새 키가 생겨 다섯 구간이 빠지면 준비 완료로 표시하지 않는다', async () => {
    query.mockResolvedValueOnce([{ runId: 'old', lastBuildingKey: 'z', dateThrough: '2026-09-01', completedAt: null }])
      .mockResolvedValueOnce([]).mockResolvedValueOnce([{ sourceCount: 2, summaryCount: 5 }]);
    await expect(refresh({ types: ['apt-sale'], resume: true, pauseMs: 0 })).rejects.toThrow(/restart backfill/);
    expect(execute.mock.calls.some((c) => c[0].includes('SET completedAt'))).toBe(false);
  });

  it('완료된 실행에 resume이면 변경하지 않는다', async () => {
    query.mockResolvedValueOnce([{ completedAt: new Date() }]);
    await refresh({ types: ['apt-sale'], resume: true });
    expect(query).toHaveBeenCalledTimes(1);
    expect(execute).not.toHaveBeenCalled();
  });

  it.each([{ batchSize: 0 }, { batchSize: 101 }, { pauseMs: -1 }, { bjdCode: "11680'" }, { types: ['bad'] }])('잘못된 옵션은 DB 접근 전에 거부한다: %j', async (options) => {
    await expect(refresh(options)).rejects.toThrow();
    expect(query).not.toHaveBeenCalled();
  });

  it('CLI는 유형·지역·재개 옵션을 파싱하고 알 수 없는 인자를 거부한다', () => {
    expect(parseAreaSummaryArgs(['--type', 'apt-sale,villa-sale', '--bjd-code', '11680', '--resume', '--batch-size', '10', '--pause-ms', '20']))
      .toEqual({ types: ['apt-sale', 'villa-sale'], bjdCode: '11680', resume: true, batchSize: 10, pauseMs: 20 });
    expect(() => parseAreaSummaryArgs(['--type'])).toThrow();
    expect(() => parseAreaSummaryArgs(['--typo', 'x'])).toThrow();
  });
});
