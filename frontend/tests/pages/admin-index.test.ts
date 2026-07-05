import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import AdminIndexPage from '~/pages/admin/index.vue'

function makeSummary(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: '1',
    title: '오늘의 화장실 이슈',
    slug: 'todays-toilet-issue',
    summary: '요약 텍스트입니다.',
    category: 'toilet',
    articleType: 'issue',
    thumbnailUrl: null,
    keywords: '화장실,공중화장실',
    status: 'draft',
    viewCount: 0,
    publishedAt: null,
    createdAt: '2026-07-01T00:00:00Z',
    updatedAt: '2026-07-01T00:00:00Z',
    ...overrides,
  }
}

function makeDetail(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    ...makeSummary(),
    content: '# 제목\n\n**본문** 내용입니다.',
    sources: null,
    ...overrides,
  }
}

function makeGuideSummary(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'g1',
    title: '강남구 화장실 완전정복 가이드',
    slug: 'gangnam-toilet-guide',
    summary: '요약 텍스트입니다.',
    category: 'toilet',
    articleType: 'guide',
    thumbnailUrl: null,
    keywords: '화장실,공중화장실',
    published: false,
    status: 'draft',
    publishedAt: null,
    viewCount: 0,
    createdAt: '2026-07-01T00:00:00Z',
    updatedAt: '2026-07-01T00:00:00Z',
    ...overrides,
  }
}

function makeGuideDetail(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    ...makeGuideSummary(),
    content: '# 제목\n\n**본문** 내용입니다.',
    ...overrides,
  }
}

