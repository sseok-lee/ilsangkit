import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import AdminGuideCard from '~/components/admin/AdminGuideCard.vue'
import type { AdminGuideSummary } from '~/composables/useAdminGuides'

function makeSummary(overrides: Partial<AdminGuideSummary> = {}): AdminGuideSummary {
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
    ...overrides,
  }
}

describe('AdminGuideCard', () => {
  it('draft 가이드는 "초안" 배지를 렌더한다', () => {
    const wrapper = mount(AdminGuideCard, { props: { guide: makeSummary() } })

    expect(wrapper.find('[data-testid="admin-guide-card"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('초안')
    expect(wrapper.text()).toContain('강남구 화장실 완전정복 가이드')
    expect(wrapper.text()).toContain('toilet')
  })

  it('published 가이드는 "발행됨" 배지를 렌더한다', () => {
    const wrapper = mount(AdminGuideCard, {
      props: { guide: makeSummary({ status: 'published', published: true }) },
    })

    expect(wrapper.text()).toContain('발행됨')
    expect(wrapper.text()).not.toContain('초안')
  })

  it('클릭 시 select 이벤트를 guide.id와 함께 emit한다', async () => {
    const wrapper = mount(AdminGuideCard, { props: { guide: makeSummary({ id: 'abc-123' }) } })

    await wrapper.find('[data-testid="admin-guide-card"]').trigger('click')

    expect(wrapper.emitted('select')).toBeTruthy()
    expect(wrapper.emitted('select')?.[0]).toEqual(['abc-123'])
  })

  it('thumbnailUrl이 있으면 img src로 그대로 사용한다 (apiBase 접두 없음)', () => {
    const wrapper = mount(AdminGuideCard, {
      props: { guide: makeSummary({ thumbnailUrl: '/api/images/guides/foo.webp' }) },
    })

    const img = wrapper.find('img')
    expect(img.exists()).toBe(true)
    expect(img.attributes('src')).toBe('/api/images/guides/foo.webp')
  })

  it('thumbnailUrl이 없으면 img를 렌더하지 않는다', () => {
    const wrapper = mount(AdminGuideCard, { props: { guide: makeSummary({ thumbnailUrl: null }) } })

    expect(wrapper.find('img').exists()).toBe(false)
  })
})
