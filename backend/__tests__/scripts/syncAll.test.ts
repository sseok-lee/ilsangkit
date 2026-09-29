// @TASK T2.4 - 통합 동기화 스케줄러 테스트
// @SPEC docs/planning/02-trd.md#데이터-동기화

import { beforeEach, describe, expect, it, vi } from 'vitest';

const syncTrashData = vi.hoisted(() => vi.fn());
const publishWasteGeneration = vi.hoisted(() => vi.fn());
const refreshAllSummaries = vi.hoisted(() => vi.fn());

vi.mock('../../src/scripts/syncTrash.js', () => ({
  syncTrashData,
}));

vi.mock('../../src/services/wastePublicationService.js', () => ({
  publishWasteGeneration,
}));

vi.mock('../../src/services/realEstateSummaryService.js', () => ({
  refreshAllSummaries,
}));

/**
 * 옵션 파싱 테스트
 */
describe('syncAll CLI 옵션 파싱', () => {
  it('--only 옵션으로 특정 카테고리만 선택', () => {
    const args = ['--only', 'toilet,wifi'];
    const allCategories = ['toilet', 'trash', 'wifi', 'clothes', 'park'];

    // --only 옵션 처리
    const onlyIndex = args.indexOf('--only');
    let categoriesToSync = [...allCategories];

    if (onlyIndex !== -1 && args[onlyIndex + 1]) {
      const onlyCategories = args[onlyIndex + 1].split(',');
      categoriesToSync = categoriesToSync.filter(c => onlyCategories.includes(c));
    }

    expect(categoriesToSync).toEqual(['toilet', 'wifi']);
  });

  it('--skip 옵션으로 특정 카테고리 제외', () => {
    const args = ['--skip', 'park'];
    const allCategories = ['toilet', 'trash', 'wifi', 'clothes', 'park'];

    // --skip 옵션 처리
    const skipIndex = args.indexOf('--skip');
    let categoriesToSync = [...allCategories];

    if (skipIndex !== -1 && args[skipIndex + 1]) {
      const skipCategories = args[skipIndex + 1].split(',');
      categoriesToSync = categoriesToSync.filter(c => !skipCategories.includes(c));
    }

    expect(categoriesToSync).toEqual(['toilet', 'trash', 'wifi', 'clothes']);
  });

  it('--only와 --skip 혼용 시 --only 우선', () => {
    const args = ['--only', 'toilet,wifi,trash', '--skip', 'wifi'];
    const allCategories = ['toilet', 'trash', 'wifi', 'clothes', 'park'];

    let categoriesToSync = [...allCategories];

    // --only 먼저 처리
    const onlyIndex = args.indexOf('--only');
    if (onlyIndex !== -1 && args[onlyIndex + 1]) {
      const onlyCategories = args[onlyIndex + 1].split(',');
      categoriesToSync = categoriesToSync.filter(c => onlyCategories.includes(c));
    }

    // --skip 나중에 처리
    const skipIndex = args.indexOf('--skip');
    if (skipIndex !== -1 && args[skipIndex + 1]) {
      const skipCategories = args[skipIndex + 1].split(',');
      categoriesToSync = categoriesToSync.filter(c => !skipCategories.includes(c));
    }

    expect(categoriesToSync).toEqual(['toilet', 'trash']);
  });
});

/**
 * 결과 집계 테스트
 */
describe('syncAll 결과 집계', () => {
  it('성공/실패 카운트 정확히 계산', () => {
    const results = [
      { category: 'toilet', success: true, duration: 1000 },
      { category: 'trash', success: true, duration: 2000 },
      { category: 'wifi', success: false, error: 'Network error', duration: 500 },
      { category: 'clothes', success: true, duration: 1500 },
      { category: 'park', success: true, duration: 3000 },
    ];

    const success = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    expect(success).toBe(4);
    expect(failed).toBe(1);
  });

  it('실패한 카테고리 목록 추출', () => {
    const results = [
      { category: 'toilet', success: true, duration: 1000 },
      { category: 'trash', success: false, error: 'Network error', duration: 500 },
      { category: 'wifi', success: false, error: 'API key missing', duration: 100 },
    ];

    const failedResults = results.filter(r => !r.success);
    const failedCategories = failedResults.map(r => r.category);

    expect(failedCategories).toEqual(['trash', 'wifi']);
  });

  it('모든 동기화 성공 시 exitCode 0', () => {
    const results = [
      { category: 'toilet', success: true, duration: 1000 },
      { category: 'trash', success: true, duration: 2000 },
    ];

    const failed = results.filter(r => !r.success).length;
    const exitCode = failed > 0 ? 1 : 0;

    expect(exitCode).toBe(0);
  });

  it('일부 실패 시 exitCode 1', () => {
    const results = [
      { category: 'toilet', success: true, duration: 1000 },
      { category: 'trash', success: false, error: 'Error', duration: 500 },
    ];

    const failed = results.filter(r => !r.success).length;
    const exitCode = failed > 0 ? 1 : 0;

    expect(exitCode).toBe(1);
  });
});

