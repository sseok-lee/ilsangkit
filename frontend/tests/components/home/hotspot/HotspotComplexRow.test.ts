import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import HotspotComplexRow from '~/components/home/hotspot/HotspotComplexRow.vue';

const baseRow = {
  buildingName: '래미안대치팰리스',
  citySlug: 'seoul',
  city: '서울특별시',
  district: '강남구',
  districtSlug: 'gangnam-gu',
};

describe('HotspotComplexRow', () => {
  it('단지명을 렌더링', () => {
    const wrapper = mount(HotspotComplexRow, {
      props: {
        row: baseRow,
        propertyType: 'apt' as const,
        metric1Value: '8,000만원',
        metric2Label: '+12.5%',
        metric2Class: 'text-red-500',
      },
    });
    expect(wrapper.text()).toContain('래미안대치팰리스');
  });

  it('href에 단지 상세 경로 (URL 인코딩)', () => {
    const wrapper = mount(HotspotComplexRow, {
      props: {
        row: { ...baseRow, buildingName: '래미안 대치 팰리스' },
        propertyType: 'apt' as const,
        metric1Value: '8,000만원',
        metric2Label: '+12.5%',
      },
    });
    const link = wrapper.find('a');
    expect(link.attributes('href')).toBe(
      '/real-estate/apt-sale/seoul/gangnam-gu/' + encodeURIComponent('래미안 대치 팰리스'),
    );
  });

  it('지역 라벨은 "강남구" 형태로 표시', () => {
    const wrapper = mount(HotspotComplexRow, {
      props: {
        row: baseRow,
        propertyType: 'apt' as const,
        metric1Value: '8,000만원',
        metric2Label: '+12.5%',
      },
    });
    expect(wrapper.text()).toContain('강남구');
  });
});
