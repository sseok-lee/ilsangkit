import { describe, it, expect, vi, beforeEach } from 'vitest';

// runSync 는 prisma.syncHistory 만 건드리므로 DB 없이 mock 으로 검증한다.
const created = { id: 42 };
const createMock = vi.fn(async () => created);
const updateMock = vi.fn(async () => created);

vi.mock('../../src/lib/prisma.js', () => ({
  prisma: {
    syncHistory: {
      create: (...args: unknown[]) => createMock(...(args as [])),
      update: (...args: unknown[]) => updateMock(...(args as [])),
    },
  },
}));

const { runSync } = await import('../../src/services/baseSyncService.js');

/** updateSyncHistory 로 넘어간 data payload */
function lastUpdateData(): Record<string, unknown> {
  const call = updateMock.mock.calls.at(-1) as unknown as [{ data: Record<string, unknown> }];
  return call[0].data;
}

describe('runSync', () => {
  beforeEach(() => {
    createMock.mockClear();
    updateMock.mockClear();
  });

  it('콜백이 채운 stats 카운터를 SyncHistory 에 기록한다', async () => {
    await runSync('aptSale', async (stats) => {
      stats.totalRecords += 120;
      stats.newRecords += 30;
      stats.updatedRecords += 90;
    });

    const data = lastUpdateData();
    expect(data.status).toBe('success');
    expect(data.totalRecords).toBe(120);
    expect(data.newRecords).toBe(30);
    expect(data.updatedRecords).toBe(90);
  });

  it('수집 0건이면 success 가 아니라 failed 로 기록한다', async () => {
    await expect(
      runSync('aptSale', async () => {
        // 업스트림이 아무것도 주지 않은 상황 — 예외는 안 났지만 성공이 아니다
      })
    ).rejects.toThrow(/0건/);

    const data = lastUpdateData();
    expect(data.status).toBe('failed');
    expect(data.totalRecords).toBe(0);
    expect(String(data.errorMessage)).toMatch(/0건/);
  });

  it('allowEmpty 면 0건이어도 success 로 둔다', async () => {
    await runSync(
      'someCategory',
      async () => {
        /* 정상적으로 0건일 수 있는 카테고리 */
      },
      { allowEmpty: true }
    );

    const data = lastUpdateData();
    expect(data.status).toBe('success');
    expect(data.totalRecords).toBe(0);
  });

  it('콜백이 throw 하면 기존대로 failed 로 기록하고 에러를 전파한다', async () => {
    await expect(
      runSync('aptSale', async () => {
        throw new Error('upstream 500');
      })
    ).rejects.toThrow('upstream 500');

    const data = lastUpdateData();
    expect(data.status).toBe('failed');
    expect(data.errorMessage).toBe('upstream 500');
  });

  it('0건 판정은 totalRecords 기준이다 — 신규 0건이어도 수집됐으면 success', async () => {
    await runSync('aptSale', async (stats) => {
      stats.totalRecords += 2833;
      stats.newRecords += 0;
      stats.updatedRecords += 2833;
    });

    const data = lastUpdateData();
    expect(data.status).toBe('success');
  });
});
