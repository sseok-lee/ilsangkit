// frontend/tests/components/home/HomeTrendingBuildings.test.ts
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import HomeTrendingBuildings from '~/components/home/HomeTrendingBuildings.vue';

const buildings = {
  sale: [
    { buildingName: '헬리오시티', city: '서울특별시', district: '송파구', txnCount: 42, avgPrice: 184000, avgMonthlyRent: null, slug: encodeURIComponent('헬리오시티') },
    { buildingName: '파크리오', city: '서울특별시', district: '송파구', txnCount: 30, avgPrice: 160000, avgMonthlyRent: null, slug: encodeURIComponent('파크리오') },
    { buildingName: '아크로리버파크', city: '서울특별시', district: '반포구', txnCount: 20, avgPrice: 320000, avgMonthlyRent: null, slug: encodeURIComponent('아크로리버파크') },
  ],
  jeonse: [
    { buildingName: '파크리오', city: '서울특별시', district: '송파구', txnCount: 18, avgPrice: 90000, avgMonthlyRent: null, slug: encodeURIComponent('파크리오') },
  ],
  wolse: [
    { buildingName: '아크로리버파크', city: '서울특별시', district: '반포구', txnCount: 5, avgPrice: 20000, avgMonthlyRent: 120, slug: encodeURIComponent('아크로리버파크') },
  ],
};

describe('HomeTrendingBuildings', () => {
  it('renders 3 columns with their respective TOP lists', () => {
    const wrapper = mount(HomeTrendingBuildings, { props: { buildings } });
    const text = wrapper.text();
    expect(text).toContain('매매 TOP');
    expect(text).toContain('전세 TOP');
    expect(text).toContain('월세 TOP');
    expect(text).toContain('헬리오시티');
    expect(text).toContain('파크리오');
    expect(text).toContain('아크로리버파크');
  });

  it('formats wolse as deposit/monthlyRent', () => {
    const wrapper = mount(HomeTrendingBuildings, { props: { buildings } });
    expect(wrapper.text()).toContain('2억/120');
  });

  it('renders nothing when all 3 lists empty', () => {
    const wrapper = mount(HomeTrendingBuildings, {
      props: { buildings: { sale: [], jeonse: [], wolse: [] } },
    });
    expect(wrapper.find('section').exists()).toBe(false);
  });

  it('renders empty-column message when one list is empty', () => {
    const wrapper = mount(HomeTrendingBuildings, {
      props: { buildings: { sale: buildings.sale, jeonse: [], wolse: buildings.wolse } },
    });
    expect(wrapper.text()).toContain('이번 주 거래 없음');
  });

  it('builds full 4-segment URL via toRealEstateUrl', () => {
    const wrapper = mount(HomeTrendingBuildings, { props: { buildings } });
    const saleLink = wrapper.find(`a[href*="/real-estate/apt-sale/seoul/songpa/"]`);
    expect(saleLink.exists()).toBe(true);
  });
});