describe('syncAll 쓰레기 후보 준비', () => {
  const env = {
    OPENAPI_SERVICE_KEY: 'test-key',
    WASTE_REFERENCE_PATH: '/tmp/reference.json',
    WASTE_REFERENCE_MANIFEST_PATH: '/tmp/manifest.json',
    WASTE_REFERENCE_CHECKSUMS_PATH: '/tmp/checksums.json',
    WASTE_REPORT_OUT: '/tmp/report.json',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    refreshAllSummaries.mockResolvedValue({ done: ['apt-sale'], failed: [], total: 1 });
    syncTrashData.mockResolvedValue({
      totalRecords: 12,
      newRecords: 0,
      updatedRecords: 0,
      skippedRecords: 0,
      status: 'prepared',
      generationId: 'prepared-generation',
      reportHash: 'a'.repeat(64),
      canPublish: true,
    });
  });

  it('passes validated trash options and treats prepared candidates as success without publishing', async () => {
    const { runSyncAll } = await import('../../src/scripts/syncAll.js');

    const result = await runSyncAll({
      argv: ['--only', 'trash'],
      env,
      waitMs: 0,
      logger: silentLogger(),
    });

    expect(result.exitCode).toBe(0);
    expect(syncTrashData).toHaveBeenCalledWith(expect.objectContaining({
      serviceKey: 'test-key',
      referenceInput: {
        referencePath: '/tmp/reference.json',
        manifestPath: '/tmp/manifest.json',
        checksumsPath: '/tmp/checksums.json',
      },
      reportOut: '/tmp/report.json',
      dryRun: false,
    }));
    expect(result.results[0]).toMatchObject({
      category: 'trash',
      success: true,
      count: 12,
      status: 'prepared',
      generationId: 'prepared-generation',
      canPublish: true,
    });
    expect(publishWasteGeneration).not.toHaveBeenCalled();
  });

  it('keeps prepared status when review says it cannot be published and logs the state', async () => {
    const logger = silentLogger();
    syncTrashData.mockResolvedValueOnce({
      totalRecords: 3,
      newRecords: 0,
      updatedRecords: 0,
      skippedRecords: 0,
      status: 'prepared',
      generationId: 'needs-review-generation',
      reportHash: 'b'.repeat(64),
      canPublish: false,
    });
    const { runSyncAll } = await import('../../src/scripts/syncAll.js');

    const result = await runSyncAll({
      argv: ['--only', 'trash'],
      env,
      waitMs: 0,
      logger,
    });

    expect(result.exitCode).toBe(0);
    expect(result.results[0]).toMatchObject({
      success: true,
      status: 'prepared',
      canPublish: false,
    });
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('공개 불가'));
    expect(publishWasteGeneration).not.toHaveBeenCalled();
  });

  it('records trash option failures, continues with later categories, and returns exit 1', async () => {
    const { runSyncAll } = await import('../../src/scripts/syncAll.js');

    const result = await runSyncAll({
      argv: ['--only', 'trash,wifi'],
      env: { OPENAPI_SERVICE_KEY: 'test-key' },
      waitMs: 0,
      logger: silentLogger(),
      categoryRunner: async (category) => ({
        category,
        success: true,
        count: 1,
        duration: 1,
      }),
    });

    expect(result.exitCode).toBe(1);
    expect(result.results.map((item) => item.category)).toEqual(['trash', 'wifi']);
    expect(result.results[0]).toMatchObject({ category: 'trash', success: false });
    expect(result.results[1]).toMatchObject({ category: 'wifi', success: true });
  });

  it('rejects integrated dry-run before starting when categories other than trash are included', async () => {
    const { runSyncAll } = await import('../../src/scripts/syncAll.js');

    await expect(runSyncAll({
      argv: ['--only', 'trash,wifi', '--dry-run'],
      env,
      waitMs: 0,
      logger: silentLogger(),
    })).rejects.toThrow(/--only trash --dry-run/);

    expect(syncTrashData).not.toHaveBeenCalled();
  });

  it('rejects legacy publication flags in integrated trash sync before invoking trash collection', async () => {
    const { runSyncAll } = await import('../../src/scripts/syncAll.js');

    const result = await runSyncAll({
      argv: [
        '--only',
        'trash',
        `--approval-report-hash=${'a'.repeat(64)}`,
        '--expected-base',
        'active-generation',
      ],
      env,
      waitMs: 0,
      logger: silentLogger(),
    });

    expect(result.exitCode).toBe(1);
    expect(result.results[0]).toMatchObject({
      category: 'trash',
      success: false,
      error: expect.stringMatching(/waste:publish/i),
    });
    expect(syncTrashData).not.toHaveBeenCalled();
    expect(publishWasteGeneration).not.toHaveBeenCalled();
  });

  it('refreshes summaries after successful real estate collection through the shared mode-aware entrypoint', async () => {
    const { runSyncAll } = await import('../../src/scripts/syncAll.js');

    const result = await runSyncAll({
      argv: ['--only', 'wifi'],
      env,
      waitMs: 0,
      logger: silentLogger(),
      categoryRunner: async (category) => ({
        category: 'apt-sale',
        success: true,
        count: 2,
        duration: 1,
      }),
    });

    expect(result.exitCode).toBe(0);
    expect(refreshAllSummaries).toHaveBeenCalledTimes(1);
  });
});

function silentLogger() {
  return {
    log: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}
