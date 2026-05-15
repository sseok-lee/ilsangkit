import { http, HttpResponse } from 'msw'

function mkPosts(prefix: string) {
  return [
    { url: `https://blog.naver.com/${prefix}/1`, title: `${prefix} 후기 1`, description: '여기 진짜 깔끔하고 좋아요. 추천합니다. 다시 또 갈 의향 있습니다', bloggerName: '모킹A', bloggerLink: `https://blog.naver.com/${prefix}`, postDate: '20260301' },
    { url: `https://blog.naver.com/${prefix}/2`, title: `${prefix} 다녀온 후기`, description: '한 30분 정도 머물렀는데 잘 정비되어 있어서 만족스러웠어요', bloggerName: '모킹B', bloggerLink: `https://blog.naver.com/${prefix}`, postDate: '20260215' },
    { url: `https://blog.naver.com/${prefix}/3`, title: `이용해본 ${prefix}`, description: '직원이 친절했고 시설도 깨끗했습니다. 다음에 또 방문 예정이에요', bloggerName: '모킹C', bloggerLink: `https://blog.naver.com/${prefix}`, postDate: '20260120' },
  ]
}

export const naverBlogHandlers = [
  http.get('*/api/facilities/:category/:id/naver-blog', ({ params }) =>
    HttpResponse.json({ success: true, data: { posts: mkPosts(`facility-${String(params.id)}`) } }),
  ),
  http.get('*/api/real-estate/:type/:city/:district/:buildingName/naver-blog', ({ params }) =>
    HttpResponse.json({ success: true, data: { posts: mkPosts(`real-estate-${String(params.buildingName)}`) } }),
  ),
]
