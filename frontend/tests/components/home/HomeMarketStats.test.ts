// frontend/tests/components/home/HomeMarketStats.test.ts
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import HomeMarketStats from '~/components/home/HomeMarketStats.vue';

const fullTrends = [
  { key: 'apt-sale', label: '아파트 매매', avgPrice: 54000, txnCount: 2481, prevAvgPrice: 52800, changePct: 2.27 },
  { key: 'apt-rent-jeonse', label: '아파트 전세', avgPrice: 31000, txnCount: 1742, prevAvgPrice: 31250, changePct: -0.8 },
  { key: 'offitel-sale', label: '오피스텔 매매', avgPrice: 22000, txnCount: 318, prevAvgPrice: null, changePct: null },
];

describe('HomeMarketStats', () => {
  it('renders 3 cards with avg/count/change', () => {
    const wrapper = mount(HomeMarketStats, { props: { trends: fullTrends } });
    expect(wrapper.text()).toContain('아파트 매매');
    expect(wrapper.text()).toContain('5.4억');
    expect(wrapper.text()).toContain('2,481건');
    expect(wrapper.text()).toContain('+2.3%');
  });
  it('renders — when changePct is null', () => {
    const wrapper = mount(HomeMarketStats, { props: { trends: fullTrends } });
    const offitelCard = wrapper.findAll('[data-key="offitel-sale"]')[0];
    expect(offitelCard.text()).toContain('—');
  });
  it('renders nothing when trends empty', () => {
    const wrapper = mount(HomeMarketStats, { props: { trends: [] } });
    expect(wrapper.find('section').exists()).toBe(false);
  });
});
