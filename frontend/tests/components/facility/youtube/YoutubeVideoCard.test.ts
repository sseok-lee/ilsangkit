import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import YoutubeVideoCard from '~/components/facility/youtube/YoutubeVideoCard.vue'

const video = {
  videoId: 'abc',
  title: '종로주차장 후기',
  channelTitle: '드라이브TV',
  thumbnail: 'https://i.ytimg.com/vi/abc/mqdefault.jpg',
  publishedAt: '2026-05-01T00:00:00Z',
  duration: '',
}

describe('YoutubeVideoCard', () => {
  it('썸네일, 제목, 채널을 렌더한다', () => {
    const w = mount(YoutubeVideoCard, { props: { video } })
    expect(w.find('img').attributes('src')).toBe(video.thumbnail)
    expect(w.text()).toContain('종로주차장 후기')
    expect(w.text()).toContain('드라이브TV')
  })

  it('썸네일에 loading="lazy" 적용', () => {
    const w = mount(YoutubeVideoCard, { props: { video } })
    expect(w.find('img').attributes('loading')).toBe('lazy')
  })

  it('클릭하면 select 이벤트를 videoId 페이로드로 emit', async () => {
    const w = mount(YoutubeVideoCard, { props: { video } })
    await w.trigger('click')
    expect(w.emitted('select')?.[0]).toEqual(['abc'])
  })
})
