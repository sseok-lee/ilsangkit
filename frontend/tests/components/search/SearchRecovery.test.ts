import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import SearchRecovery from '~/components/search/SearchRecovery.vue';

const region = { scope: 'region' as const, regionLabel: '서울특별시 강남구', chips: [
  { label: '강남구 화장실', category: 'toilet', city: '서울특별시', district: '강남구' },
]};

const category = { scope: 'category' as const, regionLabel: null, chips: [
  { label: 'toilet', category: 'toilet', city: undefined, district: undefined },
]};

const jngj = { scope: 'region' as const, regionLabel: '전남광주통합특별시 목포시', chips: [
  { label: '목포시 화장실', category: 'toilet', city: '전남광주통합특별시', district: '목포시' },
]};

describe('SearchRecovery', () => {
  it('지역 칩을 올바른 지역 URL로 렌더', () => {
    const wrapper = mount(SearchRecovery, { props: { recovery: region } });
    expect(wrapper.text()).toContain('강남구 화장실');
    // NuxtLink stub renders <a :href="to"> — check href attribute
    const link = wrapper.find('a');
    const href = link.attributes('href') ?? link.attributes('to') ?? '';
    expect(href).toContain('seoul/gangnam/toilet');
  });
  it('전남광주통합특별시(JNGJ) 지역 칩도 prefix를 드롭하지 않고 올바른 지역 URL로 렌더 (Task A8 robustness)', () => {
    const wrapper = mount(SearchRecovery, { props: { recovery: jngj } });
    expect(wrapper.text()).toContain('목포시 화장실');
    const link = wrapper.find('a');
    const href = link.attributes('href') ?? link.attributes('to') ?? '';
    expect(href).toContain('jeonnamgwangju/mokpo/toilet');
    expect(href).not.toBe('/toilet');
  });
  it('recovery=null이면 아무것도 렌더하지 않음', () => {
    const wrapper = mount(SearchRecovery, { props: { recovery: null } });
    expect(wrapper.text().trim()).toBe('');
  });
  it('category 스코프 칩은 CATEGORY_META.shortLabel(한국어)로 렌더', () => {
    const wrapper = mount(SearchRecovery, { props: { recovery: category } });
    // CATEGORY_META.toilet.shortLabel === '화장실'
    expect(wrapper.text()).toContain('화장실');
    expect(wrapper.text()).not.toContain('toilet');
  });
});
