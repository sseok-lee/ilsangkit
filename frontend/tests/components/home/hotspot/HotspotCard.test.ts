import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import HotspotCard from '~/components/home/hotspot/HotspotCard.vue';
import type { HotspotRegion } from '~/composables/useHomeDashboard';

const mockRegions = (count: number): HotspotRegion[] =>
  Array.from({ length: count }, (_, i) => ({
    citySlug: 'seoul', city: '서울특별시',
    districtSlug: `dist-${i}`, district: `구${i}`,
    pricePerPyeong: 5000 + i * 100, txnCount: 100 + i,
    changePct: 2 + i * 0.1, volumeChangePct: 10 + i,
  }));

// HotspotRow is NOT stubbed so findComponent({ name: 'HotspotRow' }) can locate
// the real instance and inspect its props. HardLink (used inside HotspotRow) is
// stubbed to avoid navigation-related side-effects in the test environment.
const stubs = {
  HardLink: { template: '<a :href="to"><slot /></a>', props: ['to'] },
};

describe('HotspotCard', () => {
  it('rising variant renders title + icon + rows', () => {
    const wrapper = mount(HotspotCard, {
      props: { signal: 'rising', regions: mockRegions(3), propertyType: 'apt', txnType: 'sale' },
      global: { stubs },
    });
    expect(wrapper.text()).toContain('평당가 상승');
    // HotspotRow is not stubbed; each row renders as an <a> via the HardLink stub
    expect(wrapper.findAllComponents({ name: 'HotspotRow' })).toHaveLength(3);
  });

  it('renders empty state when regions is []', () => {
    const wrapper = mount(HotspotCard, {
      props: { signal: 'rising', regions: [], propertyType: 'apt', txnType: 'sale' },
      global: { stubs },
    });
    expect(wrapper.text()).toContain('유의미한 변동이 없어요');
  });

  it('active variant for wolse shows special caption', () => {
    const wrapper = mount(HotspotCard, {
      props: { signal: 'active', regions: mockRegions(2), propertyType: 'apt', txnType: 'wolse' },
      global: { stubs },
    });
    expect(wrapper.text()).toContain('월세는 거래량 시그널만 제공해요');
  });

  it('computes correct href per row using RealEstateType slug', () => {
    const wrapper = mount(HotspotCard, {
      props: {
        signal: 'rising',
        regions: [{
          citySlug: 'seoul', city: '서울특별시',
          districtSlug: 'gangnam-gu', district: '강남구',
          pricePerPyeong: 5000, txnCount: 100,
          changePct: 5, volumeChangePct: 10,
        }],
        propertyType: 'apt',
        txnType: 'sale',
      },
      global: { stubs },
    });
    const row = wrapper.findComponent({ name: 'HotspotRow' });
    expect(row.props('href')).toBe('/real-estate/apt-sale?city=seoul&district=gangnam-gu');
  });

  it('jeonse appends rentType=전세 to href (URL-encoded)', () => {
    const wrapper = mount(HotspotCard, {
      props: {
        signal: 'rising',
        regions: [{
          citySlug: 'seoul', city: '서울특별시',
          districtSlug: 'gangnam-gu', district: '강남구',
          pricePerPyeong: 3000, txnCount: 100,
          changePct: 5, volumeChangePct: 10,
        }],
        propertyType: 'offitel',
        txnType: 'jeonse',
      },
      global: { stubs },
    });
    const row = wrapper.findComponent({ name: 'HotspotRow' });
    expect(row.props('href')).toBe('/real-estate/offitel-rent?city=seoul&district=gangnam-gu&rentType=%EC%A0%84%EC%84%B8');
  });
});
