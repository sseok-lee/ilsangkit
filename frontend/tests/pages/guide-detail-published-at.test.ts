import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref, defineComponent, h, Suspense } from 'vue'
import GuidePage from '~/pages/guide/[slug].vue'

// ─── Mock 데이터 ──────────────────────────────────────────────────────────────
// publishedAt !== createdAt인 케이스: SEO datePublished는 publishedAt을 따라야 한다.
const mockGuideWithPublishedAt = {
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
  publishedAt: '2024-06-01T00:00:00Z',
  updatedAt: '2024-06-05T00:00:00Z',
}

// publishedAt이 null인 케이스: createdAt으로 폴백해야 한다.
const mockGuideWithNullPublishedAt = {
  id: 11,
  slug: 'parking-howto',
  title: '공영주차장 이용 방법',
  summary: '공영주차장을 저렴하게 이용하는 단계별 방법입니다.',
  content: '# 공영주차장 이용 방법\n\n내용입니다.',
  category: 'parking',
  articleType: 'guide',
  keywords: '주차장,공영주차,주차요금',
  thumbnailUrl: null,
  viewCount: 500,
  createdAt: '2024-02-10T00:00:00Z',
  publishedAt: null,
  updatedAt: '2024-02-12T00:00:00Z',
}

// ─── Composable mocks ─────────────────────────────────────────────────────────

const mockSetArticleSchema = vi.fn()
const mockSetBreadcrumbSchema = vi.fn()
const mockSetFAQSchema = vi.fn()
const mockSetHowToSchema = vi.fn()
const mockSetMeta = vi.fn()
const useHeadMock = vi.fn()

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

let currentGuide: unknown = mockGuideWithPublishedAt

vi.mock('~/composables/useGuides', () => ({
  useGuides: () => ({
    fetchGuideBySlug: vi.fn(() => Promise.resolve(currentGuide)),
    fetchGuides: vi.fn().mockResolvedValue([]),
  }),
}))

vi.mock('~/composables/useArticles', () => ({
  useArticles: () => ({
    fetchArticleBySlug: vi.fn().mockRejectedValue(new Error('not found')),
  }),
}))

// ─── Global stubs ─────────────────────────────────────────────────────────────

vi.stubGlobal('useRoute', () => ({
  params: { slug: 'nearest-pharmacy-guide' },
  path: '/guide/nearest-pharmacy-guide',
}))

vi.stubGlobal('definePageMeta', vi.fn())
vi.stubGlobal('createError', vi.fn((opts: { statusCode: number; statusMessage?: string }) => {
  const err = new Error(opts.statusMessage || 'Error')
  ;(err as Error & { statusCode: number }).statusCode = opts.statusCode
  return err
}))
vi.stubGlobal('useHead', useHeadMock)

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

async function mountGuidePage(guide: unknown) {
  currentGuide = guide
  mockUseAsyncDataWith(guide)
  const wrapper = mount(
    defineComponent({
      render() {
        return h(Suspense, null, { default: () => h(GuidePage) })
      },
    }),
    { global: { stubs: globalStubs } },
  )
  await flushPromises()
  return wrapper
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GuidePage - SEO datePublished는 publishedAt을 따른다 (폴백 createdAt)', () => {
  beforeEach(() => {
    mockSetArticleSchema.mockClear()
    mockSetBreadcrumbSchema.mockClear()
    mockSetFAQSchema.mockClear()
    mockSetHowToSchema.mockClear()
    mockSetMeta.mockClear()
    useHeadMock.mockClear()
  })

  it('publishedAt이 있으면 setArticleSchema.datePublished는 publishedAt이다 (createdAt과 다름을 확인)', async () => {
    await mountGuidePage(mockGuideWithPublishedAt)

    // 픽스처가 실제로 createdAt !== publishedAt임을 전제로 한다 (그렇지 않으면 이 테스트는 무의미해짐)
    expect(mockGuideWithPublishedAt.publishedAt).not.toBe(mockGuideWithPublishedAt.createdAt)

    expect(mockSetArticleSchema).toHaveBeenCalledWith(
      expect.objectContaining({
        datePublished: mockGuideWithPublishedAt.publishedAt,
      }),
    )
  })

  it('publishedAt이 있어도 dateModified는 여전히 updatedAt이다 (수정 대상 아님)', async () => {
    await mountGuidePage(mockGuideWithPublishedAt)

    expect(mockSetArticleSchema).toHaveBeenCalledWith(
      expect.objectContaining({
        dateModified: mockGuideWithPublishedAt.updatedAt,
      }),
    )
  })

  it('publishedAt이 있으면 article:published_time meta content도 publishedAt이다', async () => {
    await mountGuidePage(mockGuideWithPublishedAt)

    const headCalls = useHeadMock.mock.calls.map(call => call[0])
    const metaEntry = headCalls
      .flatMap((arg: any) => arg?.meta ?? [])
      .find((m: any) => m?.property === 'article:published_time')

    expect(metaEntry?.content).toBe(mockGuideWithPublishedAt.publishedAt)
  })

  it('article:modified_time meta content는 여전히 updatedAt이다 (수정 대상 아님)', async () => {
    await mountGuidePage(mockGuideWithPublishedAt)

    const headCalls = useHeadMock.mock.calls.map(call => call[0])
    const metaEntry = headCalls
      .flatMap((arg: any) => arg?.meta ?? [])
      .find((m: any) => m?.property === 'article:modified_time')

    expect(metaEntry?.content).toBe(mockGuideWithPublishedAt.updatedAt)
  })

  it('publishedAt이 null이면 setArticleSchema.datePublished는 createdAt으로 폴백한다', async () => {
    await mountGuidePage(mockGuideWithNullPublishedAt)

    expect(mockSetArticleSchema).toHaveBeenCalledWith(
      expect.objectContaining({
        datePublished: mockGuideWithNullPublishedAt.createdAt,
      }),
    )
  })

  it('publishedAt이 null이면 article:published_time meta content도 createdAt으로 폴백한다', async () => {
    await mountGuidePage(mockGuideWithNullPublishedAt)

    const headCalls = useHeadMock.mock.calls.map(call => call[0])
    const metaEntry = headCalls
      .flatMap((arg: any) => arg?.meta ?? [])
      .find((m: any) => m?.property === 'article:published_time')

    expect(metaEntry?.content).toBe(mockGuideWithNullPublishedAt.createdAt)
  })
})
