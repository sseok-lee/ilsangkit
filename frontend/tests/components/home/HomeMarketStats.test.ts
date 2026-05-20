// frontend/tests/components/home/HomeMarketStats.test.ts
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import HomeMarketStats from '~/components/home/HomeMarketStats.vue';

const fullTrends = [
  { key: 'apt-sale', label: '아파트 매매', avgPrice: 54000, txnCount: 2481, prevAvgPrice: 52800, changePct: 2.27 },
  { key: 'apt-rent-jeonse', label: '아파트 전세', avgPrice: 31000, txnCount: 1742, prevAvgPrice: 31250, changePct: -0.8 },
  { key: 'apt-rent-wolse', label: '아파트 월세', avgPrice: 85, txnCount: 920, prevAvgPrice: 80, changePct: 6.25 },
  { key: 'villa-sale', label: '빌라 매매', avgPrice: 18000, txnCount: 540, prevAvgPrice: 17500, changePct: 2.86 },
  { key: 'offitel-sale', label: '오피스텔 매매', avgPrice: 22000, txnCount: 318, prevAvgPrice: null, changePct: null },
  { key: 'offitel-rent-jeonse', label: '오피스텔 전세', avgPrice: 15000, txnCount: 210, prevAvgPrice: 14800, changePct: 1.35 },
];

describe('HomeMarketStats', () => {
  it('renders 6 cards with avg/count/change', () => {
    const wrapper = mount(HomeMarketStats, { props: { trends: fullTrends } });
    expect(wrapper.text()).toContain('아파트 매매');
    expect(wrapper.text()).toContain('5.4억');
    expect(wrapper.text()).toContain('2,481건');
    expect(wrapper.text()).toContain('+2.3%');
    expect(wrapper.findAll('[data-key]')).toHaveLength(6);
  });
  it('renders new slots: apt-rent-wolse and villa-sale and offitel-rent-jeonse', () => {
    const wrapper = mount(HomeMarketStats, { props: { trends: fullTrends } });
    expect(wrapper.text()).toContain('아파트 월세');
    expect(wrapper.text()).toContain('빌라 매매');
    expect(wrapper.text()).toContain('오피스텔 전세');
  });
  it('renders 월 평균 label for apt-rent-wolse card', () => {
    const wrapper = mount(HomeMarketStats, { props: { trends: fullTrends } });
    const wolseCard = wrapper.find('[data-key="apt-rent-wolse"]');
    expect(wolseCard.text()).toContain('월 평균');
  });
  it('renders 평균 label (not 월 평균) for non-wolse cards', () => {
    const wrapper = mount(HomeMarketStats, { props: { trends: fullTrends } });
    const aptSaleCard = wrapper.find('[data-key="apt-sale"]');
    expect(aptSaleCard.text()).toContain('평균');
    expect(aptSaleCard.text()).not.toContain('월 평균');
  });
  it('renders — when changePct is null', () => {
    const wrapper = mount(HomeMarketStats, { props: { trends: fullTrends } });
    const offitelCard = wrapper.find('[data-key="offitel-sale"]');
    expect(offitelCard.text()).toContain('—');
  });
  it('renders nothing when trends empty', () => {
    const wrapper = mount(HomeMarketStats, { props: { trends: [] } });
    expect(wrapper.find('section').exists()).toBe(false);
  });
});
