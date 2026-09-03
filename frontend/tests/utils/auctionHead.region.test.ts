// frontend/tests/utils/auctionHead.region.test.ts
import { describe, it, expect } from 'vitest';
import { computeAuctionRegionHead, buildAuctionListTitle, buildAuctionListHeading } from '~/utils/auctionHead';

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

  // H1(화면 제목)과 <title>(검색결과 제목)은 소비처가 다르다.
  // 사이트명 suffix 는 <title> 전용 — H1 에 새면 "부동산 공매 물건 | 일상킷" 이 그대로 보인다.
  it('list 헤딩엔 사이트명 suffix 가 없다', () => {
    expect(buildAuctionListHeading('')).toBe('부동산 공매 물건');
    expect(buildAuctionListHeading('land')).toBe('토지 공매 물건');
    expect(buildAuctionListHeading('')).not.toContain('일상킷');
    expect(buildAuctionListHeading('land')).not.toContain('|');
  });

  it('list 타이틀은 헤딩에 사이트명을 붙인 형태', () => {
    for (const usage of ['', 'land', 'residential', 'nonexistent']) {
      expect(buildAuctionListTitle(usage)).toBe(`${buildAuctionListHeading(usage)} | 일상킷`);
    }
  });
});
