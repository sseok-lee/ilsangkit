// frontend/tests/utils/auctionHead.region.test.ts
import { describe, it, expect } from 'vitest';
import { computeAuctionRegionHead, buildAuctionListTitle } from '~/utils/auctionHead';

describe('시군구 집계 SEO', () => {
  it('isIndexable=false면 noindex+canonical 생략', () => {
    const head = computeAuctionRegionHead({ city: '서울', district: '강남구', isIndexable: false, avgBidRate: null, activeCount: 1 }, 'https://ilsangkit.co.kr/auction/seoul/gangnam-gu');
    expect(head.meta.some((m: any) => m.name === 'robots')).toBe(true);
    expect((head as any).link).toBeUndefined();
  });
  it('isIndexable=true면 canonical 출력', () => {
    const head = computeAuctionRegionHead({ city: '서울', district: '강남구', isIndexable: true, avgBidRate: 82, activeCount: 10 }, 'https://ilsangkit.co.kr/auction/seoul/gangnam-gu');
    expect((head as any).link[0].rel).toBe('canonical');
  });
  it('list 타이틀 용도별', () => {
    expect(buildAuctionListTitle('land')).toContain('토지');
    expect(buildAuctionListTitle('')).toContain('공매');
  });
});
