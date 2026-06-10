import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import SearchAutocomplete from '~/components/search/SearchAutocomplete.vue';

vi.stubGlobal('navigateTo', vi.fn());

beforeEach(() => {
  localStorage.clear();
  vi.mocked(navigateTo).mockClear();
  vi.stubGlobal('$fetch', vi.fn(async (url: string) => {
    if (url.includes('/popular')) return { success: true, data: { items: [{ keyword: '화장실' }] } };
    return { success: true, data: { items: [
      { type: 'region', label: '강남구', sublabel: '서울특별시', city: '서울특별시', district: '강남구' },
      { type: 'category', label: '강남구 화장실', category: 'toilet', city: '서울특별시', district: '강남구' },
    ] } };
  }));
})

describe('SearchAutocomplete', () => {
  it('빈 입력 + 최근검색 있으면 최근검색 노출', async () => {
    localStorage.setItem('ilsangkit:recentSearches', JSON.stringify(['강남 래미안']));
    const wrapper = mount(SearchAutocomplete, { props: { open: true, modelValue: '' } });
    await flushPromises();
    expect(wrapper.text()).toContain('최근 검색');
    expect(wrapper.text()).toContain('강남 래미안');
  });

  it('입력 시 지역 추천이 렌더되고 클릭하면 지역 URL로 이동', async () => {
    const wrapper = mount(SearchAutocomplete, { props: { open: true, modelValue: '강남' } });
    await flushPromises();
    await new Promise((r) => setTimeout(r, 250)); // 디바운스
    await flushPromises();
    expect(wrapper.text()).toContain('강남구');
    await wrapper.find('[data-suggest-type="region"]').trigger('click');
    expect(navigateTo).toHaveBeenCalledWith('/seoul/gangnam');
  });
});
