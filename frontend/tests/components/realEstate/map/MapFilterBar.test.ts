import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MapFilterBar from '~/components/realEstate/map/MapFilterBar.vue'

function mountBar(type = 'apt-sale') {
  return mount(MapFilterBar, { props: { type } })
}

/** 매물 유형 메뉴(0) / 거래 유형 메뉴(1) 의 링크들. */
function menuLinks(w: ReturnType<typeof mountBar>, idx: 0 | 1) {
  return w.findAll('ul')[idx].findAll('a')
}

/**
 * v-show 는 열렸을 때 style 속성을 아예 남기지 않는다(undefined). 문자열 포함 여부로만
 * 단언하면 열림/닫힘이 아니라 "속성 유무"에 걸려 넘어진다 — boolean 으로 정규화한다.
 */
function isHidden(w: ReturnType<typeof mountBar>, idx: 0 | 1): boolean {
  return w.findAll('ul')[idx].attributes('style')?.includes('display: none') ?? false
}

describe('MapFilterBar', () => {
  it('두 개의 셀렉트로 렌더한다 — 매물 유형과 거래 유형', () => {
    const w = mountBar()
    const triggers = w.findAll('button')
    expect(triggers).toHaveLength(2)
    expect(triggers[0].text()).toContain('아파트')
    expect(triggers[1].text()).toContain('매매')
  })

  it('현재 타입을 두 축으로 분해해 트리거 라벨에 쓴다', () => {
    const triggers = mountBar('offitel-rent').findAll('button')
    expect(triggers[0].text()).toContain('오피스텔')
    expect(triggers[1].text()).toContain('전월세')
  })

  // 이 컴포넌트가 만드는 링크는 "현재 상태와 조합된" URL 이다. 6종 전부를 이 한 곳에서
  // 링크하지 못하므로(기본값 apt-sale 이면 villa-rent·offitel-rent 는 어느 메뉴에도 없다)
  // 6개 허브의 정식 링크 소유자는 AppFooter 다. 그쪽 테스트가 전수를 지킨다.
  it('메뉴 항목은 button 이 아니라 href 있는 a 다 — SSR HTML 에 크롤 경로를 남긴다', () => {
    const w = mountBar()
    expect(menuLinks(w, 0).map((a) => a.attributes('href')))
      .toEqual(['/real-estate/apt-sale', '/real-estate/villa-sale', '/real-estate/offitel-sale'])
    expect(menuLinks(w, 1).map((a) => a.attributes('href')))
      .toEqual(['/real-estate/apt-sale', '/real-estate/apt-rent'])
  })

  it('현재 거래 유형을 유지한 채 매물 유형 링크를 만든다', () => {
    const w = mountBar('villa-rent')
    expect(menuLinks(w, 0).map((a) => a.attributes('href')))
      .toEqual(['/real-estate/apt-rent', '/real-estate/villa-rent', '/real-estate/offitel-rent'])
  })

  it('현재 매물 유형을 유지한 채 거래 유형 링크를 만든다', () => {
    const w = mountBar('offitel-rent')
    expect(menuLinks(w, 1).map((a) => a.attributes('href')))
      .toEqual(['/real-estate/offitel-sale', '/real-estate/offitel-rent'])
  })

  // v-if 로 바꾸면 닫힌 메뉴가 DOM 에서 사라져 크롤러가 링크를 못 본다.
  it('닫혀 있어도 링크가 DOM 에 있다 — v-show 여야 한다', () => {
    const w = mountBar()
    expect(w.findAll('ul')).toHaveLength(2)
    expect(w.findAll('a').length).toBe(5)
    expect(isHidden(w, 0)).toBe(true)
    expect(isHidden(w, 1)).toBe(true)
  })

  it('트리거를 누르면 그 메뉴만 열린다', async () => {
    const w = mountBar()
    await w.findAll('button')[0].trigger('click')
    expect(isHidden(w, 0)).toBe(false)
    expect(isHidden(w, 1)).toBe(true)
  })

  it('다른 트리거를 누르면 이전 메뉴가 닫힌다 — 지도 위에 두 메뉴가 겹치면 안 된다', async () => {
    const w = mountBar()
    await w.findAll('button')[0].trigger('click')
    await w.findAll('button')[1].trigger('click')
    expect(isHidden(w, 0)).toBe(true)
    expect(isHidden(w, 1)).toBe(false)
  })

  it('같은 트리거를 다시 누르면 닫힌다', async () => {
    const w = mountBar()
    await w.findAll('button')[0].trigger('click')
    await w.findAll('button')[0].trigger('click')
    expect(isHidden(w, 0)).toBe(true)
  })

  it('평범한 클릭은 기본 동작을 막고 타입 전환만 emit 한다', async () => {
    const w = mountBar()
    await menuLinks(w, 0)[1].trigger('click')
    expect(w.emitted('update:type')).toEqual([['villa-sale']])
  })

  it('선택하면 메뉴가 닫힌다', async () => {
    const w = mountBar()
    await w.findAll('button')[0].trigger('click')
    await menuLinks(w, 0)[1].trigger('click')
    expect(isHidden(w, 0)).toBe(true)
  })

  it('⌘/Ctrl+클릭은 가로채지 않는다 — 새 탭으로 열려야 한다', async () => {
    const w = mountBar()
    await menuLinks(w, 0)[1].trigger('click', { metaKey: true })
    await menuLinks(w, 0)[1].trigger('click', { ctrlKey: true })
    expect(w.emitted('update:type')).toBeUndefined()
  })

  it('⌘클릭의 기본 동작(새 탭 열기)이 실제로 막히지 않는다 — @click.exact.prevent 순서 가드', () => {
    // emit 유무만 보면 .exact 와 .prevent 순서가 바뀌어도(.prevent.exact) 둘 다 emit 은
    // 안 하므로 위 테스트가 계속 통과한다. defaultPrevented 를 직접 확인해 순서를 가드한다.
    const w = mountBar()
    const el = menuLinks(w, 0)[1].element
    const event = new MouseEvent('click', { metaKey: true, cancelable: true, bubbles: true })
    el.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(false)
    expect(w.emitted('update:type')).toBeUndefined()
  })

  it('각 메뉴에서 현재 값만 aria-current 를 갖는다', () => {
    const w = mountBar('villa-rent')
    const propertyCurrent = menuLinks(w, 0).filter((a) => a.attributes('aria-current') === 'true')
    const txCurrent = menuLinks(w, 1).filter((a) => a.attributes('aria-current') === 'true')
    expect(propertyCurrent).toHaveLength(1)
    expect(propertyCurrent[0].text()).toBe('빌라')
    expect(txCurrent).toHaveLength(1)
    expect(txCurrent[0].text()).toBe('전월세')
  })

  it('트리거에 aria-haspopup 과 aria-expanded 를 준다', async () => {
    const w = mountBar()
    const trigger = w.findAll('button')[0]
    expect(trigger.attributes('aria-haspopup')).toBe('true')
    expect(trigger.attributes('aria-expanded')).toBe('false')
    await trigger.trigger('click')
    expect(w.findAll('button')[0].attributes('aria-expanded')).toBe('true')
  })

  it('터치 타깃 44px 을 유지한다 — 트리거와 메뉴 항목 모두', () => {
    const w = mountBar()
    expect(w.findAll('button').every((b) => b.classes().includes('min-h-[44px]'))).toBe(true)
    expect(w.findAll('a').every((a) => a.classes().includes('min-h-[44px]'))).toBe(true)
  })

  it('토지는 넣지 않는다 — 지도가 다루지 않는 유형이라 클릭해도 반응할 수 없다', () => {
    const hrefs = mountBar().findAll('a').map((a) => a.attributes('href'))
    expect(hrefs.some((h) => h?.includes('land'))).toBe(false)
  })

  it('알 수 없는 type 이 와도 기본 조합으로 떨어진다 — 공유 링크가 깨진 값을 실어올 수 있다', () => {
    const triggers = mountBar('bogus').findAll('button')
    expect(triggers[0].text()).toContain('아파트')
    expect(triggers[1].text()).toContain('매매')
  })
})
