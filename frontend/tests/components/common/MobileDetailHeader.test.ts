import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MobileDetailHeader from '~/components/common/MobileDetailHeader.vue'

const base = { title: '테스트 대상' }

describe('common/MobileDetailHeader', () => {
  it('title을 literal h1로 렌더한다 (단일 h1 불변식)', () => {
    const w = mount(MobileDetailHeader, { props: base })
    const h1s = w.findAll('h1')
    expect(h1s.length).toBe(1)
    expect(h1s[0].text()).toBe('테스트 대상')
  })

  // 긴 공백 없는 이름(예: '㈜NHF제2호공공임대위탁관리부동산투자회사')이 카드 밖으로 넘치지 않도록
  // h1은 줄바꿈 회복 유틸을 가져야 한다(break-keep로 keep-all이라 긴 토큰엔 overflow-wrap:anywhere 필수).
  it('h1은 긴 토큰 줄바꿈 회복 클래스를 가진다 (오버플로 회귀 가드)', () => {
    const w = mount(MobileDetailHeader, { props: { title: '㈜NHF제2호공공임대위탁관리부동산투자회사(리벤티움)' } })
    const cls = w.find('h1').classes()
    expect(cls).toContain('min-w-0')
    expect(cls).toContain('[overflow-wrap:anywhere]')
  })

  it('eyebrow가 있으면 배지를, 없으면 숨긴다', () => {
    const w = mount(MobileDetailHeader, { props: { ...base, eyebrow: '아파트 · 매매' } })
    expect(w.text()).toContain('아파트 · 매매')
    const w2 = mount(MobileDetailHeader, { props: base })
    expect(w2.find('[data-test="eyebrow"]').exists()).toBe(false)
  })

  it('phone이 있으면 tel: 전화 pill을, 없으면 숨긴다', () => {
    const w = mount(MobileDetailHeader, { props: { ...base, phone: '02-123-4567' } })
    const call = w.find('[data-test="call-pill"]')
    expect(call.exists()).toBe(true)
    expect(call.attributes('href')).toBe('tel:02-123-4567')
    expect(mount(MobileDetailHeader, { props: base }).find('[data-test="call-pill"]').exists()).toBe(false)
  })

  it('copyable=true일 때만 복사 pill을 노출하고 클릭 시 copy를 emit한다', async () => {
    const w = mount(MobileDetailHeader, { props: { ...base, copyable: true } })
    const copy = w.find('[data-test="copy-pill"]')
    expect(copy.exists()).toBe(true)
    await copy.trigger('click')
    expect(w.emitted('copy')).toHaveLength(1)
    expect(mount(MobileDetailHeader, { props: base }).find('[data-test="copy-pill"]').exists()).toBe(false)
  })

  it('공유 pill 클릭 시 share를 emit한다', async () => {
    const w = mount(MobileDetailHeader, { props: base })
    await w.find('[data-test="share-pill"]').trigger('click')
    expect(w.emitted('share')).toHaveLength(1)
  })

  it('hideDirections=false(기본)면 길찾기 pill을 노출, true면 숨긴다', () => {
    expect(mount(MobileDetailHeader, { props: base }).find('[data-test="directions-pill"]').exists()).toBe(true)
    const hidden = mount(MobileDetailHeader, { props: { ...base, hideDirections: true } })
    expect(hidden.find('[data-test="directions-pill"]').exists()).toBe(false)
  })

  it('길찾기 메뉴에서 제공자 선택 시 directions를 provider와 함께 emit한다', async () => {
    const w = mount(MobileDetailHeader, { props: base })
    await w.find('[data-test="directions-pill"]').trigger('click')
    await w.find('[data-test="directions-kakao"]').trigger('click')
    expect(w.emitted('directions')?.[0]).toEqual(['kakao'])
  })

  it('네이버 선택 시 naver를 emit하고 선택 후 메뉴를 닫는다', async () => {
    const w = mount(MobileDetailHeader, { props: base })
    await w.find('[data-test="directions-pill"]').trigger('click')
    await w.find('[data-test="directions-naver"]').trigger('click')
    expect(w.emitted('directions')?.[0]).toEqual(['naver'])
    expect(w.find('[data-test="directions-kakao"]').exists()).toBe(false)
  })

  it('shareLabel을 공유 pill의 aria-label로 적용한다', () => {
    const w = mount(MobileDetailHeader, { props: { ...base, shareLabel: '이 시설 공유하기' } })
    expect(w.find('[data-test="share-pill"]').attributes('aria-label')).toBe('이 시설 공유하기')
  })

  it('stats를 칩으로 렌더하고 color 클래스를 적용한다', () => {
    const w = mount(MobileDetailHeader, { props: { ...base, stats: [{ label: '최근거래', value: '9.8억', color: 'text-primary' }] } })
    expect(w.text()).toContain('최근거래')
    expect(w.text()).toContain('9.8억')
    expect(w.find('.text-primary').exists()).toBe(true)
  })

  it('최소 props(title만)로도 크래시 없이 렌더한다', () => {
    expect(() => mount(MobileDetailHeader, { props: base })).not.toThrow()
  })
})
