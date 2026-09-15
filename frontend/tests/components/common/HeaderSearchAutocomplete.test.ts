import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import HeaderSearch from '~/components/common/HeaderSearch.vue';

vi.stubGlobal('navigateTo', vi.fn());
beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('$fetch', vi.fn(async () => ({ success: true, data: { items: [] } })));
});

describe('HeaderSearch 자동완성', () => {
  it('데스크톱: 입력 포커스 시 SearchAutocomplete 렌더', async () => {
    const wrapper = mount(HeaderSearch, { props: { variant: 'desktop' } });
    await wrapper.find('input').trigger('focus');
    expect(wrapper.findComponent({ name: 'SearchAutocomplete' }).exists()).toBe(true);
  });
  it('mobile: 오버레이 열면 SearchAutocomplete 렌더', async () => {
    const wrapper = mount(HeaderSearch, { props: { variant: 'mobile' } });
    await wrapper.find('button[aria-label="검색 열기"]').trigger('click');
    expect(wrapper.findComponent({ name: 'SearchAutocomplete' }).exists()).toBe(true);
  });

  it('데스크톱 입력과 자동완성 listbox를 combobox ARIA로 연결한다', async () => {
    const wrapper = mount(HeaderSearch, { props: { variant: 'desktop' } });
    const input = wrapper.find('input[aria-label="통합 검색"]');
    await input.trigger('focus');
    const ac = wrapper.findComponent({ name: 'SearchAutocomplete' });

    expect(input.attributes('role')).toBe('combobox');
    expect(input.attributes('aria-autocomplete')).toBe('list');
    expect(input.attributes('aria-expanded')).toBe('true');
    expect(ac.props('listboxId')).toBe(input.attributes('aria-controls'));

    ac.vm.$emit('active-descendant-change', `${ac.props('listboxId')}-option-0`);
    await wrapper.vm.$nextTick();
    expect(input.attributes('aria-activedescendant')).toBe(`${ac.props('listboxId')}-option-0`);
  });

  it('모바일 오버레이 입력과 자동완성 listbox를 combobox ARIA로 연결한다', async () => {
    const wrapper = mount(HeaderSearch, { props: { variant: 'mobile' } });
    await wrapper.find('button[aria-label="검색 열기"]').trigger('click');
    const input = wrapper.find('input[aria-label="통합 검색"]');
    const ac = wrapper.findComponent({ name: 'SearchAutocomplete' });

    expect(input.attributes('role')).toBe('combobox');
    expect(input.attributes('aria-autocomplete')).toBe('list');
    expect(input.attributes('aria-expanded')).toBe('true');
    expect(ac.props('listboxId')).toBe(input.attributes('aria-controls'));
  });
});
