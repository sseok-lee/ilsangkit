import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import SourceStamp from '~/components/common/SourceStamp.vue'

describe('SourceStamp', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-10T09:00:00+09:00'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('provider를 항상 렌더한다', () => {
    const w = mount(SourceStamp, { props: { provider: '국토교통부' } })
    expect(w.text()).toContain('국토교통부')
  })

  it('신선한 syncedAt이면 "YYYY.MM.DD 동기화"와 상태점을 렌더한다', () => {
    const w = mount(SourceStamp, {
      props: { provider: '국토교통부', syncedAt: '2026-07-10T00:00:00.000Z', staleDays: 2 },
    })
    expect(w.text()).toContain('2026.07.10 동기화')
    expect(w.find('.bg-success').exists()).toBe(true)
  })

  it('stale이면 날짜·상태점을 숨기고 provider는 유지한다', () => {
    const w = mount(SourceStamp, {
      props: { provider: '행정안전부', syncedAt: '2025-01-01T00:00:00.000Z', staleDays: 62 },
    })
    expect(w.text()).not.toContain('동기화')
    expect(w.find('.bg-success').exists()).toBe(false)
    expect(w.text()).toContain('행정안전부')
  })

  it('basis를 접두어 없이 그대로 렌더한다', () => {
    const w = mount(SourceStamp, { props: { provider: '국토교통부', basis: '전체 기간 누적' } })
    expect(w.text()).toContain('전체 기간 누적')
  })

  it('sourceUrl이 있으면 새 탭 링크를 렌더한다', () => {
    const w = mount(SourceStamp, {
      props: { provider: '국토교통부', sourceUrl: 'https://rt.molit.go.kr', linkLabel: '원본 보기' },
    })
    const a = w.find('a')
    expect(a.attributes('href')).toBe('https://rt.molit.go.kr')
    expect(a.attributes('target')).toBe('_blank')
    expect(a.attributes('rel')).toContain('noopener')
    expect(a.text()).toContain('원본 보기')
  })

  it('plain variant는 캡슐 클래스를 갖지 않는다', () => {
    const w = mount(SourceStamp, { props: { provider: 'x', variant: 'plain' } })
    expect(w.attributes('class')).not.toContain('md:border')
  })
})
