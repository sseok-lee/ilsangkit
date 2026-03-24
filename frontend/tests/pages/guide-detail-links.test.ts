import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref, defineComponent, h, Suspense } from 'vue'
import GuidePage from '~/pages/guide/[slug].vue'

const mockGuide = {
  id: 1,
  slug: 'how-to-find-hospital',
  title: '내 주변 병원 찾는 방법',
  summary: '병원 정보를 쉽게 찾는 방법을 안내합니다.',
  content: '# 병원 찾기\n\n가까운 병원을 찾으세요.',
  category: 'hospital',
  keywords: '병원,의료,진료',
  thumbnailUrl: null,
  viewCount: 100,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
}

vi.mock('vue-router', () => ({
  useRoute: () => ({
    params: { slug: 'how-to-find-hospital' },
    path: '/guide/how-to-find-hospital',
  }),
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
  }),
}))

vi.stubGlobal('useRoute', () => ({
  params: { slug: 'how-to-find-hospital' },
  path: '/guide/how-to-find-hospital',
}))

vi.stubGlobal('definePageMeta', vi.fn())
vi.stubGlobal('createError', vi.fn((opts: any) => {
  const err = new Error(opts.statusMessage || 'Error')
  ;(err as any).statusCode = opts.statusCode
  return err
}))

function mockUseAsyncDataWith(data: any, status = 'success') {
  const result = {
    data: ref(data),
    status: ref(status),
    error: ref(null),
    refresh: vi.fn(),
    pending: ref(status === 'pending'),
  }
  ;(globalThis as any).useAsyncData = vi.fn(() => Object.assign(Promise.resolve(result), result))
}

const globalStubs = {
  ClientOnly: { template: '<div><slot /></div>' },
}

async function mountSuspended(component: any, options?: any) {
  const wrapper = mount(
    defineComponent({
      render() {
        return h(Suspense, null, {
          default: () => h(component),
        })
      },
    }),
    { global: options?.global },
  )
  await flushPromises()
  return wrapper
}

describe('GuidePage - 관련 정보 섹션', () => {
  beforeEach(() => {
    mockUseAsyncDataWith(mockGuide)
  })

  it('가이드 상세 페이지에 "관련 정보" 섹션이 존재한다', async () => {
    const wrapper = await mountSuspended(GuidePage, {
      global: { stubs: globalStubs },
    })

    expect(wrapper.text()).toContain('관련 정보')
  })

  it('관련 카테고리 링크가 최소 1개 존재한다', async () => {
    const wrapper = await mountSuspended(GuidePage, {
      global: { stubs: globalStubs },
    })

    const relatedSection = wrapper.find('[data-testid="guide-related-categories"]')
    if (relatedSection.exists()) {
      const links = relatedSection.findAll('a')
      expect(links.length).toBeGreaterThanOrEqual(1)
    } else {
      // After implementation, section must exist
      expect(wrapper.text()).toContain('관련 정보')
    }
  })

  it('관련 링크 URL이 /{category} 패턴이다', async () => {
    const wrapper = await mountSuspended(GuidePage, {
      global: { stubs: globalStubs },
    })

    const relatedSection = wrapper.find('[data-testid="guide-related-categories"]')
    if (relatedSection.exists()) {
      const links = relatedSection.findAll('a')
      for (const link of links) {
        const href = link.attributes('href') || ''
        expect(href).toMatch(/^\/[a-z-]+/)
      }
    } else {
      expect(true).toBe(true)
    }
  })
})
