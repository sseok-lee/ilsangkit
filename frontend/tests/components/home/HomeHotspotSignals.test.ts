import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import HomeHotspotSignals from '~/components/home/HomeHotspotSignals.vue';
import type { RealEstateHotspots, PropertyHotspots, HotspotRegion } from '~/composables/useHomeDashboard';

const fetchMock = vi.fn();
vi.stubGlobal('$fetch', fetchMock);
vi.stubGlobal('useRuntimeConfig', () => ({ public: { apiBase: 'http://localhost:8000' } }));

const sampleRegion = (district: string): HotspotRegion => ({
  citySlug: 'seoul', city: '서울특별시',
  districtSlug: `${district}-slug`, district,
  pricePerPyeong: 5000, txnCount: 100,
  changePct: 3, volumeChangePct: 20,
});

const fullBundle = (): PropertyHotspots => ({
  sale:   { rising: [sampleRegion('강남구'), sampleRegion('성동구')], falling: [sampleRegion('도봉구')], active: [sampleRegion('송파구')] },
  jeonse: { rising: [], falling: [], active: [] },
  wolse:  { active: [sampleRegion('영등포구')] },
});

beforeEach(() => {
  fetchMock.mockReset();
});

describe('HomeHotspotSignals', () => {
  it('renders nothing if hotspots is empty (apt undefined)', () => {
    const wrapper = mount(HomeHotspotSignals, { props: { hotspots: {} as RealEstateHotspots } });
    expect(wrapper.html()).toBe('<!--v-if-->');
  });

  it('default state: apt + sale → renders 3 signal cards', () => {
    const wrapper = mount(HomeHotspotSignals, {
      props: { hotspots: { apt: fullBundle() } },
    });
    expect(wrapper.text()).toContain('평당가 상승');
    expect(wrapper.text()).toContain('평당가 하락');
    expect(wrapper.text()).toContain('거래 급증');
    expect(wrapper.text()).toContain('강남구');
  });

  it('property toggle to villa triggers fetch', async () => {
    fetchMock.mockResolvedValue({ success: true, data: fullBundle() });
    const wrapper = mount(HomeHotspotSignals, {
      props: { hotspots: { apt: fullBundle() } },
    });
    const villaBtn = wrapper.findAll('button').find((b) => b.text().includes('빌라'))!;
    await villaBtn.trigger('click');
    await flushPromises();
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8000/api/meta/hotspots',
      { query: { propertyType: 'villa' } },
    );
  });

  it('section remains mounted during fetch when switching property type', async () => {
    // Promise that never resolves during the test — simulates in-flight fetch
    let resolveFetch: (v: { success: boolean; data: PropertyHotspots }) => void = () => {};
    const pending = new Promise<{ success: boolean; data: PropertyHotspots }>((res) => {
      resolveFetch = res;
    });
    fetchMock.mockReturnValue(pending);

    const wrapper = mount(HomeHotspotSignals, {
      props: { hotspots: { apt: fullBundle() } },
    });
    expect(wrapper.find('section').exists()).toBe(true);

    const villaBtn = wrapper.findAll('button').find((b) => b.text().includes('빌라'))!;
    await villaBtn.trigger('click');
    // While fetch is in-flight, section must NOT unmount (regression — was unmounting before fix)
    expect(wrapper.find('section').exists()).toBe(true);
    // Loading spinner should be visible on the active toggle
    expect(wrapper.find('.animate-spin').exists()).toBe(true);

    resolveFetch({ success: true, data: fullBundle() });
    await flushPromises();
    expect(wrapper.find('section').exists()).toBe(true);
    expect(wrapper.find('.animate-spin').exists()).toBe(false);
  });

  it('헤더에 /real-estate/ranking/ 로 시작하는 시세 순위 링크가 있다', () => {
    const wrapper = mount(HomeHotspotSignals, {
      props: { hotspots: { apt: fullBundle() } },
    });
    expect(wrapper.html()).toContain('/real-estate/ranking/');
  });

  it('헤더에 신고가 단지 링크가 있다', () => {
    const hotspots: RealEstateHotspots = { apt: fullBundle() };
    const stubs = {
      HardLink: { template: '<a :href="to"><slot /></a>', props: ['to'] },
      HotspotCard: { template: '<div />', props: ['signal', 'regions', 'propertyType', 'txnType'] },
      TxnTypeMiniTabs: { template: '<div />', props: ['modelValue'] },
    };
    const w = mount(HomeHotspotSignals, { props: { hotspots }, global: { stubs } });
    expect(w.html()).toContain('/real-estate/new-high/');
  });

  it('wolse tab hides rising/falling cards, shows only active', async () => {
    const wrapper = mount(HomeHotspotSignals, {
      props: { hotspots: { apt: fullBundle() } },
    });
    const wolseBtns = wrapper.findAll('button').filter((b) => b.text().trim() === '월세');
    expect(wolseBtns.length).toBeGreaterThan(0);
    await wolseBtns[0].trigger('click');

    expect(wrapper.text()).not.toContain('평당가 상승');
    expect(wrapper.text()).not.toContain('평당가 하락');
    expect(wrapper.text()).toContain('거래 급증');
    expect(wrapper.text()).toContain('영등포구');
  });
});
