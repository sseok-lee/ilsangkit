import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import BlogReviewCard from '~/components/blog/BlogReviewCard.vue'

const post = {
  url: 'https://blog.naver.com/x/1',
  title: '종로주차장 후기',
  description: '여기는 종로 한가운데에 있어서 가기 편하고 요금도 합리적이었어요. 추천합니다',
  bloggerName: '여행객A',
  bloggerLink: 'https://blog.naver.com/x',
  postDate: '20260301',
}

describe('BlogReviewCard', () => {
  it('제목/스니펫/블로거/날짜 렌더', () => {
    const w = mount(BlogReviewCard, { props: { post } })
    expect(w.text()).toContain('종로주차장 후기')
    expect(w.text()).toContain('가기 편하고')
    expect(w.text()).toContain('여행객A')
    expect(w.text()).toContain('2026.03.01')
  })

  it('a 태그 target/rel 속성', () => {
    const w = mount(BlogReviewCard, { props: { post } })
    const a = w.find('a')
    expect(a.attributes('target')).toBe('_blank')
    expect(a.attributes('rel')).toContain('nofollow')
    expect(a.attributes('rel')).toContain('noopener')
    expect(a.attributes('rel')).toContain('noreferrer')
    expect(a.attributes('href')).toBe(post.url)
  })

  it('description 80자 초과 시 80자 + 말줄임으로 표시', () => {
    const longPost = { ...post, description: 'a'.repeat(200) }
    const w = mount(BlogReviewCard, { props: { post: longPost } })
    expect(w.text()).toContain('a'.repeat(80))
    expect(w.text()).toContain('…')
    expect(w.text()).not.toContain('a'.repeat(81))
  })
})
