// frontend/tests/components/home/HomeMarketStats.test.ts
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import HomeMarketStats from '~/components/home/HomeMarketStats.vue';

const fullTrends = [
  { key: 'apt-sale',           label: '아파트 매매',   avgPrice: 54000, txnCount: 2481, prevAvgPrice: 52800, changePct: 2.27 },
  { key: 'apt-rent-jeonse',    label: '아파트 전세',   avgPrice: 31000, txnCount: 1742, prevAvgPrice: 31250, changePct: -0.8 },
  { key: 'apt-rent-wolse',     label: '아파트 월세',   avgPrice: 85,    txnCount: 920,  prevAvgPrice: 80,    changePct: 6.25 },
  { key: 'villa-sale',         label: '빌라 매매',     avgPrice: 18000, txnCount: 540,  prevAvgPrice: 17500, changePct: 2.86 },
  { key: 'villa-rent-jeonse',  label: '빌라 전세',     avgPrice: 12000, txnCount: 320,  prevAvgPrice: 11800, changePct: 1.69 },
  { key: 'villa-rent-wolse',   label: '빌라 월세',     avgPrice: 55,    txnCount: 180,  prevAvgPrice: 52,    changePct: 5.77 },
  { key: 'offitel-sale',       label: '오피스텔 매매', avgPrice: 22000, txnCount: 318,  prevAvgPrice: null,  changePct: null },
  { key: 'offitel-rent-jeonse',label: '오피스텔 전세', avgPrice: 15000, txnCount: 210,  prevAvgPrice: 14800, changePct: 1.35 },
  { key: 'offitel-rent-wolse', label: '오피스텔 월세', avgPrice: 72,    txnCount: 95,   prevAvgPrice: 68,    changePct: 5.88 },
];

describe('HomeMarketStats', () => {
  it('renders 3 property cards (아파트/오피스텔/빌라)', () => {
    const wrapper = mount(HomeMarketStats, { props: { trends: fullTrends } });
    expect(wrapper.text()).toContain('아파트');
    expect(wrapper.text()).toContain('오피스텔');
    expect(wrapper.text()).toContain('빌라');
    // 3 property cards
    expect(wrapper.findAll('.rounded-2xl')).toHaveLength(3);
  });

  it('renders 3 rows per card (매매/전세/월세)', () => {
    const wrapper = mount(HomeMarketStats, { props: { trends: fullTrends } });
    // 9 total HardLink rows (3 cards × 3 rows)
    const links = wrapper.findAll('a');
    // 9 row links + 1 "전체 보기" link = 10
    expect(links).toHaveLength(10);
    // each card has 매매/전세/월세
    expect(wrapper.findAll('li')).toHaveLength(9);
  });

  it('row links to correct URL', () => {
    const wrapper = mount(HomeMarketStats, { props: { trends: fullTrends } });
    const links = wrapper.findAll('a');
    // 전체 보기 is first link
    const rowLinks = links.slice(1);
    // apt-sale
    expect(rowLinks[0].attributes('href')).toContain('/real-estate/apt-sale');
    // apt-rent (jeonse)
    expect(rowLinks[1].attributes('href')).toContain('/real-estate/apt-rent');
    // apt-rent (wolse)
    expect(rowLinks[2].attributes('href')).toContain('/real-estate/apt-rent');
    // offitel-sale
    expect(rowLinks[3].attributes('href')).toContain('/real-estate/offitel-sale');
    // villa-sale
    expect(rowLinks[6].attributes('href')).toContain('/real-estate/villa-sale');
  });

  it('missing slot renders dashes', () => {
    // Only provide apt-sale, leave all others missing
    const partial = [
      { key: 'apt-sale', label: '아파트 매매', avgPrice: 54000, txnCount: 2481, prevAvgPrice: 52800, changePct: 2.27 },
    ];
    const wrapper = mount(HomeMarketStats, { props: { trends: partial } });
    // Still renders 3 cards
    expect(wrapper.findAll('.rounded-2xl')).toHaveLength(3);
    // Missing slots show '—'
    const dashes = wrapper.text().split('—');
    // at least several missing slots render dashes
    expect(dashes.length).toBeGreaterThan(3);
  });

  it('renders nothing when trends empty', () => {
    const wrapper = mount(HomeMarketStats, { props: { trends: [] } });
    expect(wrapper.find('section').exists()).toBe(false);
  });
});
