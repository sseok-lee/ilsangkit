import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { defineComponent, h, Suspense, ref, computed, watch, watchEffect, onMounted, onUnmounted, readonly } from 'vue';
import IndexPage from '~/pages/index.vue';

// Stub Vue auto-imports that Nuxt provides but vitest doesn't
;(globalThis as any).ref = ref
;(globalThis as any).computed = computed
;(globalThis as any).watch = watch
;(globalThis as any).watchEffect = watchEffect
;(globalThis as any).onMounted = onMounted
;(globalThis as any).onUnmounted = onUnmounted
;(globalThis as any).readonly = readonly

vi.stubGlobal('navigateTo', vi.fn());

const homePagePayload = {
  dashboard: {
    total: 100000,
    buildingCount: 50000,
    subscriptionActiveCount: 5,
    newlyListedToday: 0,
    realEstateTrends: [],
    trendingBuildings: { sale: [], jeonse: [], wolse: [] },
    subscriptionSummary: { closingThisWeek: 0, upcomingNextWeek: 0, avgSupplyPrice: null, imminent: [] },
    realEstateHotspots: {},
  },
  recentGuides: [],
};

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('$fetch', vi.fn(async () => ({ success: true, data: { items: [] } })));
  ;(globalThis as any).useAsyncData = vi.fn((key?: string) => {
    const data = key === 'home-page' ? ref(homePagePayload) : ref(null);
    const result = { data, status: ref('idle'), error: ref(null), refresh: vi.fn(), pending: ref(false) };
    return Object.assign(Promise.resolve(result), result);
  });
});

async function mountSuspended(component: any, options?: any) {
  const wrapper = mount(
    defineComponent({
      render() {
        return h(Suspense, null, { default: () => h(component, options?.props) });
      },
    }),
    options,
  );
  await flushPromises();
  return wrapper;
}

describe('메인 히어로 자동완성', () => {
  it('히어로 입력 포커스 시 SearchAutocomplete 렌더', async () => {
    const wrapper = await mountSuspended(IndexPage);
    const input = wrapper.find('input[aria-label="단지명·동네·시설 검색"]');
    expect(input.exists()).toBe(true);
    await input.trigger('focus');
    expect(wrapper.findComponent({ name: 'SearchAutocomplete' }).exists()).toBe(true);
  });

  it('히어로 입력 blur 시 autocomplete closed', async () => {
    const wrapper = await mountSuspended(IndexPage);
    const input = wrapper.find('input[aria-label="단지명·동네·시설 검색"]');
    await input.trigger('focus');
    await input.trigger('blur');
    // After blur, heroFocused becomes false → open=false → SearchAutocomplete hides its content
    const ac = wrapper.findComponent({ name: 'SearchAutocomplete' });
    // Component exists but open=false means inner content is hidden (v-if="open")
    expect(ac.exists()).toBe(true);
    expect(ac.props('open')).toBe(false);
  });

  it('SearchAutocomplete에 modelValue로 searchKeyword 전달', async () => {
    const wrapper = await mountSuspended(IndexPage);
    const input = wrapper.find('input[aria-label="단지명·동네·시설 검색"]');
    await input.trigger('focus');
    await input.setValue('강남');
    const ac = wrapper.findComponent({ name: 'SearchAutocomplete' });
    expect(ac.props('modelValue')).toBe('강남');
  });
});
