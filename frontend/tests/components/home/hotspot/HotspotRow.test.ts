import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import HotspotRow from '~/components/home/hotspot/HotspotRow.vue';
import type { HotspotRegion } from '~/composables/useHomeDashboard';

const baseRegion = (): HotspotRegion => ({
  citySlug: 'seoul', city: '서울특별시',
  districtSlug: 'gangnam-gu', district: '강남구',
  pricePerPyeong: 8420, txnCount: 312,
  changePct: 4.2, volumeChangePct: 22,
});

const linkStub = { template: '<a :href="to"><slot /></a>', props: ['to'] };

describe('HotspotRow', () => {
  it('renders city + district + price + txnCount', () => {
    const wrapper = mount(HotspotRow, {
      props: { region: baseRegion(), rank: 1, signal: 'rising', href: '/x' },
      global: { stubs: { HardLink: linkStub } },
    });
    expect(wrapper.text()).toContain('서울 강남구');
    expect(wrapper.text()).toContain('8,420');
    expect(wrapper.text()).toContain('312');
  });

  it('rising signal shows changePct in red with + sign', () => {
    const wrapper = mount(HotspotRow, {
      props: { region: baseRegion(), rank: 1, signal: 'rising', href: '/x' },
      global: { stubs: { HardLink: linkStub } },
    });
    expect(wrapper.html()).toMatch(/text-red-500/);
    expect(wrapper.text()).toContain('+4.2%');
  });

  it('falling signal shows changePct in blue with − sign', () => {
    const region = { ...baseRegion(), changePct: -2.4 };
    const wrapper = mount(HotspotRow, {
      props: { region, rank: 1, signal: 'falling', href: '/x' },
      global: { stubs: { HardLink: linkStub } },
    });
    expect(wrapper.html()).toMatch(/text-blue-500/);
    expect(wrapper.text()).toContain('−2.4%');
  });

  it('active signal shows volumeChangePct in violet with + sign', () => {
    const wrapper = mount(HotspotRow, {
      props: { region: baseRegion(), rank: 1, signal: 'active', href: '/x' },
      global: { stubs: { HardLink: linkStub } },
    });
    expect(wrapper.html()).toMatch(/text-violet-600/);
    expect(wrapper.text()).toContain('+22');
  });

  it('월세 행 (pricePerPyeong null) 은 평당가 슬롯 미표시', () => {
    const region = { ...baseRegion(), pricePerPyeong: null, changePct: null };
    const wrapper = mount(HotspotRow, {
      props: { region, rank: 1, signal: 'active', href: '/x' },
      global: { stubs: { HardLink: linkStub } },
    });
    expect(wrapper.text()).not.toMatch(/평당/);
    expect(wrapper.text()).toContain('312');
  });

  it('href prop is applied to link', () => {
    const wrapper = mount(HotspotRow, {
      props: { region: baseRegion(), rank: 1, signal: 'rising',
        href: '/real-estate/apt-sale?city=seoul&district=gangnam-gu' },
      global: { stubs: { HardLink: linkStub } },
    });
    expect(wrapper.find('a').attributes('href')).toBe('/real-estate/apt-sale?city=seoul&district=gangnam-gu');
  });
});
