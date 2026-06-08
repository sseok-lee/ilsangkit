// frontend/tests/components/auction/AuctionCard.test.ts
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import AuctionCard from '~/components/auction/AuctionCard.vue';

const item = {
  cltrMngNo: '6012880', pbctCdtnNo: '1', address: '서울특별시 강남구 역삼동 123',
  usage: '오피스텔', usageGroup: 'residential', propertyType: '압류재산', district: '강남구',
  apslAssAmt: 300000000, minBidPrc: 210000000, failCnt: 2, bidRound: 7,
  bidBeginDtm: '2026-12-01T11:00:00.000Z', bidCloseDtm: '2026-12-01T16:00:00.000Z',
  status: 'ongoing', isClosed: false, winBidPrc: null, bidRate: null,
};

describe('AuctionCard', () => {
  it('소재지/감정가(억·만원)/최저가+할인율 표시 + 상세 링크', () => {
    const w = mount(AuctionCard, { props: { item }, global: { stubs: { AuctionStatusBadge: { template: '<span>진행중</span>' } } } });
    expect(w.text()).toContain('역삼동');
    expect(w.text()).toContain('3억원');         // 감정가 300,000,000 → 억/만원
    expect(w.text()).toContain('최저가');         // 최저가 < 감정가라 별도 노출
    expect(w.text()).toContain('-30%');           // 210,000,000/300,000,000 - 1
    expect(w.html()).toContain('/auction/item/6012880');
  });

  it('1차(최저가=감정가)면 할인율/최저가 줄을 숨긴다', () => {
    const w = mount(AuctionCard, { props: { item: { ...item, minBidPrc: 300000000 } }, global: { stubs: { AuctionStatusBadge: { template: '<span>진행중</span>' } } } });
    expect(w.text()).not.toContain('%');
    expect(w.text()).not.toContain('최저가');
  });

  it('감정가 0/누락은 - 로 표시', () => {
    const w = mount(AuctionCard, { props: { item: { ...item, apslAssAmt: 0, minBidPrc: 0 } }, global: { stubs: { AuctionStatusBadge: { template: '<span>진행중</span>' } } } });
    expect(w.text()).toContain('감정가');
    expect(w.text()).toContain('-');
  });
});
