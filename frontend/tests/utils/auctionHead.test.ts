// frontend/tests/utils/auctionHead.test.ts
import { describe, it, expect } from 'vitest';
import { computeAuctionItemHead } from '~/utils/auctionHead';

describe('computeAuctionItemHead', () => {
  it('취소 물건은 noindex + canonical 생략', () => {
    const head = computeAuctionItemHead({ cltrMngNo: 'A', address: '강남구 역삼동', usage: '오피스텔', status: 'cancelled', apslAssAmt: 1, minBidPrc: 1 } as any, 'https://ilsangkit.co.kr/auction/item/A');
    expect(head.meta.some((m: any) => m.name === 'robots' && m.content.includes('noindex'))).toBe(true);
    expect((head as any).link).toBeUndefined();
  });
  it('진행중 물건은 canonical 출력', () => {
    const head = computeAuctionItemHead({ cltrMngNo: 'A', address: '강남구 역삼동', usage: '오피스텔', status: 'ongoing', apslAssAmt: 1, minBidPrc: 1 } as any, 'https://ilsangkit.co.kr/auction/item/A');
    expect(head.meta.some((m: any) => m.name === 'robots')).toBe(false);
    expect((head as any).link[0].rel).toBe('canonical');
  });
});
