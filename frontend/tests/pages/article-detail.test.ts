import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref, defineComponent, h, Suspense, onErrorCaptured } from 'vue'
import ArticlePage from '~/pages/article/[slug].vue'

// ─── Mock 데이터 ──────────────────────────────────────────────────────────────

const mockArticleBase = {
  id: 'a1',
  slug: 'today-issue-1',
  title: '오늘의 부동산 이슈',
  summary: '오늘의 부동산 시장 동향을 정리했습니다.',
  content: [
    '# 오늘의 이슈',
    '본문 첫 문단입니다.',
    '',
    '## 첫 번째 소제목',
    '내용1',
    '',
    '## 두 번째 소제목',
    '내용2',
    '',
    '## 세 번째 소제목',
    '내용3',
  ].join('\n'),
  category: 'hospital',
  articleType: 'news',
  thumbnailUrl: null,
  keywords: '부동산,시세',
  viewCount: 120,
  // updatedAt is 5s after publishedAt → within the 60s threshold → dateModified omitted
  publishedAt: '2026-07-01T09:00:00.000Z',
  createdAt: '2026-07-01T09:00:00.000Z',
  updatedAt: '2026-07-01T09:00:05.000Z',
  sources: [{ title: '국토교통부', url: 'https://molit.go.kr' }] as Array<{ title: string; url: string }> | null,
}

const mockArticleModified = {
  ...mockArticleBase,
  id: 'a2',
  slug: 'today-issue-2',
  // updatedAt is 1 day after publishedAt → well past the 60s threshold → dateModified included
  updatedAt: '2026-07-02T09:00:00.000Z',
}

// ─── Composable mocks ─────────────────────────────────────────────────────────

const mockSetMeta = vi.fn()
const mockSetArticleSchema = vi.fn()
const mockSetBreadcrumbSchema = vi.fn()

vi.mock('~/composables/useFacilityMeta', () => ({
  useFacilityMeta: () => ({
    setMeta: mockSetMeta,
  }),
}))

vi.mock('~/composables/useStructuredData', () => ({
  useStructuredData: () => ({
    setBreadcrumbSchema: mockSetBreadcrumbSchema,
    setArticleSchema: mockSetArticleSchema,
  }),
}))

vi.mock('~/composables/useArticles', () => ({
  useArticles: () => ({
    fetchArticleBySlug: vi.fn().mockResolvedValue(mockArticleBase),
  }),
}))

// ─── Global stubs ─────────────────────────────────────────────────────────────

vi.stubGlobal('useRoute', () => ({
  params: { slug: 'today-issue-1' },
  path: '/article/today-issue-1',
}))

vi.stubGlobal('definePageMeta', vi.fn())

const mockCreateError = vi.fn((opts: { statusCode: number; statusMessage?: string }) => {
  const err = new Error(opts.statusMessage || 'Error')
  ;(err as Error & { statusCode: number }).statusCode = opts.statusCode
  return err
})
vi.stubGlobal('createError', mockCreateError)

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
}

async function mountArticlePage(article: unknown = mockArticleBase) {
  mockUseAsyncDataWith(article)
  const wrapper = mount(
    defineComponent({
      render() {
        return h(Suspense, null, { default: () => h(ArticlePage) })
      },
    }),
    { global: { stubs: globalStubs } },
  )
  await flushPromises()
  return wrapper
}

function expectedFormattedDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ArticlePage - /article/[slug]', () => {
  beforeEach(() => {
    mockSetMeta.mockClear()
    mockSetArticleSchema.mockClear()
    mockSetBreadcrumbSchema.mockClear()
    mockCreateError.mockClear()
  })

  it('제목·본문(마크다운→HTML)·발행일을 렌더링한다', async () => {
    const wrapper = await mountArticlePage(mockArticleBase)

    expect(wrapper.text()).toContain(mockArticleBase.title)
    expect(wrapper.html()).toContain('첫 번째 소제목')
    expect(wrapper.html()).toContain('두 번째 소제목')
    expect(wrapper.text()).toContain(expectedFormattedDate(mockArticleBase.publishedAt))
  })

  it('마크다운 렌더 결과를 sanitize한다 (script 태그 제거)', async () => {
    const malicious = { ...mockArticleBase, content: '# 제목\n\n<script>alert(1)</script>\n\n본문 내용' }
    const wrapper = await mountArticlePage(malicious)

    expect(wrapper.html()).not.toContain('<script>')
  })

  it('article이 없으면 createError(404)를 호출한다', async () => {
    mockUseAsyncDataWith(null)
    mount(
      defineComponent({
        setup() {
          onErrorCaptured(() => false)
          return () => h(Suspense, null, { default: () => h(ArticlePage) })
        },
      }),
      { global: { stubs: globalStubs } },
    )
    await flushPromises()

    expect(mockCreateError).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 404 }),
    )
  })

  it('sources가 있으면 출처 섹션을 렌더링한다', async () => {
    const wrapper = await mountArticlePage(mockArticleBase)

    const section = wrapper.find('[data-testid="article-sources"]')
    expect(section.exists()).toBe(true)
    expect(section.text()).toContain('국토교통부')
  })

  it('sources가 null이면 출처 섹션을 렌더링하지 않는다', async () => {
    const wrapper = await mountArticlePage({ ...mockArticleBase, sources: null })

    expect(wrapper.find('[data-testid="article-sources"]').exists()).toBe(false)
  })

  it('sources가 빈 배열이면 출처 섹션을 렌더링하지 않는다', async () => {
    const wrapper = await mountArticlePage({ ...mockArticleBase, sources: [] })

    expect(wrapper.find('[data-testid="article-sources"]').exists()).toBe(false)
  })

  it('setArticleSchema가 datePublished=publishedAt, url=/article/{slug}로 호출된다', async () => {
    await mountArticlePage(mockArticleBase)

    expect(mockSetArticleSchema).toHaveBeenCalledWith(
      expect.objectContaining({
        headline: mockArticleBase.title,
        description: mockArticleBase.summary,
        datePublished: mockArticleBase.publishedAt,
        url: `/article/${mockArticleBase.slug}`,
      }),
    )
  })

  it('updatedAt이 publishedAt과 거의 같으면(60초 이내) dateModified가 생략된다', async () => {
    await mountArticlePage(mockArticleBase)

    const call = mockSetArticleSchema.mock.calls[0][0] as { dateModified?: string }
    expect(call.dateModified).toBeUndefined()
  })

  it('updatedAt이 publishedAt보다 유의미하게 늦으면 dateModified가 포함된다', async () => {
    await mountArticlePage(mockArticleModified)

    const call = mockSetArticleSchema.mock.calls[0][0] as { dateModified?: string }
    expect(call.dateModified).toBe(mockArticleModified.updatedAt)
  })

  it('setMeta가 path:"/article/{slug}"(자기 canonical)·type:"article"로 호출된다', async () => {
    await mountArticlePage(mockArticleBase)

    expect(mockSetMeta).toHaveBeenCalledWith(
      expect.objectContaining({
        path: `/article/${mockArticleBase.slug}`,
        type: 'article',
      }),
    )
  })

  it('setBreadcrumbSchema가 홈·오늘의 이슈·title 순서로 호출된다', async () => {
    await mountArticlePage(mockArticleBase)

    expect(mockSetBreadcrumbSchema).toHaveBeenCalledWith([
      { name: '홈', url: '/' },
      { name: '오늘의 이슈', url: '/article' },
      { name: mockArticleBase.title, url: `/article/${mockArticleBase.slug}` },
    ])
  })

  it('AI 작성 안내 블록이 존재한다', async () => {
    const wrapper = await mountArticlePage(mockArticleBase)

    expect(wrapper.text()).toContain('AI 작성 안내')
  })

  it('viewCount >= 100이면 조회수 visibility를 렌더링한다', async () => {
    const wrapper = await mountArticlePage({ ...mockArticleBase, viewCount: 150 })

    const text = wrapper.text()
    // visibility 텍스트 콘텐츠에 150이 포함되어 있는지 확인
    expect(text).toContain('visibility')
    expect(text).toContain('150')
  })

  it('viewCount < 100이면 조회수 visibility를 렌더링하지 않는다', async () => {
    const wrapper = await mountArticlePage({ ...mockArticleBase, viewCount: 50 })

    const text = wrapper.text()
    // visibility 텍스트가 renderring되지 않거나 50이 함께 표시되지 않아야 함
    const hasVisibilityWith50 = text.includes('visibility') && text.match(/visibility\s*50/)
    expect(hasVisibilityWith50).toBe(false)
  })

  it('삭제된 카테고리(public-rental) 기사는 히어로 pill에 raw slug 대신 안전 폴백 라벨을 표시한다', async () => {
    const wrapper = await mountArticlePage({ ...mockArticleBase, category: 'public-rental' })

    expect(wrapper.text()).not.toContain('public-rental')
    expect(wrapper.text()).toContain('매입임대')
  })
})
