import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import HotspotComplexCard from '~/components/home/hotspot/HotspotComplexCard.vue';
import type { NewHighRow, ActiveRow, TopPyeongRow } from '~/composables/useHomeDashboard';

const newHigh: NewHighRow = {
  buildingName: 'A', citySlug: 'seoul', city: '서울특별시', district: '강남구', districtSlug: 'gangnam-gu',
  dealDate: '2026-05-18', newPyeong: 8000, prevMaxPyeong: 7000, changePct: 14.28,
};

const active: ActiveRow = {
  buildingName: 'B', citySlug: 'seoul', city: '서울특별시', district: '서초구', districtSlug: 'seocho-gu',
  txnCount: 12, latestDealDate: '2026-05-19', avgPyeongPrice: 9000,
};

const top: TopPyeongRow = {
  buildingName: 'C', citySlug: 'seoul', city: '서울특별시', district: '용산구', districtSlug: 'yongsan-gu',
  avgPyeongPrice: 12000, txnCount: 5,
};

describe('HotspotComplexCard', () => {
  it('rows 0개면 행 없음', () => {
    const wrapper = mount(HotspotComplexCard, {
      props: { variant: 'newHigh', rows: [], propertyType: 'apt' as const },
    });
    expect(wrapper.findAll('a').length).toBe(0);
  });

  it('newHigh — changePct를 +X.X% 형식으로', () => {
    const wrapper = mount(HotspotComplexCard, {
      props: { variant: 'newHigh', rows: [newHigh], propertyType: 'apt' as const },
    });
    expect(wrapper.text()).toContain('+14.3%');
  });

  it('active — txnCount를 N건', () => {
    const wrapper = mount(HotspotComplexCard, {
      props: { variant: 'active', rows: [active], propertyType: 'apt' as const },
    });
    expect(wrapper.text()).toContain('12건');
  });

  it('topPyeong — 평당가를 만원 단위로', () => {
    const wrapper = mount(HotspotComplexCard, {
      props: { variant: 'topPyeong', rows: [top], propertyType: 'apt' as const },
    });
    expect(wrapper.text()).toContain('12,000');
  });
});
