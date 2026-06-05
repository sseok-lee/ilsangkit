// backend/__tests__/scripts/syncAuction.summary.test.ts
import { describe, it, expect } from 'vitest';
import { computeAuctionSummary, type ItemForSummary } from '../../src/scripts/syncAuction.js';

const mk = (o: Partial<ItemForSummary>): ItemForSummary => ({
  isClosed: false, resultType: null, apslAssAmt: 0, winBidPrc: null, resultDate: null, ...o,
});

describe('computeAuctionSummary', () => {
  it('진행중만 있으면 activeCount만, 낙찰가율 null', () => {
    const r = computeAuctionSummary([mk({}), mk({})]);
    expect(r.activeCount).toBe(2);
    expect(r.soldCount).toBe(0);
    expect(r.avgBidRate).toBeNull();
  });
  it('낙찰 3건 평균 낙찰가율 계산 + isIndexable', () => {
    const sold = [
      mk({ isClosed: true, resultType: 'sold', apslAssAmt: 1000, winBidPrc: 800 }),
      mk({ isClosed: true, resultType: 'sold', apslAssAmt: 1000, winBidPrc: 900 }),
      mk({ isClosed: true, resultType: 'sold', apslAssAmt: 1000, winBidPrc: 1000 }),
    ];
    const r = computeAuctionSummary(sold);
    expect(r.soldCount).toBe(3);
    expect(r.closedCount).toBe(3);
    expect(r.avgBidRate).toBe(90); // (80+90+100)/3
    expect(r.isIndexable).toBe(true); // soldCount>=3
  });
  it('유찰은 failRate에 반영, 낙찰가율 계산서 제외', () => {
    const r = computeAuctionSummary([
      mk({ isClosed: true, resultType: 'failed', apslAssAmt: 1000 }),
      mk({ isClosed: true, resultType: 'sold', apslAssAmt: 1000, winBidPrc: 500 }),
    ]);
    expect(r.failRate).toBe(50);
    expect(r.avgBidRate).toBe(50);
  });
  it('soldCount<3이어도 closedCount>=5면 isIndexable', () => {
    const arr = Array.from({ length: 5 }, () => mk({ isClosed: true, resultType: 'failed', apslAssAmt: 1 }));
    expect(computeAuctionSummary(arr).isIndexable).toBe(true);
  });
});
