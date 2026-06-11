// frontend/tests/components/realEstate/MobileRealEstateHeader.test.ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MobileRealEstateHeader from '~/components/realEstate/MobileRealEstateHeader.vue'

const baseProps = {
  title: '래미안 대치팰리스',
  eyebrow: '아파트 매매',
  stats: [
    { label: '최근 거래가', value: '28.5억' },
    { label: '건축년도', value: '2015년' },
  ],
  kakaoMapUrl: 'https://map.kakao.com/x',
  naverMapUrl: 'https://map.naver.com/x',
}

describe('MobileRealEstateHeader', () => {
  it('제목과 eyebrow를 렌더한다', () => {
    const w = mount(MobileRealEstateHeader, { props: baseProps })
    expect(w.find('h1').text()).toBe('래미안 대치팰리스')
    expect(w.text()).toContain('아파트 매매')
  })

  it('stats를 칩으로 렌더한다', () => {
    const w = mount(MobileRealEstateHeader, { props: baseProps })
    expect(w.text()).toContain('28.5억')
  })

  it('전화/복사 pill이 없다', () => {
    const w = mount(MobileRealEstateHeader, { props: baseProps })
    expect(w.find('a[href^="tel:"]').exists()).toBe(false)
    expect(w.find('[data-test="copy-pill"]').exists()).toBe(false)
  })

  it('공유 pill 클릭 시 share를 emit한다', async () => {
    const w = mount(MobileRealEstateHeader, { props: baseProps })
    await w.get('[data-test="share-pill"]').trigger('click')
    expect(w.emitted('share')).toHaveLength(1)
  })

  it('길찾기 → 네이버 클릭 시 directions("naver")를 emit한다', async () => {
    const w = mount(MobileRealEstateHeader, { props: baseProps })
    await w.get('[data-test="directions-pill"]').trigger('click')
    await w.get('[data-test="directions-naver"]').trigger('click')
    expect(w.emitted('directions')?.[0]).toEqual(['naver'])
  })

  it('최소 props(title만)로도 크래시 없이 렌더한다', () => {
    const w = mount(MobileRealEstateHeader, { props: { title: '이름만' } })
    expect(w.find('h1').text()).toBe('이름만')
  })
})
