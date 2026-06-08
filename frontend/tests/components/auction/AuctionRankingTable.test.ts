// frontend/tests/components/auction/AuctionRankingTable.test.ts
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import AuctionRankingTable from '~/components/auction/AuctionRankingTable.vue';
const rows = [{ bjdCode: '11680', usageGroup: 'residential', city: '서울특별시', district: '강남구', avgBidRate: 82, soldCount: 10, activeCount: 5, isIndexable: true }];
describe('AuctionRankingTable', () => {
  it('낙찰가율/지역 렌더', () => {
    const w = mount(AuctionRankingTable, { props: { rows }, global: { stubs: { NuxtLink: { template: '<a><slot/></a>' } } } });
    expect(w.text()).toContain('강남구');
    expect(w.text()).toContain('82%');
  });
});
