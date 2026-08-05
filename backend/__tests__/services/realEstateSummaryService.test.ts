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

  it('윈도우 함수(COUNT/MAX)는 inner 서브쿼리에 위치 — _rn=1 필터 전에 평가되어야 함', async () => {
    mockQueryRawUnsafe.mockResolvedValueOnce([{ city: '서울' }]);
    mockExecuteRawUnsafe.mockResolvedValue(1);

    await refreshSummary('apt-sale');

    const insertSql = String(mockExecuteRawUnsafe.mock.calls[2][0]);

    // outer SELECT는 별칭만 참조 — COUNT(*) OVER 자체가 outer에 있으면 안 됨
    const outerMatch = insertSql.match(/SELECT([\s\S]+?)FROM\s+\(/i);
    expect(outerMatch).not.toBeNull();
    expect(outerMatch![1]).toContain('_txCount AS transactionCount');
    expect(outerMatch![1]).toContain('_maxLat AS lat');
    expect(outerMatch![1]).toContain('_maxLng AS lng');
    expect(outerMatch![1]).not.toMatch(/COUNT\(\*\)\s+OVER/i);

    // inner 서브쿼리에 ROW_NUMBER + COUNT + MAX 모두 존재
    const innerMatch = insertSql.match(/FROM\s+\(([\s\S]+?)\)\s+ranked/i);
    expect(innerMatch).not.toBeNull();
    expect(innerMatch![1]).toMatch(/ROW_NUMBER\(\)\s+OVER/i);
    expect(innerMatch![1]).toMatch(/COUNT\(\*\)\s+OVER[\s\S]+?AS\s+_txCount/i);
    expect(innerMatch![1]).toMatch(/MAX\(lat\)\s+OVER[\s\S]+?AS\s+_maxLat/i);
    expect(innerMatch![1]).toMatch(/MAX\(lng\)\s+OVER[\s\S]+?AS\s+_maxLng/i);
  });

  // monthlyRent: 전월세는 소스 컬럼을 담고, 매매는 NULL 이어야 한다.
  //
  // latestPrice 는 매매면 dealAmount, 전월세면 deposit(보증금)이라 월세가 담기지 않았다.
  // 그래서 인근 단지 rent 경로가 summary 를 못 쓰고 320만 행 거래 테이블에 ROW_NUMBER()
  // 윈도우를 돌렸고, 야간 sync 부하와 겹치면 30초 타임아웃이 났다(2026-08-03).
  // 매매 테이블에는 monthlyRent 컬럼 자체가 없으므로 NULL 리터럴이어야 한다 —
  // 컬럼명을 그대로 쓰면 Unknown column 으로 INSERT 가 통째로 실패한다.
  it('전월세는 monthlyRent 소스 컬럼을 SELECT 한다', async () => {
    mockQueryRawUnsafe.mockResolvedValueOnce([{ city: '서울' }]);
    mockExecuteRawUnsafe.mockResolvedValue(1);

    await refreshSummary('apt-rent');

    const sql = String(mockExecuteRawUnsafe.mock.calls[2][0]);
    expect(sql).toMatch(/\(\s*type,[\s\S]*?latestPrice,\s*monthlyRent,/i);
    expect(sql).toMatch(/monthlyRent\s+AS\s+monthlyRent/i);
    expect(sql).not.toMatch(/NULL\s+AS\s+monthlyRent/i);
  });

  it('매매는 monthlyRent 를 NULL 리터럴로 넣는다 (소스에 컬럼 없음)', async () => {
    mockQueryRawUnsafe.mockResolvedValueOnce([{ city: '서울' }]);
    mockExecuteRawUnsafe.mockResolvedValue(1);

    await refreshSummary('apt-sale');

    const sql = String(mockExecuteRawUnsafe.mock.calls[2][0]);
    expect(sql).toMatch(/NULL\s+AS\s+monthlyRent/i);
  });

  it('INSERT 컬럼 목록과 SELECT 식 개수가 어긋나지 않는다', async () => {
    // 컬럼 하나를 추가하면서 한쪽만 고치면 런타임에야 터진다.
    mockQueryRawUnsafe.mockResolvedValueOnce([{ city: '서울' }]);
    mockExecuteRawUnsafe.mockResolvedValue(1);

    await refreshSummary('villa-rent');

    // SQL 주석(-- …)에도 콤마가 있어(예: "outer에 있으므로,") 먼저 걷어낸다.
    const sql = String(mockExecuteRawUnsafe.mock.calls[2][0]).replace(/--[^\n]*/g, '');
    const cols = sql.match(/RealEstateBuildingSummary\s*\(([\s\S]+?)\)\s*SELECT/i);
    expect(cols).not.toBeNull();
    const colCount = cols![1].split(',').length;

    const outer = sql.match(/SELECT([\s\S]+?)FROM\s+\(/i);
    expect(outer).not.toBeNull();
    // 최상위 콤마만 센다 (윈도우 함수 괄호 안 콤마 제외)
    let depth = 0, exprCount = 1;
    for (const ch of outer![1]) {
      if (ch === '(') depth++;
      else if (ch === ')') depth--;
      else if (ch === ',' && depth === 0) exprCount++;
    }
    expect(exprCount).toBe(colCount);
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

  it('각 트랜잭션에 5분(300초) timeout 옵션이 전달됨', async () => {
    mockQueryRawUnsafe.mockResolvedValueOnce([{ city: '서울' }]);
    mockExecuteRawUnsafe.mockResolvedValue(1);

    await refreshSummary('apt-rent');

    const options = mockTransaction.mock.calls[0][1];
    expect(options).toMatchObject({ timeout: 300_000 });
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

describe('refreshSummary — 전세/월세 분리 컬럼 UPDATE 패스', () => {
  beforeEach(() => {
    mockExecuteRawUnsafe.mockReset();
    mockQueryRawUnsafe.mockReset();
    mockTransaction.mockReset();
    setupTransactionPassthrough();
  });

  /** 트랜잭션 안에서 실행된 SQL 문자열만 순서대로 뽑는다. */
  function executedSql(): string[] {
    return mockExecuteRawUnsafe.mock.calls.map((c) => String(c[0]));
  }

  it('전월세 타입은 city 배치마다 DELETE, INSERT, UPDATE 순으로 3개를 실행한다', async () => {
    mockQueryRawUnsafe.mockResolvedValueOnce([{ city: '서울' }]);
    mockExecuteRawUnsafe.mockResolvedValue(1);

    await refreshSummary('apt-rent');

    const sql = executedSql();
    // [0] 은 SET SESSION innodb_lock_wait_timeout
    expect(sql[1]).toContain('DELETE FROM RealEstateBuildingSummary');
    expect(sql[2]).toContain('INSERT INTO RealEstateBuildingSummary');
    expect(sql[3]).toContain('UPDATE RealEstateBuildingSummary');
  });

  it('매매 타입은 UPDATE 패스를 건너뛴다 — 매매 테이블에는 rentType 컬럼이 없다', async () => {
    mockQueryRawUnsafe.mockResolvedValueOnce([{ city: '서울' }]);
    mockExecuteRawUnsafe.mockResolvedValue(1);

    await refreshSummary('apt-sale');

    expect(executedSql().some((s) => s.includes('UPDATE RealEstateBuildingSummary'))).toBe(false);
  });

  it('UPDATE 는 rentType 별 최신 1건을 골라 5개 컬럼을 채운다', async () => {
    mockQueryRawUnsafe.mockResolvedValueOnce([{ city: '서울' }]);
    mockExecuteRawUnsafe.mockResolvedValue(1);

    await refreshSummary('apt-rent');

    const update = executedSql().find((s) => s.includes('UPDATE RealEstateBuildingSummary'))!;
    // rentType 축을 넣은 ROW_NUMBER 로 종류별 최신을 고른 뒤 rn=1 만 남긴다.
    expect(update).toContain('PARTITION BY buildingName, bjdCode, rentType');
    expect(update).toContain('rn = 1');
    for (const col of ['jeonseDeposit', 'jeonseDealKey', 'wolseDeposit', 'wolseMonthlyRent', 'wolseDealKey']) {
      expect(update).toContain(col);
    }
  });

  it('UPDATE 는 해당 type·city 로만 범위를 좁힌다 — 다른 시·도 행을 건드리면 배치 분할이 무의미해진다', async () => {
    mockQueryRawUnsafe.mockResolvedValueOnce([{ city: '서울' }]);
    mockExecuteRawUnsafe.mockResolvedValue(1);

    await refreshSummary('apt-rent');

    const idx = executedSql().findIndex((s) => s.includes('UPDATE RealEstateBuildingSummary'));
    const params = mockExecuteRawUnsafe.mock.calls[idx].slice(1);
    expect(params).toContain('apt-rent');
    expect(params).toContain('서울');
  });

  it('UPDATE 가 실패해도 다음 city 로 계속한다 — 한 배치 실패가 전체를 멈추지 않는다', async () => {
    mockQueryRawUnsafe.mockResolvedValueOnce([{ city: '서울' }, { city: '경기' }]);
    mockExecuteRawUnsafe.mockImplementation(async (sql: string) => {
      if (String(sql).includes('UPDATE') && mockExecuteRawUnsafe.mock.calls.length <= 4) {
        throw new Error('lock wait timeout');
      }
      return 1;
    });

    await expect(refreshSummary('apt-rent')).resolves.toBeTypeOf('number');
    expect(mockQueryRawUnsafe).toHaveBeenCalledTimes(1);
  });
});
