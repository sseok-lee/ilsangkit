// backend/__tests__/scripts/syncAuction.result.test.ts
import { describe, it, expect } from 'vitest';
import { mapDetailResult, type DetailItemRaw } from '../../src/scripts/syncAuction.js';

// prcnBidClgList helper — 회차별 이전입찰결과 항목 하나짜리 detail item
function mkDetail(entry: {
  cltrOpbdDt?: string;
  pbctStatNm?: string;
  scfbAmt?: unknown;
}): DetailItemRaw {
  return { prcnBidClgList: [entry] };
}

describe('mapDetailResult (prcnBidClgList 기반)', () => {
  it('낙찰 결과(scfbAmt 있음) → sold + bidRate', () => {
    const r = mapDetailResult(
      mkDetail({ cltrOpbdDt: '202401111100', pbctStatNm: '낙찰', scfbAmt: '850000000' }),
      1000000000n,
    );
    expect(r.resultType).toBe('sold');
    expect(r.winBidPrc).toBe(850000000n);
    expect(r.bidRate).toBe(85); // 850/1000*100
    expect(r.isClosed).toBe(true);
    expect(r.status).toBe('sold');
    expect(r.resultDate?.getUTCFullYear()).toBe(2024);
  });

  it('pbctStatNm 매각이어도 → sold', () => {
    const r = mapDetailResult(
      mkDetail({ cltrOpbdDt: '202403011000', pbctStatNm: '매각', scfbAmt: '500000000' }),
      600000000n,
    );
    expect(r.resultType).toBe('sold');
    expect(r.winBidPrc).toBe(500000000n);
  });

  it('유찰 → failed, 낙찰가 null', () => {
    const r = mapDetailResult(
      mkDetail({ cltrOpbdDt: '202401111100', pbctStatNm: '유찰' }),
      1000000000n,
    );
    expect(r.resultType).toBe('failed');
    expect(r.winBidPrc).toBeNull();
    expect(r.bidRate).toBeNull();
    expect(r.status).toBe('failed');
  });

  it('취소 → cancelled', () => {
    const r = mapDetailResult(
      mkDetail({ cltrOpbdDt: '202401111100', pbctStatNm: '취소' }),
      null,
    );
    expect(r.resultType).toBe('cancelled');
    expect(r.status).toBe('cancelled');
  });

  it('해제 → cancelled', () => {
    expect(
      mapDetailResult(mkDetail({ pbctStatNm: '해제' }), null).resultType,
    ).toBe('cancelled');
  });

  it('취하 → cancelled', () => {
    expect(
      mapDetailResult(mkDetail({ pbctStatNm: '취하' }), null).resultType,
    ).toBe('cancelled');
  });

  it('결과 미상 → closed 보존(resultType null)', () => {
    const r = mapDetailResult(mkDetail({ cltrOpbdDt: '202401111100', pbctStatNm: '기타' }), null);
    expect(r.isClosed).toBe(true);
    expect(r.resultType).toBeNull();
    expect(r.status).toBe('closed');
  });

  it('prcnBidClgList 없음(빈 결과) → closed, resultType null', () => {
    const r = mapDetailResult({}, null);
    expect(r.isClosed).toBe(true);
    expect(r.resultType).toBeNull();
    expect(r.status).toBe('closed');
  });

  it('prcnBidClgList:"" (빈 문자열) → closed', () => {
    const r = mapDetailResult({ prcnBidClgList: '' }, null);
    expect(r.resultType).toBeNull();
  });

  it('여러 회차 중 cltrOpbdDt 최신 회차를 채택', () => {
    const detail: DetailItemRaw = {
      prcnBidClgList: [
        { cltrOpbdDt: '202401011000', pbctStatNm: '유찰' },
        { cltrOpbdDt: '202403011000', pbctStatNm: '낙찰', scfbAmt: '700000000' },
      ],
    };
    const r = mapDetailResult(detail, 1000000000n);
    expect(r.resultType).toBe('sold');
    expect(r.winBidPrc).toBe(700000000n);
  });

  it('apslAssAmt null이면 bidRate null', () => {
    const r = mapDetailResult(
      mkDetail({ pbctStatNm: '낙찰', scfbAmt: '500000000' }),
      null,
    );
    expect(r.resultType).toBe('sold');
    expect(r.bidRate).toBeNull();
  });
});
