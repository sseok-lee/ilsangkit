import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockExecuteRawUnsafe } = vi.hoisted(() => ({
  mockExecuteRawUnsafe: vi.fn(),
}));

vi.mock('../../src/lib/prisma.js', () => ({
  prisma: { $executeRawUnsafe: mockExecuteRawUnsafe },
  default: { $executeRawUnsafe: mockExecuteRawUnsafe },
}));

import { refreshSummary, refreshAllSummaries } from '../../src/services/realEstateSummaryService.js';
import { TABLE_NAME_MAP } from '../../src/services/realEstateService.js';

describe('refreshSummary', () => {
  beforeEach(() => {
    mockExecuteRawUnsafe.mockReset();
    mockExecuteRawUnsafe.mockResolvedValue(0);
  });

  it('알 수 없는 타입은 throw', async () => {
    await expect(refreshSummary('unknown-type')).rejects.toThrow(/Unknown real estate type/);
  });

  it('각 쿼리 앞에 MAX_EXECUTION_TIME 세션 타임아웃을 선행 실행', async () => {
    mockExecuteRawUnsafe.mockResolvedValueOnce(0); // SET (before DELETE)
    mockExecuteRawUnsafe.mockResolvedValueOnce(5); // DELETE
    mockExecuteRawUnsafe.mockResolvedValueOnce(0); // SET (before INSERT)
    mockExecuteRawUnsafe.mockResolvedValueOnce(42); // INSERT

    await refreshSummary('apt-sale');

    expect(mockExecuteRawUnsafe).toHaveBeenCalledTimes(4);
    const calls = mockExecuteRawUnsafe.mock.calls.map((c) => String(c[0]));
    expect(calls[0]).toContain('SET SESSION MAX_EXECUTION_TIME');
    expect(calls[1]).toContain('DELETE FROM RealEstateBuildingSummary');
    expect(calls[2]).toContain('SET SESSION MAX_EXECUTION_TIME');
    expect(calls[3]).toContain('INSERT INTO RealEstateBuildingSummary');
  });

  it('단일 $transaction 래퍼 없이 DELETE/INSERT를 순차 실행', async () => {
    // 과거엔 prisma.$transaction으로 감쌌음 — 이제 호출되지 않아야 함.
    // $transaction을 mock 하지 않았음에도 정상 동작하는지로 간접 검증.
    await refreshSummary('villa-rent');
    // 4번 모두 $executeRawUnsafe 경로만 사용
    expect(mockExecuteRawUnsafe).toHaveBeenCalledTimes(4);
  });

  it('INSERT 결과값(숫자)을 반환', async () => {
    mockExecuteRawUnsafe
      .mockResolvedValueOnce(0)   // SET
      .mockResolvedValueOnce(5)   // DELETE
      .mockResolvedValueOnce(0)   // SET
      .mockResolvedValueOnce(123); // INSERT

    const inserted = await refreshSummary('offitel-sale');

    expect(inserted).toBe(123);
  });

  it('DELETE가 실패하면 같은 타입의 INSERT도 실행되지 않고 에러 전파', async () => {
    mockExecuteRawUnsafe
      .mockResolvedValueOnce(0)               // SET
      .mockRejectedValueOnce(new Error('lock timeout')); // DELETE 실패

    await expect(refreshSummary('apt-rent')).rejects.toThrow('lock timeout');
    expect(mockExecuteRawUnsafe).toHaveBeenCalledTimes(2);
  });
});

describe('refreshAllSummaries', () => {
  beforeEach(() => {
    mockExecuteRawUnsafe.mockReset();
    mockExecuteRawUnsafe.mockResolvedValue(0);
  });

  it('TABLE_NAME_MAP의 모든 타입에 대해 refreshSummary를 호출', async () => {
    await refreshAllSummaries();

    const types = Object.keys(TABLE_NAME_MAP);
    // 타입별로 SET(x2) + DELETE + INSERT = 4 호출
    expect(mockExecuteRawUnsafe).toHaveBeenCalledTimes(types.length * 4);

    // 각 타입에 해당하는 DELETE 호출이 있는지 확인
    const deleteCalls = mockExecuteRawUnsafe.mock.calls.filter(
      (c) => String(c[0]).includes('DELETE FROM RealEstateBuildingSummary')
    );
    expect(deleteCalls).toHaveLength(types.length);

    const deleteTypeArgs = new Set(deleteCalls.map((c) => c[1]));
    for (const type of types) {
      expect(deleteTypeArgs.has(type)).toBe(true);
    }
  });

  it('한 타입이 실패해도 나머지 타입은 계속 처리', async () => {
    // 에러 출력을 테스트 로그에 섞이지 않게 suppress
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // apt-sale(첫 타입)의 DELETE만 실패시키고 나머지는 정상
    let callCount = 0;
    mockExecuteRawUnsafe.mockImplementation(async (sql: string) => {
      callCount++;
      // 두 번째 호출(첫 타입의 DELETE)만 실패
      if (callCount === 2 && sql.includes('DELETE')) {
        throw new Error('simulated failure');
      }
      return 0;
    });

    await refreshAllSummaries();

    const types = Object.keys(TABLE_NAME_MAP);
    // 첫 타입은 SET + DELETE(fail) = 2 호출, 나머지 5타입은 각 4 호출 = 22 총합
    expect(mockExecuteRawUnsafe).toHaveBeenCalledTimes(2 + (types.length - 1) * 4);
    expect(errorSpy).toHaveBeenCalled();

    errorSpy.mockRestore();
  });
});
