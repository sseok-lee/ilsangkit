import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import AdminArticleCard from '~/components/admin/AdminArticleCard.vue'
import type { AdminArticleSummary } from '~/composables/useAdminArticles'

function makeSummary(overrides: Partial<AdminArticleSummary> = {}): AdminArticleSummary {
  return {
    id: 'a1',
    slug: 'subscription-x',
    title: '청약 개편',
    summary: '요약 텍스트입니다.',
    category: 'subscription',
    status: 'draft',
    articleType: 'news-brief',
    thumbnailUrl: null,
    keywords: null,
    publishedAt: null,
    viewCount: 0,
    createdAt: '2026-07-07T00:00:00.000Z',
    updatedAt: '2026-07-07T00:00:00.000Z',
    ...overrides,
  }
}

describe('AdminArticleCard — 정책 뱃지', () => {
  it('policy-brief면 "정책" 뱃지 노출', () => {
    const wrapper = mount(AdminArticleCard, {
      props: { article: makeSummary({ articleType: 'policy-brief' }) },
    })
    expect(wrapper.text()).toContain('정책')
  })

  it('news-brief면 "정책" 뱃지 없음', () => {
    const wrapper = mount(AdminArticleCard, {
      props: { article: makeSummary({ articleType: 'news-brief' }) },
    })
    expect(wrapper.text()).not.toContain('정책')
  })
})
