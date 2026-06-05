// backend/__tests__/scripts/syncAuction.result.test.ts
import { describe, it, expect } from 'vitest';
import { mapDetailResult } from '../../src/scripts/syncAuction.js';

describe('mapDetailResult', () => {
  it('낙찰 결과(낙찰가 있음) → sold + bidRate', () => {
    const r = mapDetailResult({ scsbidAmt: '850000000', pbctCltrStatNm: '낙찰' }, 1000000000n);
    expect(r.resultType).toBe('sold');
    expect(r.winBidPrc).toBe(850000000n);
    expect(r.bidRate).toBe(85); // 850/1000*100
    expect(r.isClosed).toBe(true);
  });
  it('유찰 → failed, 낙찰가 null', () => {
    const r = mapDetailResult({ pbctCltrStatNm: '유찰' }, 1000000000n);
    expect(r.resultType).toBe('failed');
    expect(r.winBidPrc).toBeNull();
    expect(r.bidRate).toBeNull();
  });
  it('취소/해제 → cancelled', () => {
    expect(mapDetailResult({ pbctCltrStatNm: '취소' }, null).resultType).toBe('cancelled');
  });
  it('결과 미상이면 closed 보존(resultType null)', () => {
    const r = mapDetailResult({}, null);
    expect(r.isClosed).toBe(true);
    expect(r.resultType).toBeNull();
  });
});
