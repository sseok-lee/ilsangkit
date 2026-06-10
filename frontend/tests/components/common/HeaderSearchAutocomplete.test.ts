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
});
