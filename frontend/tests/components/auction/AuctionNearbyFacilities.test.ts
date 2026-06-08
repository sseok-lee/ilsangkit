import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import AuctionNearbyFacilities from '~/components/auction/AuctionNearbyFacilities.vue';

const facilities = [
  { category: 'subway', categoryLabel: '지하철역', name: '강남역', distance: 120 },
  { category: 'hospital', categoryLabel: '병원', name: '서울병원', distance: 1200 },
  { category: 'hospital', categoryLabel: '병원', name: '연세의원', distance: 90 },
];

describe('AuctionNearbyFacilities', () => {
  it('카테고리별 그룹 + 거리(m/km) 표기', () => {
    const w = mount(AuctionNearbyFacilities, { props: { facilities } });
    const t = w.text();
    expect(t).toContain('지하철역');
    expect(t).toContain('강남역');
    expect(t).toContain('120m');
    expect(t).toContain('병원');
    expect(t).toContain('1.2km'); // 1200m → 1.2km
  });
  it('빈 배열이면 렌더 안 함', () => {
    const w = mount(AuctionNearbyFacilities, { props: { facilities: [] } });
    expect(w.text()).toBe('');
  });
});
