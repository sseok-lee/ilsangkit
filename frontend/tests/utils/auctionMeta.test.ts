// frontend/tests/utils/auctionMeta.test.ts
import { describe, it, expect } from 'vitest';
import { buildAuctionRegionTitle, buildAuctionItemTitle, AUCTION_META, AUCTION_FAQ } from '~/utils/auctionMeta';

describe('auctionMeta', () => {
  it('지역 타이틀', () => {
    expect(buildAuctionRegionTitle({ city: '서울', district: '강남구' })).toContain('강남구');
    expect(buildAuctionRegionTitle({})).toContain('전국');
  });
  it('물건 타이틀: 진행중=최저가, 마감=낙찰가', () => {
    expect(buildAuctionItemTitle({ address: '강남구 역삼동', usage: '오피스텔', minBidPrc: 210000000, status: 'ongoing' })).toContain('최저입찰가');
    expect(buildAuctionItemTitle({ address: '강남구 역삼동', usage: '오피스텔', winBidPrc: 250000000, status: 'sold' })).toContain('낙찰가');
  });
  it('META/FAQ 존재', () => {
    expect(AUCTION_META.label).toBe('공매');
    expect(AUCTION_FAQ.length).toBeGreaterThanOrEqual(4);
  });
});
