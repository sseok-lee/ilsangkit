import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import AuctionMap from '~/components/auction/AuctionMap.vue';

vi.mock('~/composables/useKakaoMap', () => ({
  useKakaoMap: () => ({
    initMap: vi.fn().mockResolvedValue(undefined),
    addMarkers: vi.fn(),
    setCenter: vi.fn(),
    initRoadview: vi.fn().mockImplementation((_c: any, _lat: number, _lng: number, cb: (a: boolean) => void) => cb(true)),
    isLoaded: { value: true },
  }),
}));

describe('AuctionMap', () => {
  it('좌표 있으면 지도/로드뷰 컨테이너 렌더', () => {
    const w = mount(AuctionMap, { props: { lat: 37.5, lng: 127.0, address: '강남구' } });
    expect(w.find('[data-testid="auction-map"]').exists()).toBe(true);
  });
});
