import { http, HttpResponse } from 'msw'

const fixture = (id: string) => ({
  success: true,
  data: {
    videos: [
      { videoId: `mock-${id}-1`, title: `시설 ${id} 관련 영상 1`, channelTitle: '모킹 채널', thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg', publishedAt: '2026-05-01T00:00:00Z', duration: '' },
      { videoId: `mock-${id}-2`, title: `시설 ${id} 관련 영상 2`, channelTitle: '모킹 채널', thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg', publishedAt: '2026-05-01T00:00:00Z', duration: '' },
      { videoId: `mock-${id}-3`, title: `시설 ${id} 관련 영상 3`, channelTitle: '모킹 채널', thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg', publishedAt: '2026-05-01T00:00:00Z', duration: '' },
    ],
  },
})

export const facilityYoutubeHandlers = [
  http.get('*/api/facilities/:category/:id/youtube', ({ params }) => HttpResponse.json(fixture(String(params.id)))),
]
