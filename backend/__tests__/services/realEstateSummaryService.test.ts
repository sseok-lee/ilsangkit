import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockExecuteRawUnsafe, mockQueryRawUnsafe, mockTransaction } = vi.hoisted(() => ({
  mockExecuteRawUnsafe: vi.fn(),
  mockQueryRawUnsafe: vi.fn(),
  mockTransaction: vi.fn(),
}));

vi.mock('../../src/lib/prisma.js', () => {
  const prisma = {
    $executeRawUnsafe: mockExecuteRawUnsafe,
    $queryRawUnsafe: mockQueryRawUnsafe,
    $transaction: mockTransaction,
  };
  return { prisma, default: prisma };
});

import { refreshSummary, refreshAllSummaries } from '../../src/services/realEstateSummaryService.js';
import { TABLE_NAME_MAP } from '../../src/services/realEstateService.js';

// 기본 동작: $transaction은 콜백을 그대로 실행하고 결과를 반환.
// 내부 tx는 $executeRawUnsafe만 mock.
function setupTransactionPassthrough() {
  mockTransaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => {
    const tx = { $executeRawUnsafe: mockExecuteRawUnsafe };
    return await cb(tx);
  });
}

describe('refreshSummary (city-chunked)', () => {
  beforeEach(() => {
    mockExecuteRawUnsafe.mockReset();
    mockQueryRawUnsafe.mockReset();
    mockTransaction.mockReset();
    setupTransactionPassthrough();
  });

  it('알 수 없는 타입은 throw', async () => {
    await expect(refreshSummary('unknown-type')).rejects.toThrow(/Unknown real estate type/);
  });

  it('먼저 DISTINCT city를 조회하고, city가 없으면 트랜잭션도 없고 0 반환', async () => {
    mockQueryRawUnsafe.mockResolvedValueOnce([]);

    const count = await refreshSummary('apt-sale');

    expect(count).toBe(0);
    expect(mockQueryRawUnsafe).toHaveBeenCalledTimes(1);
    expect(String(mockQueryRawUnsafe.mock.calls[0][0])).toMatch(/SELECT\s+DISTINCT\s+city/i);
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('null/빈 문자열 city는 필터링', async () => {
    mockQueryRawUnsafe.mockResolvedValueOnce([
      { city: '서울' },
      { city: null },
      { city: '' },
      { city: '경기' },
    ]);
    mockExecuteRawUnsafe.mockResolvedValue(5); // SET/DELETE/INSERT 모두 5 반환

    await refreshSummary('villa-rent');

    // 서울, 경기 2개 city만 처리
    expect(mockTransaction).toHaveBeenCalledTimes(2);
  });

  it('각 city마다 별도 $transaction으로 SET lock_wait_timeout + DELETE + INSERT 순차 실행', async () => {
    mockQueryRawUnsafe.mockResolvedValueOnce([{ city: '서울' }, { city: '부산' }]);
    mockExecuteRawUnsafe.mockResolvedValue(42);

    await refreshSummary('apt-sale');

    // $transaction은 city 수(=2)만큼
    expect(mockTransaction).toHaveBeenCalledTimes(2);
    // $executeRawUnsafe는 city당 3회(SET, DELETE, INSERT) × 2 city = 6회
    expect(mockExecuteRawUnsafe).toHaveBeenCalledTimes(6);

    const calls = mockExecuteRawUnsafe.mock.calls.map((c) => String(c[0]));
    expect(calls[0]).toContain('SET SESSION innodb_lock_wait_timeout');
    expect(calls[1]).toContain('DELETE FROM RealEstateBuildingSummary');
    expect(calls[1]).toContain('city = ?');
    expect(calls[2]).toContain('INSERT INTO RealEstateBuildingSummary');
    expect(calls[2]).toContain('WHERE city = ?');

    // city 인자 전달 확인
    expect(mockExecuteRawUnsafe.mock.calls[1][2]).toBe('서울'); // DELETE 첫 city
    expect(mockExecuteRawUnsafe.mock.calls[4][2]).toBe('부산'); // DELETE 두번째 city
  });

  it('MAX_EXECUTION_TIME은 더 이상 쓰지 않음 (MySQL에서 DML에 미적용)', async () => {
    mockQueryRawUnsafe.mockResolvedValueOnce([{ city: '서울' }]);
    mockExecuteRawUnsafe.mockResolvedValue(10);

    await refreshSummary('offitel-rent');

    const calls = mockExecuteRawUnsafe.mock.calls.map((c) => String(c[0]));
    for (const sql of calls) {
      expect(sql).not.toContain('MAX_EXECUTION_TIME');
    }
  });

  it('각 트랜잭션에 60초 timeout 옵션이 전달됨', async () => {
    mockQueryRawUnsafe.mockResolvedValueOnce([{ city: '서울' }]);
    mockExecuteRawUnsafe.mockResolvedValue(1);

    await refreshSummary('apt-rent');

    const options = mockTransaction.mock.calls[0][1];
    expect(options).toMatchObject({ timeout: 60_000 });
  });

  it('INSERT 결과를 모든 city에 대해 합산하여 반환', async () => {
    mockQueryRawUnsafe.mockResolvedValueOnce([{ city: '서울' }, { city: '경기' }, { city: '부산' }]);
    // city별 INSERT 반환값 → 10, 20, 30
    let insertCallIdx = 0;
    const insertReturns = [10, 20, 30];
    mockExecuteRawUnsafe.mockImplementation(async (sql: string) => {
      if (sql.trim().startsWith('INSERT')) {
        return insertReturns[insertCallIdx++] ?? 0;
      }
      return 0;
    });

    const total = await refreshSummary('villa-sale');

    expect(total).toBe(60); // 10 + 20 + 30
  });

  it('한 city가 실패해도 나머지 city는 계속 처리 (치명적 장애 격리)', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    mockQueryRawUnsafe.mockResolvedValueOnce([{ city: '서울' }, { city: '부산' }, { city: '경기' }]);

    // $transaction 호출 시 두 번째(부산)만 reject
    let txCall = 0;
    mockTransaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => {
      txCall++;
      if (txCall === 2) throw new Error('lock timeout in 부산');
      const tx = { $executeRawUnsafe: mockExecuteRawUnsafe };
      return await cb(tx);
    });
    mockExecuteRawUnsafe.mockResolvedValue(7);

    const total = await refreshSummary('apt-sale');

    // 2개 성공(서울, 경기) × 7 = 14
    expect(total).toBe(14);
    expect(mockTransaction).toHaveBeenCalledTimes(3);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('apt-sale/부산'),
      expect.any(Error),
    );

    errorSpy.mockRestore();
  });

  it('DISTINCT city 조회 자체가 실패하면 에러 전파', async () => {
    mockQueryRawUnsafe.mockRejectedValueOnce(new Error('table not exists'));

    await expect(refreshSummary('apt-sale')).rejects.toThrow('table not exists');
    expect(mockTransaction).not.toHaveBeenCalled();
  });
});

