import { describe, it, expect, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import YoutubeEmbedModal from '~/components/facility/youtube/YoutubeEmbedModal.vue'

afterEach(() => {
  document.body.innerHTML = ''
})

describe('YoutubeEmbedModal', () => {
  it('open=false면 iframe이 mount되지 않는다', () => {
    mount(YoutubeEmbedModal, { props: { open: false, videoId: 'abc' }, attachTo: document.body })
    expect(document.body.querySelector('iframe')).toBeNull()
  })

  it('open=true면 youtube-nocookie iframe이 mount되고 videoId 포함', () => {
    mount(YoutubeEmbedModal, { props: { open: true, videoId: 'abc' }, attachTo: document.body })
    const iframe = document.body.querySelector('iframe')
    expect(iframe).not.toBeNull()
    expect(iframe!.getAttribute('src')).toContain('youtube-nocookie.com/embed/abc')
  })

  it('배경 클릭 시 close emit', async () => {
    const w = mount(YoutubeEmbedModal, { props: { open: true, videoId: 'abc' }, attachTo: document.body })
    const backdrop = document.body.querySelector<HTMLElement>('[data-testid="yt-modal-backdrop"]')
    expect(backdrop).not.toBeNull()
    backdrop!.click()
    await w.vm.$nextTick()
    expect(w.emitted('close')).toBeTruthy()
  })

  it('닫기 버튼 클릭 시 close emit', async () => {
    const w = mount(YoutubeEmbedModal, { props: { open: true, videoId: 'abc' }, attachTo: document.body })
    const closeBtn = document.body.querySelector<HTMLElement>('[data-testid="yt-modal-close"]')
    expect(closeBtn).not.toBeNull()
    closeBtn!.click()
    await w.vm.$nextTick()
    expect(w.emitted('close')).toBeTruthy()
  })
})
