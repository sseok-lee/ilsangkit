import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useBlogReviews } from '~/composables/useBlogReviews'

const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('$fetch', fetchMock)
})

describe('useBlogReviews', () => {
  it('초기 상태', () => {
    const { posts, loading } = useBlogReviews()
    expect(posts.value).toEqual([])
    expect(loading.value).toBe(false)
  })

  it('kind=facility URL', async () => {
    fetchMock.mockResolvedValueOnce({ success: true, data: { posts: [{ url: 'u', title: 't', description: 'd', bloggerName: 'b', bloggerLink: 'bl', postDate: '20260101' }] } })
    const { posts, fetchPosts } = useBlogReviews()
    await fetchPosts('facility', 'parking', '123')
    expect(posts.value).toHaveLength(1)
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:8000/api/facilities/parking/123/naver-blog')
  })

  it('kind=real-estate URL (segments are encoded)', async () => {
    fetchMock.mockResolvedValueOnce({ success: true, data: { posts: [] } })
    const { fetchPosts } = useBlogReviews()
    await fetchPosts('real-estate', 'apt-sale', '서울특별시|종로구|롯데캐슬 골드')
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/^http:\/\/localhost:8000\/api\/real-estate\/apt-sale\/.+\/.+\/.+\/naver-blog$/),
    )
  })

  it('에러 시 빈 배열, throw 안 함', async () => {
    fetchMock.mockRejectedValueOnce(new Error('boom'))
    const { posts, fetchPosts } = useBlogReviews()
    await fetchPosts('facility', 'parking', '123')
    expect(posts.value).toEqual([])
  })

  it('동일 인자 dedup', async () => {
    fetchMock.mockResolvedValue({ success: true, data: { posts: [] } })
    const { fetchPosts } = useBlogReviews()
    await Promise.all([fetchPosts('facility', 'parking', '123'), fetchPosts('facility', 'parking', '123')])
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
