import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref, defineComponent, h, Suspense } from 'vue'
import ArticleIndexPage from '~/pages/article/index.vue'

// ─── Mock 데이터 ──────────────────────────────────────────────────────────────

const mockArticles = [
  {
    id: 'a1',
    slug: 'issue-1',
    title: '오늘의 이슈 1',
    summary: '오늘의 부동산 시장 요약입니다.',
    category: 'apt-sale',
    articleType: 'news',
    thumbnailUrl: null,
    keywords: null,
    viewCount: 150,
    publishedAt: '2026-07-01T09:00:00.000Z',
    createdAt: '2026-07-01T09:00:00.000Z',
  },
  {
    id: 'a2',
    slug: 'issue-2',
    title: '오늘의 이슈 2',
    summary: '오늘의 청약 소식 요약입니다.',
    category: 'subscription',
    articleType: 'news',
    thumbnailUrl: null,
    keywords: null,
    viewCount: 50,
    publishedAt: '2026-06-30T09:00:00.000Z',
    createdAt: '2026-06-30T09:00:00.000Z',
  },
  {
    id: 'a3',
    slug: 'issue-3',
    title: '오늘의 이슈 3',
    summary: '삭제된 공공임대 카테고리 이슈입니다.',
    category: 'public-rental',
    articleType: 'news',
    thumbnailUrl: null,
    keywords: null,
    viewCount: 10,
    publishedAt: '2026-06-29T09:00:00.000Z',
    createdAt: '2026-06-29T09:00:00.000Z',
  },
]

// ─── Composable mocks ─────────────────────────────────────────────────────────

const mockFetchArticles = vi.fn()

vi.mock('~/composables/useArticles', () => ({
  useArticles: () => ({
    fetchArticles: mockFetchArticles,
  }),
}))

const mockSetMeta = vi.fn()
vi.mock('~/composables/useFacilityMeta', () => ({
  useFacilityMeta: () => ({
    setMeta: mockSetMeta,
  }),
}))

const mockSetBreadcrumbSchema = vi.fn()
const mockSetItemListSchema = vi.fn()
vi.mock('~/composables/useStructuredData', () => ({
  useStructuredData: () => ({
    setBreadcrumbSchema: mockSetBreadcrumbSchema,
    setItemListSchema: mockSetItemListSchema,
  }),
}))

// ─── Helpers ──────────────────────────────────────────────────────────────────

// useAsyncData가 실제로 handler(fetchArticles 호출부)를 실행하도록 목킹한다.
// (article-detail.test.ts의 mockUseAsyncDataWith와 달리, 여기선 handler 인자로
// 넘어온 fetchArticles 호출 여부·인자를 검증해야 하므로 handler를 직접 실행한다.)
function mockUseAsyncDataInvoking() {
  ;(globalThis as Record<string, unknown>).useAsyncData = vi.fn(
    (_key: string, handler: () => Promise<unknown>) => {
      const data = ref<unknown>(null)
      const status = ref('pending')
      const promise = handler().then((resolved: unknown) => {
        data.value = resolved
        status.value = 'success'
        return { data, status }
      })
      return Object.assign(promise, { data, status, error: ref(null), refresh: vi.fn(), pending: ref(false) })
    },
  )
}

const globalStubs = {
  Breadcrumb: true,
  PageHero: true,
  SectionBlock: { template: '<section><slot name="right" /><slot /></section>' },
  Pagination: true,
}

