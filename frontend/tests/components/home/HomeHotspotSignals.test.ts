import { describe, it, expect, vi, beforeEach } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import HomeHotspotSignals from '~/components/home/HomeHotspotSignals.vue';
import type { ComplexHotspots, ComplexHotspotsByProperty } from '~/composables/useHomeDashboard';

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('$fetch', fetchMock);
  vi.stubGlobal('useRuntimeConfig', () => ({ public: { apiBase: 'http://localhost:8000' } }));
});

function sample(): ComplexHotspots {
  return {
    newHigh: [{
      buildingName: '래미안', citySlug: 'seoul', city: '서울특별시', district: '강남구', districtSlug: 'gangnam-gu',
      dealDate: '2026-05-18', newPyeong: 8000, prevMaxPyeong: 7000, changePct: 14.28,
    }],
    active: [{
      buildingName: '자이', citySlug: 'seoul', city: '서울특별시', district: '서초구', districtSlug: 'seocho-gu',
      txnCount: 12, latestDealDate: '2026-05-19', avgPyeongPrice: 9000,
    }],
    topPyeong: [{
      buildingName: '한남', citySlug: 'seoul', city: '서울특별시', district: '용산구', districtSlug: 'yongsan-gu',
      avgPyeongPrice: 12000, txnCount: 5,
    }],
  };
}

describe('HomeHotspotSignals (complex hotspots)', () => {
  it('seed 데이터 없으면 섹션 자체 hide', () => {
    const wrapper = mount(HomeHotspotSignals, {
      props: { hotspots: {} as ComplexHotspotsByProperty },
    });
    expect(wrapper.text()).not.toContain('오늘의 부동산 시장');
  });

  it('apt seed로 3카드 모두 렌더', () => {
    const wrapper = mount(HomeHotspotSignals, {
      props: { hotspots: { apt: sample() } },
    });
    expect(wrapper.text()).toContain('신고가 갱신');
    expect(wrapper.text()).toContain('거래 활발');
    expect(wrapper.text()).toContain('평당가 TOP');
    expect(wrapper.text()).toContain('래미안');
    expect(wrapper.text()).toContain('자이');
    expect(wrapper.text()).toContain('한남');
  });

  it('자산 토글 클릭 시 미캐시 propertyType에 대해 /api/meta/complex-hotspots 호출', async () => {
    fetchMock.mockResolvedValueOnce({ success: true, data: sample() });
    const wrapper = mount(HomeHotspotSignals, {
      props: { hotspots: { apt: sample() } },
    });
    const offitelBtn = wrapper.findAll('button').find((b) => b.text().includes('오피스텔'))!;
    await offitelBtn.trigger('click');
    await flushPromises();
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8000/api/meta/complex-hotspots',
      { query: { propertyType: 'offitel' } },
    );
  });

  it('자산 토글 전환 시 섹션 unmount 안 됨 (loading 중에도 헤딩 유지)', async () => {
    let resolveFetch!: (v: unknown) => void;
    fetchMock.mockReturnValueOnce(new Promise((r) => { resolveFetch = r; }));
    const wrapper = mount(HomeHotspotSignals, {
      props: { hotspots: { apt: sample() } },
    });
    const offitelBtn = wrapper.findAll('button').find((b) => b.text().includes('오피스텔'))!;
    await offitelBtn.trigger('click');
    expect(wrapper.text()).toContain('오늘의 부동산 시장');
    resolveFetch({ success: true, data: sample() });
  });

  it('거래 토글(전세/월세) UI 없음', () => {
    const wrapper = mount(HomeHotspotSignals, {
      props: { hotspots: { apt: sample() } },
    });
    expect(wrapper.text()).not.toContain('전세');
    expect(wrapper.text()).not.toContain('월세');
  });
});
