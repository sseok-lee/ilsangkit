import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref, defineComponent, h, Suspense, onErrorCaptured } from 'vue'
import GuidePage from '~/pages/guide/[slug].vue'

// ─── Mock 데이터 ──────────────────────────────────────────────────────────────

const mockGuide = {
  id: 10,
  slug: 'nearest-pharmacy-guide',
  title: '내 주변 약국 찾는 방법',
  summary: '가까운 약국을 쉽게 찾는 방법을 안내합니다.',
  content: '# 약국 찾기\n\n가까운 약국을 찾으세요.',
  category: 'pharmacy',
  articleType: 'news',
  keywords: '약국,의약품,처방',
  thumbnailUrl: null,
  viewCount: 250,
  createdAt: '2024-03-15T00:00:00Z',
  updatedAt: '2024-03-20T00:00:00Z',
}

const mockArticle = {
  id: 'a1',
  slug: 'nearest-pharmacy-guide',
  title: '내 주변 약국 찾는 방법 (migrated)',
  summary: '가까운 약국을 쉽게 찾는 방법을 안내합니다.',
  content: '# 약국 찾기\n\n가까운 약국을 찾으세요.',
  category: 'pharmacy',
  articleType: 'news',
  thumbnailUrl: null,
  keywords: '약국,의약품,처방',
  viewCount: 250,
  publishedAt: '2024-03-15T00:00:00Z',
  createdAt: '2024-03-15T00:00:00Z',
  updatedAt: '2024-03-20T00:00:00Z',
  sources: null,
}

// ─── Composable mocks ─────────────────────────────────────────────────────────

const mockSetArticleSchema = vi.fn()
const mockSetBreadcrumbSchema = vi.fn()
const mockSetFAQSchema = vi.fn()
const mockSetHowToSchema = vi.fn()
const mockSetMeta = vi.fn()
const mockFetchArticleBySlug = vi.fn()

vi.mock('~/composables/useStructuredData', () => ({
  useStructuredData: () => ({
    setBreadcrumbSchema: mockSetBreadcrumbSchema,
    setFAQSchema: mockSetFAQSchema,
    setHowToSchema: mockSetHowToSchema,
    setArticleSchema: mockSetArticleSchema,
  }),
}))

vi.mock('~/composables/useFacilityMeta', () => ({
  useFacilityMeta: () => ({
    setMeta: mockSetMeta,
    setHomeMeta: vi.fn(),
  }),
}))

vi.mock('~/composables/useGuides', () => ({
  useGuides: () => ({
    fetchGuideBySlug: vi.fn().mockResolvedValue(mockGuide),
    fetchGuides: vi.fn().mockResolvedValue([]),
  }),
}))

vi.mock('~/composables/useArticles', () => ({
  useArticles: () => ({
    fetchArticleBySlug: mockFetchArticleBySlug,
  }),
}))

// ─── Global stubs ─────────────────────────────────────────────────────────────

vi.stubGlobal('useRoute', () => ({
  params: { slug: 'nearest-pharmacy-guide' },
  path: '/guide/nearest-pharmacy-guide',
}))

vi.stubGlobal('definePageMeta', vi.fn())

const mockCreateError = vi.fn((opts: { statusCode: number; statusMessage?: string }) => {
  const err = new Error(opts.statusMessage || 'Error')
  ;(err as Error & { statusCode: number }).statusCode = opts.statusCode
  return err
})
vi.stubGlobal('createError', mockCreateError)

const mockNavigateTo = vi.fn()
vi.stubGlobal('navigateTo', mockNavigateTo)

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mockUseAsyncDataWith(data: unknown, status = 'success') {
  const result = {
    data: ref(data),
    status: ref(status),
    error: ref(null),
    refresh: vi.fn(),
    pending: ref(status === 'pending'),
  }
  ;(globalThis as Record<string, unknown>).useAsyncData = vi.fn(() =>
    Object.assign(Promise.resolve(result), result),
  )
}

const globalStubs = {
  ClientOnly: { template: '<div><slot /></div>' },
  RelatedGuides: { template: '<div class="stub-related-guides" />' },
}

async function mountGuidePage(guide: unknown = mockGuide) {
  mockUseAsyncDataWith(guide)
  const wrapper = mount(
    defineComponent({
      setup() {
        onErrorCaptured(() => false)
        return () => h(Suspense, null, { default: () => h(GuidePage) })
      },
    }),
    { global: { stubs: globalStubs } },
  )
  await flushPromises()
  return wrapper
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GuidePage - /article 301 폴백 (컷오버 inert)', () => {
  beforeEach(() => {
    mockSetArticleSchema.mockClear()
    mockSetBreadcrumbSchema.mockClear()
    mockSetFAQSchema.mockClear()
    mockSetHowToSchema.mockClear()
    mockSetMeta.mockClear()
    mockFetchArticleBySlug.mockReset()
    mockCreateError.mockClear()
    mockNavigateTo.mockClear()
  })

  it('guide가 존재하면 정상 렌더되고 navigateTo는 호출되지 않는다', async () => {
    const wrapper = await mountGuidePage(mockGuide)

    expect(wrapper.text()).toContain(mockGuide.title)
    expect(mockNavigateTo).not.toHaveBeenCalled()
    expect(mockCreateError).not.toHaveBeenCalled()
  })

  it('guide가 없고 같은 slug의 published Article이 있으면 /article/{slug}로 301 리다이렉트한다', async () => {
    mockFetchArticleBySlug.mockResolvedValue(mockArticle)

    await mountGuidePage(null)

    expect(mockFetchArticleBySlug).toHaveBeenCalledWith('nearest-pharmacy-guide')
    expect(mockNavigateTo).toHaveBeenCalledWith(
      '/article/nearest-pharmacy-guide',
      expect.objectContaining({ redirectCode: 301 }),
    )
    expect(mockCreateError).not.toHaveBeenCalled()
  })

  it('guide도 없고 Article도 없으면(백엔드 404) createError(404)를 호출한다', async () => {
    // ⚠️ 상태코드 없는 맨 Error 로 바꾸지 말 것. 그건 "없다"가 아니라 "못 물어봤다"이고,
    //    프로덕션에서 $fetch 가 백엔드 404 를 줄 때는 statusCode 가 실려 온다.
    mockFetchArticleBySlug.mockRejectedValue(Object.assign(new Error('not found'), { statusCode: 404 }))

    await mountGuidePage(null)

    expect(mockCreateError).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 404 }),
    )
    expect(mockNavigateTo).not.toHaveBeenCalled()
  })

  it('301 판정용 Article 조회가 일시 실패하면 404 로 굳히지 않는다 (fail-open)', async () => {
    // 5xx·타임아웃처럼 상태코드가 404/422 가 아닌 실패. 이걸 부재로 뭉개면
    // /article 로 301 해줘야 할 URL 이 하드 404 로 색인된다.
    mockFetchArticleBySlug.mockRejectedValue(Object.assign(new Error('boom'), { statusCode: 503 }))

    await mountGuidePage(null)

    expect(mockCreateError).not.toHaveBeenCalled()
    expect(mockNavigateTo).not.toHaveBeenCalled()
  })
})
