import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import AdminGuideEditor from '~/components/admin/AdminGuideEditor.vue'
import type { AdminGuideDetail } from '~/composables/useAdminGuides'

function makeDetail(overrides: Partial<AdminGuideDetail> = {}): AdminGuideDetail {
  return {
    id: '1',
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
    content: '# 제목\n\n**본문** 내용입니다.',
    ...overrides,
  }
}

describe('AdminGuideEditor', () => {
  it('guide prop으로 필드를 채운다', () => {
    const wrapper = mount(AdminGuideEditor, { props: { guide: makeDetail() } })

    expect((wrapper.find('[data-testid="editor-title"]').element as HTMLInputElement).value).toBe(
      '강남구 화장실 완전정복 가이드'
    )
    expect((wrapper.find('[data-testid="editor-summary"]').element as HTMLTextAreaElement).value).toBe(
      '요약 텍스트입니다.'
    )
    expect((wrapper.find('[data-testid="editor-keywords"]').element as HTMLInputElement).value).toBe(
      '화장실,공중화장실'
    )
    expect((wrapper.find('[data-testid="editor-content"]').element as HTMLTextAreaElement).value).toContain('본문')
  })

  it('마크다운 미리보기를 렌더한다', () => {
    const wrapper = mount(AdminGuideEditor, { props: { guide: makeDetail() } })

    const preview = wrapper.find('[data-testid="editor-preview"]')
    expect(preview.exists()).toBe(true)
    expect(preview.html()).toContain('<strong>본문</strong>')
    expect(preview.html()).toContain('<h1>제목</h1>')
  })

  it('상태 배지는 draft/published 2종만 표시한다', () => {
    const draftWrapper = mount(AdminGuideEditor, { props: { guide: makeDetail({ status: 'draft' }) } })
    expect(draftWrapper.text()).toContain('초안')

    const publishedWrapper = mount(AdminGuideEditor, {
      props: { guide: makeDetail({ status: 'published', published: true }) },
    })
    expect(publishedWrapper.text()).toContain('발행됨')
  })

  it('필드를 수정하고 저장 클릭 시 save가 전체 patch(제목/요약/키워드/본문)와 함께 emit된다', async () => {
    const wrapper = mount(AdminGuideEditor, { props: { guide: makeDetail() } })

    await wrapper.find('[data-testid="editor-title"]').setValue('바뀐 제목')
    await wrapper.find('[data-testid="editor-summary"]').setValue('바뀐 요약')
    await wrapper.find('[data-testid="editor-keywords"]').setValue('키워드1,키워드2')
    await wrapper.find('[data-testid="editor-content"]').setValue('## 바뀐 본문')

    await wrapper.find('[data-testid="save-button"]').trigger('click')

    const emitted = wrapper.emitted('save')
    expect(emitted).toBeTruthy()
    expect(emitted?.[0]?.[0]).toEqual({
      title: '바뀐 제목',
      summary: '바뀐 요약',
      keywords: '키워드1,키워드2',
      content: '## 바뀐 본문',
    })
  })

  it('키워드를 비우면 patch.keywords는 null이 된다', async () => {
    const wrapper = mount(AdminGuideEditor, { props: { guide: makeDetail() } })

    await wrapper.find('[data-testid="editor-keywords"]').setValue('   ')
    await wrapper.find('[data-testid="save-button"]').trigger('click')

    const emitted = wrapper.emitted('save')
    expect(emitted?.[0]?.[0]).toEqual(expect.objectContaining({ keywords: null }))
  })

  it('발행 버튼 클릭 시 publish를 emit한다', async () => {
    const wrapper = mount(AdminGuideEditor, { props: { guide: makeDetail() } })

    await wrapper.find('[data-testid="publish-button"]').trigger('click')

    expect(wrapper.emitted('publish')).toBeTruthy()
  })

  it('발행취소 버튼 클릭 시 unpublish를 emit한다', async () => {
    const wrapper = mount(AdminGuideEditor, { props: { guide: makeDetail() } })

    await wrapper.find('[data-testid="unpublish-button"]').trigger('click')

    expect(wrapper.emitted('unpublish')).toBeTruthy()
  })

  it('삭제 버튼 클릭 시 delete를 emit한다', async () => {
    const wrapper = mount(AdminGuideEditor, { props: { guide: makeDetail() } })

    await wrapper.find('[data-testid="delete-button"]').trigger('click')

    expect(wrapper.emitted('delete')).toBeTruthy()
  })

  it('재생성/반려 버튼은 존재하지 않는다 (가이드는 재생성/반려 없음)', () => {
    const wrapper = mount(AdminGuideEditor, { props: { guide: makeDetail() } })

    expect(wrapper.find('[data-testid="regenerate-button"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="reject-button"]').exists()).toBe(false)
  })

  it('guide prop이 바뀌면 초안 필드가 새 값으로 리셋된다', async () => {
    const wrapper = mount(AdminGuideEditor, { props: { guide: makeDetail() } })

    await wrapper.find('[data-testid="editor-title"]').setValue('임시로 바꾼 제목')

    await wrapper.setProps({ guide: makeDetail({ id: '2', title: '다른 가이드 제목', content: '다른 본문' }) })

    expect((wrapper.find('[data-testid="editor-title"]').element as HTMLInputElement).value).toBe('다른 가이드 제목')
    expect((wrapper.find('[data-testid="editor-content"]').element as HTMLTextAreaElement).value).toBe('다른 본문')
  })
})
