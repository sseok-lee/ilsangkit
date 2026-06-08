import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import AuctionMap from '~/components/auction/AuctionMap.vue';

// FacilityMap/FacilityRoadview/ClientOnly 는 stub — AuctionMap 자체 마크업만 검증
const stubs = {
  ClientOnly: { template: '<div><slot /></div>' },
  FacilityMap: { name: 'FacilityMap', template: '<div data-testid="facility-map" />' },
  FacilityRoadview: { name: 'FacilityRoadview', template: '<div data-testid="facility-roadview" />' },
};

const mountMap = (props = {}) =>
  mount(AuctionMap, { props: { lat: 37.5, lng: 127.0, address: '강남구', ...props }, global: { stubs } });

describe('AuctionMap', () => {
  it('헤딩 "위치와 로드뷰" + data-testid 유지', () => {
    const w = mountMap();
    expect(w.text()).toContain('위치와 로드뷰');
    expect(w.find('[data-testid="auction-map"]').exists()).toBe(true);
  });

  it('FacilityMap / FacilityRoadview 재사용', () => {
    const w = mountMap();
    expect(w.find('[data-testid="facility-map"]').exists()).toBe(true);
    expect(w.find('[data-testid="facility-roadview"]').exists()).toBe(true);
  });

  it('이모지 라벨(🗺️/🛣️)을 더 이상 쓰지 않음', () => {
    const w = mountMap();
    expect(w.text()).not.toContain('🗺️');
    expect(w.text()).not.toContain('🛣️');
  });

  it('길찾기 드롭다운 토글 → 카카오/네이버 링크 노출', async () => {
    const w = mountMap();
    expect(w.text()).not.toContain('카카오맵으로 길찾기'); // 초기 닫힘
    const trigger = w.findAll('button').find((b) => b.text().includes('길찾기'));
    expect(trigger).toBeTruthy();
    await trigger!.trigger('click');
    expect(w.text()).toContain('카카오맵으로 길찾기');
    expect(w.text()).toContain('네이버맵으로 길찾기');
  });

  it('카카오맵 길찾기 클릭 시 window.open 호출', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    const w = mountMap();
    await w.findAll('button').find((b) => b.text().includes('길찾기'))!.trigger('click');
    await w.findAll('button').find((b) => b.text().includes('카카오맵으로 길찾기'))!.trigger('click');
    expect(openSpy).toHaveBeenCalledWith(expect.stringContaining('map.kakao.com'), '_blank');
    openSpy.mockRestore();
  });
});
