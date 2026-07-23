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

  it('지역 추천 city가 축약명(서울)이어도 올바른 슬러그로 이동', async () => {
    // 실제 suggest API는 region item을 축약 city명으로 반환한다
    vi.mocked($fetch).mockImplementation(async (url: string) => {
      if (url.includes('/popular')) return { success: true, data: { items: [] } };
      return { success: true, data: { items: [
        { type: 'region', label: '강남구', sublabel: '서울', city: '서울', district: '강남구' },
      ] } };
    });
    const wrapper = mount(SearchAutocomplete, { props: { open: true, modelValue: '강남' } });
    await flushPromises();
    await new Promise((r) => setTimeout(r, 250));
    await flushPromises();
    await wrapper.find('[data-suggest-type="region"]').trigger('click');
    expect(navigateTo).toHaveBeenCalledWith('/seoul/gangnam');
  });

  // 한글 IME 조합 중에는 v-model(modelValue)이 마지막 커밋 음절까지만 갱신되어
  // 한 음절 지연된다("강남" 입력 시 modelValue는 "강"). 부모가 네이티브 input의
  // 실시간 값을 setQuery로 직접 넘기면 컴포넌트는 지연 없이 그 값으로 추천해야 한다.
  it('setQuery로 넘긴 실시간 값이 modelValue보다 우선해 추천된다 (IME 지연 보정)', async () => {
    const wrapper = mount(SearchAutocomplete, { props: { open: true, modelValue: '강' } });
    await flushPromises();
    await new Promise((r) => setTimeout(r, 250));
    await flushPromises();
    vi.mocked($fetch).mockClear();

    // 부모 @input이 조합 중 실시간 값을 전달하는 상황
    (wrapper.vm as unknown as { setQuery: (q: string) => void }).setQuery('강남');
    await new Promise((r) => setTimeout(r, 250)); // 디바운스
    await flushPromises();

    // suggest는 modelValue('강')가 아니라 실시간 값('강남')으로 호출되어야 한다
    const calls = vi.mocked($fetch).mock.calls.filter(
      (c) => typeof c[0] === 'string' && (c[0] as string).includes('/suggest'),
    );
    expect(calls.length).toBeGreaterThan(0);
    expect(calls.some((c) => (c[1] as { params?: { q?: string } })?.params?.q === '강남')).toBe(true);
    // "그대로 검색" 행도 실시간 값을 표시
    expect(wrapper.text()).toContain('"강남"');
  });

  // 회귀 가드: 이 드롭다운은 홈 히어로(text-white) 안에 렌더된다. 루트에 텍스트 색을
  // 명시하지 않으면 최근/인기 검색·추천 텍스트가 흰 글씨로 상속돼 흰 배경 위에서 안 보인다.
  // 색 상속은 happy-dom에서 계산되지 않으므로, 루트에 명시적 어두운 텍스트 색 클래스가
  // 존재하는지로 가드한다(text-white 는 매치되지 않음).
  it('루트에 명시적 어두운 텍스트 색이 있어 히어로 text-white 상속을 차단한다', async () => {
    const wrapper = mount(SearchAutocomplete, { props: { open: true, modelValue: '' } });
    await flushPromises();
    const rootClasses = wrapper.get('.search-ac').classes();
    expect(rootClasses.some((c) => /^text-(slate|gray|zinc|neutral|ink|strong)/.test(c))).toBe(true);
  });
});
