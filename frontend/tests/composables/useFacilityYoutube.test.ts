import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useFacilityYoutube } from '~/composables/useFacilityYoutube'

const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('$fetch', fetchMock)
})

describe('useFacilityYoutube', () => {
  it('초기 상태: videos 빈 배열, loading false', () => {
    const { videos, loading } = useFacilityYoutube()
    expect(videos.value).toEqual([])
    expect(loading.value).toBe(false)
  });

  it('fetchVideos 호출 시 API 응답 데이터로 videos 채워짐', async () => {
    fetchMock.mockResolvedValueOnce({
      success: true,
      data: { videos: [{ videoId: 'a', title: 't', channelTitle: 'c', thumbnail: '', publishedAt: '', duration: '' }] },
    })
    const { videos, fetchVideos } = useFacilityYoutube()
    await fetchVideos('parking', '123')
    expect(videos.value).toHaveLength(1)
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:8000/api/facilities/parking/123/youtube')
  });

  it('네트워크 에러 시 빈 배열 유지, 에러 throw 안 함', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network'))
    const { videos, fetchVideos } = useFacilityYoutube()
    await fetchVideos('parking', '123')
    expect(videos.value).toEqual([])
  });

  it('동일 인자로 두 번 호출해도 한 번만 fetch (dedup)', async () => {
    fetchMock.mockResolvedValue({ success: true, data: { videos: [] } })
    const { fetchVideos } = useFacilityYoutube()
    await Promise.all([fetchVideos('parking', '123'), fetchVideos('parking', '123')])
    expect(fetchMock).toHaveBeenCalledTimes(1)
  });
})