async function mountArticleIndex() {
  mockUseAsyncDataInvoking()
  const wrapper = mount(
    defineComponent({
      render() {
        return h(Suspense, null, { default: () => h(ArticleIndexPage) })
      },
    }),
    { global: { stubs: globalStubs } },
  )
  await flushPromises()
  return wrapper
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ArticleIndexPage - /article', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetchArticles.mockResolvedValue({ items: mockArticles, total: 2, page: 1, totalPages: 1 })
  })

  it('마운트 시 fetchArticles({page:1, limit:12})를 호출한다', async () => {
    await mountArticleIndex()

    expect(mockFetchArticles).toHaveBeenCalledWith({ page: 1, limit: 12 })
  })

  it('카드에 제목·카테고리·발행일을 렌더링하고 /article/{slug}로 링크한다', async () => {
    const wrapper = await mountArticleIndex()

    expect(wrapper.text()).toContain('오늘의 이슈 1')
    expect(wrapper.text()).toContain('2026.07.01')
    const link = wrapper.find('a[href="/article/issue-1"]')
    expect(link.exists()).toBe(true)
  })

  it('카테고리 chip 클릭 시 categories로 재요청한다 (client-side, route 변경 없음)', async () => {
    const wrapper = await mountArticleIndex()
    mockFetchArticles.mockClear()
    mockFetchArticles.mockResolvedValue({ items: [], total: 0, page: 1, totalPages: 1 })

    const buttons = wrapper.findAll('button')
    const realEstateChip = buttons.find(b => b.text() === '부동산')
    expect(realEstateChip).toBeTruthy()

    await realEstateChip!.trigger('click')
    await flushPromises()

    expect(mockFetchArticles).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 1,
        limit: 12,
        categories: expect.arrayContaining(['apt-sale']),
      }),
    )
    // route query param 없이 client-side로만 처리되어야 한다
    expect(wrapper.vm.$route?.query).toBeUndefined()
  })

  it('기사가 0건이면 빈 상태를 안전하게 렌더링한다 (크래시 없음)', async () => {
    mockFetchArticles.mockResolvedValue({ items: [], total: 0, page: 1, totalPages: 1 })

    const wrapper = await mountArticleIndex()

    expect(wrapper.findAll('a[href^="/article/"]').length).toBe(0)
    expect(wrapper.text()).toContain('오늘의 이슈')
  })

  it('setMeta({path:"/article"})·setBreadcrumbSchema·setItemListSchema를 호출한다', async () => {
    await mountArticleIndex()

    expect(mockSetMeta).toHaveBeenCalledWith(
      expect.objectContaining({ title: '오늘의 이슈 | 일상킷', path: '/article' }),
    )
    expect(mockSetBreadcrumbSchema).toHaveBeenCalledWith([
      { name: '홈', url: '/' },
      { name: '오늘의 이슈', url: '/article' },
    ])
    expect(mockSetItemListSchema).toHaveBeenCalledWith(
      mockArticles.map((a, i) => ({ name: a.title, url: `/article/${a.slug}`, position: i + 1 })),
    )
  })

  it('viewCount >= 100인 카드는 조회수 visibility를 렌더링한다', async () => {
    const wrapper = await mountArticleIndex()

    // 첫 번째 카드: viewCount 150 (>= 100)
    const link1 = wrapper.find('a[href="/article/issue-1"]')
    expect(link1.exists()).toBe(true)
    expect(link1.text()).toContain('150')
  })

  it('viewCount < 100인 카드는 조회수 visibility를 렌더링하지 않는다', async () => {
    const wrapper = await mountArticleIndex()

    // 두 번째 카드: viewCount 50 (< 100) - visibility div 전체가 렌더링되지 않음
    const link2 = wrapper.find('a[href="/article/issue-2"]')
    expect(link2.exists()).toBe(true)
    // 카드의 텍스트에 50이 포함되지 않아야 함
    expect(link2.text()).not.toContain('50')
  })

  it('삭제된 카테고리(public-rental) 카드는 raw slug 대신 안전 폴백 라벨을 표시한다', async () => {
    const wrapper = await mountArticleIndex()

    const link3 = wrapper.find('a[href="/article/issue-3"]')
    expect(link3.exists()).toBe(true)
    expect(link3.text()).not.toContain('public-rental')
    expect(link3.text()).toContain('매입임대')
  })
})
