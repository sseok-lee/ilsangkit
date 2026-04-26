import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref, defineComponent, h, Suspense, onErrorCaptured } from 'vue'
import GuidePage from '~/pages/guide/[slug].vue'

// ─── Mock 데이터 ──────────────────────────────────────────────────────────────

const mockGuideNews = {
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

const mockGuideHowTo = {
  id: 11,
  slug: 'parking-howto',
  title: '공영주차장 이용 방법',
  summary: '공영주차장을 저렴하게 이용하는 단계별 방법입니다.',
  content: [
    '# 공영주차장 이용 방법',
    '',
    '## 단계별 방법',
    '1. **주차장 검색** 앱이나 웹에서 검색하세요.',
    '2. **요금 확인** 시간당 요금을 확인하세요.',
    '',
    '## 자주 묻는 질문',
    '**Q. 주차 요금은 얼마인가요?**',
    'A. 지역마다 다르지만 보통 시간당 500-1000원입니다.',
  ].join('\n'),
  category: 'parking',
  articleType: 'howto',
  keywords: '주차장,공영주차,주차요금',
  thumbnailUrl: '/uploads/parking.jpg',
  viewCount: 500,
  createdAt: '2024-02-10T00:00:00Z',
  updatedAt: '2024-02-12T00:00:00Z',
}

// ─── Composable mocks ─────────────────────────────────────────────────────────

const mockSetArticleSchema = vi.fn()
const mockSetBreadcrumbSchema = vi.fn()
const mockSetFAQSchema = vi.fn()
const mockSetHowToSchema = vi.fn()

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
    setMeta: vi.fn(),
    setHomeMeta: vi.fn(),
  }),
}))

vi.mock('~/composables/useGuides', () => ({
  useGuides: () => ({
    fetchGuideBySlug: vi.fn().mockResolvedValue(mockGuideNews),
    fetchGuides: vi.fn().mockResolvedValue([]),
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

async function mountGuidePage(guide = mockGuideNews) {
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

describe('GuidePage - Article 스키마 (TDD Red 단계)', () => {
  beforeEach(() => {
    mockSetArticleSchema.mockClear()
    mockSetBreadcrumbSchema.mockClear()
    mockSetFAQSchema.mockClear()
    mockSetHowToSchema.mockClear()
  })

  it('가이드 데이터가 있을 때 setArticleSchema가 호출된다', async () => {
    await mountGuidePage(mockGuideNews)

    expect(mockSetArticleSchema).toHaveBeenCalledTimes(1)
  })

  it('setArticleSchema에 headline으로 guide.title이 전달된다', async () => {
    await mountGuidePage(mockGuideNews)

    expect(mockSetArticleSchema).toHaveBeenCalledWith(
      expect.objectContaining({
        headline: mockGuideNews.title,
      }),
    )
  })

  it('setArticleSchema에 description으로 guide.summary가 전달된다', async () => {
    await mountGuidePage(mockGuideNews)

    expect(mockSetArticleSchema).toHaveBeenCalledWith(
      expect.objectContaining({
        description: mockGuideNews.summary,
      }),
    )
  })

  it('setArticleSchema에 datePublished로 guide.createdAt이 전달된다', async () => {
    await mountGuidePage(mockGuideNews)

    expect(mockSetArticleSchema).toHaveBeenCalledWith(
      expect.objectContaining({
        datePublished: mockGuideNews.createdAt,
      }),
    )
  })

  it('setArticleSchema에 dateModified로 guide.updatedAt이 전달된다', async () => {
    await mountGuidePage(mockGuideNews)

    expect(mockSetArticleSchema).toHaveBeenCalledWith(
      expect.objectContaining({
        dateModified: mockGuideNews.updatedAt,
      }),
    )
  })

  it('setArticleSchema에 url에 guide.slug가 포함된다', async () => {
    await mountGuidePage(mockGuideNews)

    const call = mockSetArticleSchema.mock.calls[0][0] as { url: string }
    expect(call.url).toContain(mockGuideNews.slug)
  })

  it('thumbnailUrl이 있을 때 setArticleSchema에 image가 전달된다', async () => {
    await mountGuidePage(mockGuideHowTo)

    expect(mockSetArticleSchema).toHaveBeenCalledWith(
      expect.objectContaining({
        image: expect.stringContaining(mockGuideHowTo.thumbnailUrl as string),
      }),
    )
  })

  it('thumbnailUrl이 null이면 setArticleSchema에 image가 전달되지 않거나 undefined이다', async () => {
    await mountGuidePage(mockGuideNews)

    const call = mockSetArticleSchema.mock.calls[0][0] as { image?: string }
    // image 필드가 없거나 undefined/null이어야 한다
    expect(call.image == null).toBe(true)
  })

  it('가이드 데이터가 없을 때 setArticleSchema는 호출되지 않는다', async () => {
    mockUseAsyncDataWith(null)

    mount(
      defineComponent({
        setup() {
          onErrorCaptured(() => false)
          return () => h(Suspense, null, { default: () => h(GuidePage) })
        },
      }),
      { global: { stubs: globalStubs } },
    )
    await flushPromises()

    expect(mockSetArticleSchema).not.toHaveBeenCalled()
  })
})
