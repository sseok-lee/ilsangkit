import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import SearchAutocomplete from '~/components/search/SearchAutocomplete.vue';

vi.stubGlobal('navigateTo', vi.fn());
beforeEach(() => {
  localStorage.clear();
  vi.mocked(navigateTo).mockClear();
  vi.stubGlobal('$fetch', vi.fn(async (url: string) => {
    if (url.includes('/popular')) return { success: true, data: { items: [] } };
    return { success: true, data: { items: [
      { type: 'region', label: '강남구', sublabel: '서울특별시', city: '서울특별시', district: '강남구' },
      { type: 'category', label: '강남구 화장실', category: 'toilet', city: '서울특별시', district: '강남구' },
    ] } };
  }));
});

function makeKey(key: string) { return new KeyboardEvent('keydown', { key }); }

describe('SearchAutocomplete 키보드', () => {
  it('ArrowDown→Enter로 첫 추천 항목 선택(지역→/seoul/gangnam)', async () => {
    const wrapper = mount(SearchAutocomplete, { props: { open: true, modelValue: '강남' } });
    await flushPromises();
    await new Promise((r) => setTimeout(r, 250));
    await flushPromises();
    const vm = wrapper.vm as unknown as { onKeydown: (e: KeyboardEvent) => boolean };
    vm.onKeydown(makeKey('ArrowDown'));   // activeIndex 0 → region
    const handled = vm.onKeydown(makeKey('Enter'));
    expect(handled).toBe(true);
    expect(navigateTo).toHaveBeenCalledWith('/seoul/gangnam');
  });

  it('활성 항목 없을 때 Enter는 소비하지 않는다(false 반환)', async () => {
    const wrapper = mount(SearchAutocomplete, { props: { open: true, modelValue: '강남' } });
    await flushPromises();
    const vm = wrapper.vm as unknown as { onKeydown: (e: KeyboardEvent) => boolean };
    const handled = vm.onKeydown(makeKey('Enter')); // activeIndex still -1
    expect(handled).toBe(false);
  });

  it('Escape는 close를 emit한다', async () => {
    const wrapper = mount(SearchAutocomplete, { props: { open: true, modelValue: '강남' } });
    await flushPromises();
    const vm = wrapper.vm as unknown as { onKeydown: (e: KeyboardEvent) => boolean };
    vm.onKeydown(makeKey('Escape'));
    expect(wrapper.emitted('close')).toBeTruthy();
  });
});
