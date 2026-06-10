// frontend/tests/components/facility/detail/MobileDetailHeader.test.ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MobileDetailHeader from '~/components/facility/detail/MobileDetailHeader.vue'

const baseProps = {
  title: '행복약국',
  categoryLabel: '약국',
  status: 'openNow' as const,
  stats: [
    { label: '운영시간', value: '09:00~21:00' },
    { label: '전화', value: '02-123-4567' },
  ],
  phone: '02-123-4567',
  kakaoMapUrl: 'https://map.kakao.com/x',
  naverMapUrl: 'https://map.naver.com/x',
}

describe('MobileDetailHeader', () => {
  it('제목과 카테고리 eyebrow를 렌더한다', () => {
    const w = mount(MobileDetailHeader, { props: baseProps })
    expect(w.find('h1').text()).toBe('행복약국')
    expect(w.text()).toContain('약국')
  })

  it('영업상태 배지를 렌더한다(openNow → 개방중)', () => {
    const w = mount(MobileDetailHeader, { props: baseProps })
    expect(w.text()).toContain('개방중')
  })

  it('stats를 칩으로 렌더한다', () => {
    const w = mount(MobileDetailHeader, { props: baseProps })
    expect(w.text()).toContain('09:00~21:00')
  })

  it('전화 pill은 tel: 링크다', () => {
    const w = mount(MobileDetailHeader, { props: baseProps })
    const tel = w.find('a[href="tel:02-123-4567"]')
    expect(tel.exists()).toBe(true)
  })

  it('phone이 없으면 전화 pill을 숨긴다', () => {
    const w = mount(MobileDetailHeader, { props: { ...baseProps, phone: null } })
    expect(w.find('a[href^="tel:"]').exists()).toBe(false)
  })

  it('공유 pill 클릭 시 share 이벤트를 emit한다', async () => {
    const w = mount(MobileDetailHeader, { props: baseProps })
    await w.get('[data-test="share-pill"]').trigger('click')
    expect(w.emitted('share')).toHaveLength(1)
  })

  it('주소복사 pill 클릭 시 copy 이벤트를 emit한다', async () => {
    const w = mount(MobileDetailHeader, { props: baseProps })
    await w.get('[data-test="copy-pill"]').trigger('click')
    expect(w.emitted('copy')).toHaveLength(1)
  })

  it('길찾기 → 카카오 클릭 시 directions("kakao")를 emit한다', async () => {
    const w = mount(MobileDetailHeader, { props: baseProps })
    await w.get('[data-test="directions-pill"]').trigger('click')
    await w.get('[data-test="directions-kakao"]').trigger('click')
    expect(w.emitted('directions')?.[0]).toEqual(['kakao'])
  })

  it('최소 props(title만)로도 크래시 없이 렌더한다', () => {
    const w = mount(MobileDetailHeader, { props: { title: '이름만' } })
    expect(w.find('h1').text()).toBe('이름만')
    expect(w.find('a[href^="tel:"]').exists()).toBe(false)
  })
})