describe('admin dashboard (pages/admin/index.vue)', () => {
  let listMock: ReturnType<typeof vi.fn>
  let getMock: ReturnType<typeof vi.fn>
  let updateMock: ReturnType<typeof vi.fn>
  let publishMock: ReturnType<typeof vi.fn>
  let unpublishMock: ReturnType<typeof vi.fn>
  let rejectMock: ReturnType<typeof vi.fn>
  let removeMock: ReturnType<typeof vi.fn>
  let generateMock: ReturnType<typeof vi.fn>
  let regenerateMock: ReturnType<typeof vi.fn>
  let guideListMock: ReturnType<typeof vi.fn>
  let guideGetMock: ReturnType<typeof vi.fn>
  let guideUpdateMock: ReturnType<typeof vi.fn>
  let guidePublishMock: ReturnType<typeof vi.fn>
  let guideUnpublishMock: ReturnType<typeof vi.fn>
  let guideRemoveMock: ReturnType<typeof vi.fn>
  let confirmSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    listMock = vi.fn().mockResolvedValue({ items: [makeSummary()], total: 1, page: 1, totalPages: 1 })
    getMock = vi.fn().mockResolvedValue(makeDetail())
    updateMock = vi.fn().mockResolvedValue(makeDetail({ title: '수정된 제목' }))
    publishMock = vi.fn().mockResolvedValue(makeDetail({ status: 'published' }))
    unpublishMock = vi.fn().mockResolvedValue(makeDetail({ status: 'draft' }))
    rejectMock = vi.fn().mockResolvedValue(makeDetail({ status: 'rejected' }))
    removeMock = vi.fn().mockResolvedValue({ deleted: true })
    generateMock = vi.fn().mockResolvedValue({ started: true, count: 1, category: null })
    regenerateMock = vi.fn().mockResolvedValue({ started: true, count: 1, category: 'toilet' })

    guideListMock = vi.fn().mockResolvedValue({ items: [makeGuideSummary()], total: 1, page: 1, totalPages: 1 })
    guideGetMock = vi.fn().mockResolvedValue(makeGuideDetail())
    guideUpdateMock = vi.fn().mockResolvedValue(makeGuideDetail({ title: '수정된 가이드 제목' }))
    guidePublishMock = vi.fn().mockResolvedValue(makeGuideDetail({ status: 'published', published: true }))
    guideUnpublishMock = vi.fn().mockResolvedValue(makeGuideDetail({ status: 'draft', published: false }))
    guideRemoveMock = vi.fn().mockResolvedValue({ deleted: true })

    vi.stubGlobal('definePageMeta', vi.fn())
    vi.stubGlobal('useAdminArticles', () => ({
      list: listMock,
      get: getMock,
      update: updateMock,
      publish: publishMock,
      unpublish: unpublishMock,
      reject: rejectMock,
      remove: removeMock,
      generate: generateMock,
      regenerate: regenerateMock,
    }))
    vi.stubGlobal('useAdminGuides', () => ({
      list: guideListMock,
      get: guideGetMock,
      update: guideUpdateMock,
      publish: guidePublishMock,
      unpublish: guideUnpublishMock,
      remove: guideRemoveMock,
    }))

    confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    confirmSpy.mockRestore()
  })

  async function mountAndSelect() {
    const wrapper = mount(AdminIndexPage)
    await flushPromises()
    await wrapper.find('[data-testid="admin-article-card"]').trigger('click')
    await flushPromises()
    return wrapper
  }

  async function mountAndSwitchToGuideTab() {
    const wrapper = mount(AdminIndexPage)
    await flushPromises()
    await wrapper.find('[data-testid="tab-guide"]').trigger('click')
    await flushPromises()
    return wrapper
  }

  it('마운트 시 list()를 호출하고 반환된 초안을 카드로 렌더한다 (제목·카테고리·상태)', async () => {
    const wrapper = mount(AdminIndexPage)
    await flushPromises()

    expect(listMock).toHaveBeenCalledTimes(1)
    expect(listMock).toHaveBeenCalledWith({ limit: 50 })

    const cards = wrapper.findAll('[data-testid="admin-article-card"]')
    expect(cards).toHaveLength(1)
    expect(wrapper.text()).toContain('오늘의 화장실 이슈')
    expect(wrapper.text()).toContain('toilet')
    expect(wrapper.text()).toContain('초안')
  })

  it('상태 필터 전환 시 list({status})를 재호출한다 (전체는 status 생략)', async () => {
    const wrapper = mount(AdminIndexPage)
    await flushPromises()

    await wrapper.find('[data-testid="filter-draft"]').trigger('click')
    await flushPromises()
    expect(listMock).toHaveBeenNthCalledWith(2, { status: 'draft', limit: 50 })

    await wrapper.find('[data-testid="filter-published"]').trigger('click')
    await flushPromises()
    expect(listMock).toHaveBeenNthCalledWith(3, { status: 'published', limit: 50 })

    await wrapper.find('[data-testid="filter-rejected"]').trigger('click')
    await flushPromises()
    expect(listMock).toHaveBeenNthCalledWith(4, { status: 'rejected', limit: 50 })

    await wrapper.find('[data-testid="filter-all"]').trigger('click')
    await flushPromises()
    expect(listMock).toHaveBeenNthCalledWith(5, { limit: 50 })
  })

  it('카드 선택 시 get(id)를 호출하고 편집 영역에 제목/요약/본문을 채우며 마크다운 미리보기를 렌더한다', async () => {
    const wrapper = await mountAndSelect()

    expect(getMock).toHaveBeenCalledWith('1')

    const titleInput = wrapper.find('[data-testid="editor-title"]')
    expect((titleInput.element as HTMLInputElement).value).toBe('오늘의 화장실 이슈')

    const summaryInput = wrapper.find('[data-testid="editor-summary"]')
    expect((summaryInput.element as HTMLTextAreaElement).value).toBe('요약 텍스트입니다.')

    const contentTextarea = wrapper.find('[data-testid="editor-content"]')
    expect((contentTextarea.element as HTMLTextAreaElement).value).toContain('본문')

    const preview = wrapper.find('[data-testid="editor-preview"]')
    expect(preview.html()).toContain('<strong>본문</strong>')
    expect(preview.html()).toContain('<h1>제목</h1>')
  })

  it('"저장" 클릭 시 update(id, patch)를 호출하고 목록을 새로고침한다 (확인 불필요)', async () => {
    const wrapper = await mountAndSelect()

    await wrapper.find('[data-testid="editor-title"]').setValue('바뀐 제목')
    await wrapper.find('[data-testid="save-button"]').trigger('click')
    await flushPromises()

    expect(confirmSpy).not.toHaveBeenCalled()
    expect(updateMock).toHaveBeenCalledWith('1', expect.objectContaining({ title: '바뀐 제목' }))
    expect(listMock).toHaveBeenCalledTimes(2)
  })

  it('"발행" 클릭 시 확인 후 publish(id)를 호출하고 목록을 새로고침한다', async () => {
    const wrapper = await mountAndSelect()

    await wrapper.find('[data-testid="publish-button"]').trigger('click')
    await flushPromises()

    expect(confirmSpy).toHaveBeenCalled()
    expect(publishMock).toHaveBeenCalledWith('1')
    expect(listMock).toHaveBeenCalledTimes(2)
  })

  it('확인 취소 시 발행이 실행되지 않는다', async () => {
    confirmSpy.mockReturnValue(false)
    const wrapper = await mountAndSelect()

    await wrapper.find('[data-testid="publish-button"]').trigger('click')
    await flushPromises()

    expect(confirmSpy).toHaveBeenCalled()
    expect(publishMock).not.toHaveBeenCalled()
  })

  it('"발행취소" 클릭 시 unpublish(id)를 호출하고 목록을 새로고침한다', async () => {
    const wrapper = await mountAndSelect()

    await wrapper.find('[data-testid="unpublish-button"]').trigger('click')
    await flushPromises()

    expect(unpublishMock).toHaveBeenCalledWith('1')
    expect(listMock).toHaveBeenCalledTimes(2)
  })

  it('"반려" 클릭 시 확인 후 reject(id)를 호출하고 목록을 새로고침한다', async () => {
    const wrapper = await mountAndSelect()

    await wrapper.find('[data-testid="reject-button"]').trigger('click')
    await flushPromises()

    expect(confirmSpy).toHaveBeenCalled()
    expect(rejectMock).toHaveBeenCalledWith('1')
    expect(listMock).toHaveBeenCalledTimes(2)
  })

  it('"삭제" 클릭 시 확인 후 remove(id)를 호출하고 목록을 새로고침한다', async () => {
    const wrapper = await mountAndSelect()

    await wrapper.find('[data-testid="delete-button"]').trigger('click')
    await flushPromises()

    expect(confirmSpy).toHaveBeenCalled()
    expect(removeMock).toHaveBeenCalledWith('1')
    expect(listMock).toHaveBeenCalledTimes(2)
  })

  it('확인 취소 시 삭제가 실행되지 않는다', async () => {
    confirmSpy.mockReturnValue(false)
    const wrapper = await mountAndSelect()

    await wrapper.find('[data-testid="delete-button"]').trigger('click')
    await flushPromises()

    expect(removeMock).not.toHaveBeenCalled()
  })

  it('"재생성" 클릭 시 확인 후 regenerate(id)를 호출하고 편집기를 닫고 안내 메시지를 표시하며 목록을 새로고침한다', async () => {
    const wrapper = await mountAndSelect()

    await wrapper.find('[data-testid="regenerate-button"]').trigger('click')
    await flushPromises()

    expect(confirmSpy).toHaveBeenCalled()
    expect(regenerateMock).toHaveBeenCalledWith('1')
    expect(listMock).toHaveBeenCalledTimes(2)
    expect(wrapper.find('[data-testid="editor-title"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('재생성이 시작되었습니다')
  })

  it('확인 취소 시 재생성이 실행되지 않는다', async () => {
    confirmSpy.mockReturnValue(false)
    const wrapper = await mountAndSelect()

    await wrapper.find('[data-testid="regenerate-button"]').trigger('click')
    await flushPromises()

    expect(confirmSpy).toHaveBeenCalled()
    expect(regenerateMock).not.toHaveBeenCalled()
  })

  it('"지금 생성" 클릭 시 generate()를 호출하고 안내 메시지를 표시하며 목록을 새로고침한다', async () => {
    const wrapper = mount(AdminIndexPage)
    await flushPromises()

    await wrapper.find('[data-testid="generate-button"]').trigger('click')
    await flushPromises()

    expect(generateMock).toHaveBeenCalled()
    expect(listMock).toHaveBeenCalledTimes(2)
    expect(wrapper.text()).toContain('생성이 시작되었습니다')
  })

  it('list() 실패 시 원본 에러 대신 일반 에러 메시지를 보여준다', async () => {
    listMock.mockReset().mockRejectedValueOnce(new Error('DB connection refused at 10.0.0.5'))
    const wrapper = mount(AdminIndexPage)
    await flushPromises()

    expect(wrapper.text()).not.toContain('DB connection refused')
    expect(wrapper.text().length).toBeGreaterThan(0)
  })

  describe('생활 가이드 탭', () => {
    it('기본 탭은 article이며 마운트 시 가이드 list()는 호출되지 않는다', async () => {
      const wrapper = mount(AdminIndexPage)
      await flushPromises()

      expect(wrapper.find('[data-testid="admin-article-card"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="admin-guide-card"]').exists()).toBe(false)
      expect(guideListMock).not.toHaveBeenCalled()
    })

    it('article 탭에서만 generate-button이 노출된다', async () => {
      const wrapper = mount(AdminIndexPage)
      await flushPromises()

      expect(wrapper.find('[data-testid="generate-button"]').exists()).toBe(true)

      await wrapper.find('[data-testid="tab-guide"]').trigger('click')
      await flushPromises()

      expect(wrapper.find('[data-testid="generate-button"]').exists()).toBe(false)
    })

    it('tab-guide 클릭 시 useAdminGuides().list()를 호출하고 admin-guide-card를 렌더한다 (첫 전환에만 lazy-load)', async () => {
      const wrapper = await mountAndSwitchToGuideTab()

      expect(guideListMock).toHaveBeenCalledTimes(1)
      expect(guideListMock).toHaveBeenCalledWith({ limit: 50 })
      expect(wrapper.findAll('[data-testid="admin-guide-card"]')).toHaveLength(1)
      expect(wrapper.text()).toContain('강남구 화장실 완전정복 가이드')

      // article 탭으로 갔다가 다시 guide 탭으로 돌아와도 재호출하지 않는다 (lazy-load)
      await wrapper.find('[data-testid="tab-article"]').trigger('click')
      await flushPromises()
      await wrapper.find('[data-testid="tab-guide"]').trigger('click')
      await flushPromises()

      expect(guideListMock).toHaveBeenCalledTimes(1)
    })

    it('가이드 상태 필터 전환 시 list({status})를 재호출한다 (전체는 status 생략)', async () => {
      const wrapper = await mountAndSwitchToGuideTab()

      await wrapper.find('[data-testid="guide-filter-draft"]').trigger('click')
      await flushPromises()
      expect(guideListMock).toHaveBeenNthCalledWith(2, { status: 'draft', limit: 50 })

      await wrapper.find('[data-testid="guide-filter-published"]').trigger('click')
      await flushPromises()
      expect(guideListMock).toHaveBeenNthCalledWith(3, { status: 'published', limit: 50 })

      await wrapper.find('[data-testid="guide-filter-all"]').trigger('click')
      await flushPromises()
      expect(guideListMock).toHaveBeenNthCalledWith(4, { limit: 50 })
    })

    it('가이드 선택 시 get(id)를 호출하고 편집 영역에 값을 채운다', async () => {
      const wrapper = await mountAndSwitchToGuideTab()

      await wrapper.find('[data-testid="admin-guide-card"]').trigger('click')
      await flushPromises()

      expect(guideGetMock).toHaveBeenCalledWith('g1')
      const titleInput = wrapper.find('[data-testid="editor-title"]')
      expect((titleInput.element as HTMLInputElement).value).toBe('강남구 화장실 완전정복 가이드')
    })

    it('가이드 선택 후 "발행" 클릭 시 확인 후 useAdminGuides().publish(id)를 호출하고 목록을 새로고침한다', async () => {
      const wrapper = await mountAndSwitchToGuideTab()

      await wrapper.find('[data-testid="admin-guide-card"]').trigger('click')
      await flushPromises()

      await wrapper.find('[data-testid="publish-button"]').trigger('click')
      await flushPromises()

      expect(confirmSpy).toHaveBeenCalled()
      expect(guidePublishMock).toHaveBeenCalledWith('g1')
      expect(guideListMock).toHaveBeenCalledTimes(2)
    })

    it('확인 취소 시 가이드 발행이 실행되지 않는다', async () => {
      confirmSpy.mockReturnValue(false)
      const wrapper = await mountAndSwitchToGuideTab()

      await wrapper.find('[data-testid="admin-guide-card"]').trigger('click')
      await flushPromises()

      await wrapper.find('[data-testid="publish-button"]').trigger('click')
      await flushPromises()

      expect(guidePublishMock).not.toHaveBeenCalled()
    })

    it('가이드 "저장" 클릭 시 update(id, patch)를 호출하고 목록을 새로고침한다 (확인 불필요)', async () => {
      const wrapper = await mountAndSwitchToGuideTab()

      await wrapper.find('[data-testid="admin-guide-card"]').trigger('click')
      await flushPromises()

      await wrapper.find('[data-testid="editor-title"]').setValue('바뀐 가이드 제목')
      await wrapper.find('[data-testid="save-button"]').trigger('click')
      await flushPromises()

      expect(confirmSpy).not.toHaveBeenCalled()
      expect(guideUpdateMock).toHaveBeenCalledWith('g1', expect.objectContaining({ title: '바뀐 가이드 제목' }))
      expect(guideListMock).toHaveBeenCalledTimes(2)
    })

    it('가이드 "발행취소" 클릭 시 unpublish(id)를 호출하고 목록을 새로고침한다', async () => {
      const wrapper = await mountAndSwitchToGuideTab()

      await wrapper.find('[data-testid="admin-guide-card"]').trigger('click')
      await flushPromises()

      await wrapper.find('[data-testid="unpublish-button"]').trigger('click')
      await flushPromises()

      expect(guideUnpublishMock).toHaveBeenCalledWith('g1')
      expect(guideListMock).toHaveBeenCalledTimes(2)
    })

    it('가이드 "삭제" 클릭 시 확인 후 remove(id)를 호출하고 선택을 해제하며 목록을 새로고침한다', async () => {
      const wrapper = await mountAndSwitchToGuideTab()

      await wrapper.find('[data-testid="admin-guide-card"]').trigger('click')
      await flushPromises()

      await wrapper.find('[data-testid="delete-button"]').trigger('click')
      await flushPromises()

      expect(confirmSpy).toHaveBeenCalled()
      expect(guideRemoveMock).toHaveBeenCalledWith('g1')
      expect(guideListMock).toHaveBeenCalledTimes(2)
      expect(wrapper.find('[data-testid="editor-title"]').exists()).toBe(false)
    })

    it('재생성/반려 버튼은 가이드 에디터에 존재하지 않는다', async () => {
      const wrapper = await mountAndSwitchToGuideTab()

      await wrapper.find('[data-testid="admin-guide-card"]').trigger('click')
      await flushPromises()

      expect(wrapper.find('[data-testid="regenerate-button"]').exists()).toBe(false)
      expect(wrapper.find('[data-testid="reject-button"]').exists()).toBe(false)
    })

    it('가이드 list() 실패 시 원본 에러 대신 일반 에러 메시지를 보여준다', async () => {
      guideListMock.mockReset().mockRejectedValueOnce(new Error('DB connection refused at 10.0.0.5'))
      const wrapper = mount(AdminIndexPage)
      await flushPromises()
      await wrapper.find('[data-testid="tab-guide"]').trigger('click')
      await flushPromises()

      expect(wrapper.text()).not.toContain('DB connection refused')
      expect(wrapper.find('[data-testid="error"]').exists()).toBe(true)
    })
  })
})