describe('refreshAllSummaries', () => {
  beforeEach(() => {
    mockExecuteRawUnsafe.mockReset();
    mockQueryRawUnsafe.mockReset();
    mockTransaction.mockReset();
    setupTransactionPassthrough();
  });

  it('TABLE_NAME_MAP의 모든 타입에 대해 refreshSummary를 호출', async () => {
    // 각 타입당 city 1개
    mockQueryRawUnsafe.mockResolvedValue([{ city: '서울' }]);
    mockExecuteRawUnsafe.mockResolvedValue(3);

    await refreshAllSummaries();

    const types = Object.keys(TABLE_NAME_MAP);
    // 타입 수만큼 DISTINCT city 쿼리
    expect(mockQueryRawUnsafe).toHaveBeenCalledTimes(types.length);
    // 타입 수만큼 트랜잭션 (city 1개씩)
    expect(mockTransaction).toHaveBeenCalledTimes(types.length);
  });

  it('한 타입의 DISTINCT city 쿼리가 실패해도 나머지 타입은 계속', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const types = Object.keys(TABLE_NAME_MAP);
    let queryCall = 0;
    mockQueryRawUnsafe.mockImplementation(async () => {
      queryCall++;
      if (queryCall === 1) throw new Error('apt-sale query failed');
      return [{ city: '서울' }];
    });
    mockExecuteRawUnsafe.mockResolvedValue(1);

    await refreshAllSummaries();

    // 모든 타입에 대해 DISTINCT city 시도
    expect(mockQueryRawUnsafe).toHaveBeenCalledTimes(types.length);
    // 첫 타입은 트랜잭션 없음, 나머지만
    expect(mockTransaction).toHaveBeenCalledTimes(types.length - 1);
    expect(errorSpy).toHaveBeenCalled();

    errorSpy.mockRestore();
  });
});
