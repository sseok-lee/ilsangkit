import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import AppHeader from '~/components/common/AppHeader.vue';
import HeaderSearch from '~/components/common/HeaderSearch.vue';

describe('AppHeader 검색 통합', () => {
  it('HeaderSearch 컴포넌트를 포함한다', () => {
    const wrapper = mount(AppHeader, {
      global: {
        stubs: {
          HardLink: true,
          CategoryIcon: true,
          HeaderSearch: true,
        },
        mocks: {
          // setup.ts의 글로벌 mock을 여기서도 명시 — vue-router injection 오류 방지
          useRoute: () => ({ path: '/some-page', params: {}, query: {} }),
        },
      },
    });
    // HeaderSearch가 stub으로 등록됐을 때 컴포넌트 인스턴스로 찾기
    const found =
      wrapper.findComponent(HeaderSearch).exists() ||
      wrapper.findComponent({ name: 'HeaderSearch' }).exists();
    expect(found).toBe(true);
  });
});
