import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h, Suspense, ref, computed, watch, watchEffect, onMounted, onUnmounted } from 'vue'
import RealEstateHubPage from '~/pages/real-estate/index.vue'

// Stub Vue auto-imports
;(globalThis as any).ref = ref
;(globalThis as any).computed = computed
;(globalThis as any).watch = watch
;(globalThis as any).watchEffect = watchEffect
;(globalThis as any).onMounted = onMounted
;(globalThis as any).onUnmounted = onUnmounted

const mockSetBreadcrumbSchema = vi.fn()
const mockSetItemListSchema = vi.fn()

vi.mock('~/composables/useStructuredData', () => ({
  useStructuredData: () => ({
    setBreadcrumbSchema: mockSetBreadcrumbSchema,
    setItemListSchema: mockSetItemListSchema,
    setDatasetSchema: vi.fn(),
  }),
}))

vi.mock('~/utils/seoConstants', () => ({
  SITE_URL: 'https://ilsangkit.co.kr',
  SITE_NAME: '일상킷',
  SITE_TAGLINE: '생활정보 플랫폼',
  SITE_DESCRIPTION: '일상킷 - 생활정보 플랫폼',
  DEFAULT_OG_IMAGE: 'https://ilsangkit.co.kr/og.png',
}))

beforeEach(() => {
  mockSetBreadcrumbSchema.mockClear()
  mockSetItemListSchema.mockClear()
})

// RealEstateMapExplorer 는 useKakaoMap(shallowRef 등 브라우저 전제)을 물고 있어 stub 없이
// 마운트하면 크래시한다 — 지도 자체는 이 테스트의 관심사가 아니다(별도 지도 컴포넌트 테스트가 커버).
const globalStubs = {
  RealEstateMapExplorer: { template: '<div data-stub="map-explorer" />' },
  AdBanner: { template: '<div />' },
  RealEstateCategoryCards: { template: '<div />' },
  DataSourceSection: { template: '<div />' },
  SectionBlock: { template: '<section><slot name="heading" /><slot /></section>' },
}

async function mountSuspended(component: any, options?: any) {
  const wrapper = mount(
    defineComponent({
      render() {
        return h(Suspense, null, {
          default: () => h(component, options?.props),
        })
      },
    }),
    { global: { stubs: globalStubs } },
  )
  await flushPromises()
  return wrapper
}

describe('/real-estate 허브 페이지 하단 콘텐츠', () => {
  it('"부동산 유형별 실거래가" H2 섹션이 존재해야 한다', async () => {
    const wrapper = await mountSuspended(RealEstateHubPage)
    const h2Elements = wrapper.findAll('h2')
    const texts = h2Elements.map(el => el.text())
    expect(texts.some(t => t.includes('부동산 유형별') || t.includes('실거래가'))).toBe(true)
  })

  it('"부동산 실거래가란?" H2 섹션이 존재해야 한다', async () => {
    const wrapper = await mountSuspended(RealEstateHubPage)
    const h2Elements = wrapper.findAll('h2')
    const texts = h2Elements.map(el => el.text())
    expect(texts.some(t => t.includes('부동산 실거래가란'))).toBe(true)
  })

  it('토지 실거래가 카드가 /real-estate/land 로 링크되어야 한다 (유형 카드 7개 유지)', async () => {
    const wrapper = await mountSuspended(RealEstateHubPage)
    expect(wrapper.find('a[href="/real-estate/land"]').exists()).toBe(true)
  })
})
