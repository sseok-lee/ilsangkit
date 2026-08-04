import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import MapFilterBar from '~/components/realEstate/map/MapFilterBar.vue'

const TYPES = ['apt-sale', 'apt-rent', 'villa-sale', 'villa-rent', 'offitel-sale', 'offitel-rent']

function mountBar(type = 'apt-sale') {
  return mount(MapFilterBar, { props: { type } })
}

describe('MapFilterBar', () => {
  // 하단 유형 카드를 제거하면 apt-rent·villa-rent·offitel-rent 허브로 가는 내부 링크는
  // 사이트 전체에서 여기가 유일해진다(GNB 드롭다운은 매매 4종만 싣는다).
  it('6종 전부를 href 있는 링크로 렌더한다', () => {
    const hrefs = mountBar().findAll('a').map((a) => a.attributes('href'))
    expect(hrefs).toEqual(TYPES.map((t) => `/real-estate/${t}`))
  })

  it('button 을 남기지 않는다 — button 은 크롤 경로가 아니다', () => {
    expect(mountBar().findAll('button')).toHaveLength(0)
  })

  it('토지는 넣지 않는다 — 지도가 다루지 않는 유형이라 클릭해도 반응할 수 없다', () => {
    const hrefs = mountBar().findAll('a').map((a) => a.attributes('href'))
    expect(hrefs).not.toContain('/real-estate/land')
  })

  it('평범한 클릭은 기본 동작을 막고 타입 전환만 emit 한다', async () => {
    const w = mountBar()
    await w.findAll('a')[1].trigger('click')
    expect(w.emitted('update:type')).toEqual([['apt-rent']])
  })

  it('⌘/Ctrl+클릭은 가로채지 않는다 — 새 탭으로 열려야 한다', async () => {
    // @click.prevent 만 쓰면 수식 키 클릭까지 막혀 새 탭 열기가 죽는다. .exact 가 필요하다.
    const w = mountBar()
    await w.findAll('a')[1].trigger('click', { metaKey: true })
    await w.findAll('a')[1].trigger('click', { ctrlKey: true })
    expect(w.emitted('update:type')).toBeUndefined()
  })

  it('⌘클릭의 기본 동작(새 탭 열기)이 실제로 막히지 않는다 — @click.exact.prevent 순서 가드', () => {
    // emit 유무만 보면 .exact 와 .prevent 순서가 바뀌어도(즉 .prevent.exact) 둘 다
    // emit 은 안 하므로 위 테스트가 계속 통과한다 — 그 회귀를 못 잡는다. .prevent.exact 로
    // 바뀌면 .prevent 가 먼저 실행돼 수식 키 클릭이어도 preventDefault 가 걸려 새 탭이
    // 열리지 않는다. defaultPrevented 를 직접 확인해 순서를 가드한다.
    const w = mountBar()
    const el = w.findAll('a')[1].element
    const event = new MouseEvent('click', { metaKey: true, cancelable: true, bubbles: true })
    el.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(false)
    expect(w.emitted('update:type')).toBeUndefined()
  })

  it('선택된 항목만 aria-current 를 갖는다', () => {
    // aria-pressed 는 토글 버튼 전용 속성이라 링크에 쓰면 무효다.
    const links = mountBar('villa-rent').findAll('a')
    const current = links.filter((a) => a.attributes('aria-current') === 'true')
    expect(current).toHaveLength(1)
    expect(current[0].text()).toBe('빌라 전월세')
    expect(links.some((a) => a.attributes('aria-pressed') !== undefined)).toBe(false)
  })

  it('터치 타깃 44px 을 유지한다', () => {
    expect(mountBar().findAll('a').every((a) => a.classes().includes('min-h-[44px]'))).toBe(true)
  })

  // 모바일에서 6개 라벨이 두 줄로 감싸져 지도 상단 112px 를 덮던 문제의 회귀 가드.
  it('가로 스크롤 1줄이다 — 줄바꿈하지 않는다', () => {
    const classes = mountBar().find('div').classes()
    expect(classes).toContain('flex-nowrap')
    expect(classes).toContain('overflow-x-auto')
    expect(classes).not.toContain('flex-wrap')
  })

  it('각 항목은 shrink-0 이다 — 압축 대신 스크롤되어야 한다', () => {
    expect(mountBar().findAll('a').every((a) => a.classes().includes('shrink-0'))).toBe(true)
  })

  it('마운트 시 선택된 항목을 스크롤해 보이게 한다 — 공유 링크가 마지막 항목을 선택한 채 도착할 수 있다', () => {
    const scrollIntoView = vi.fn()
    HTMLElement.prototype.scrollIntoView = scrollIntoView
    mountBar('offitel-rent')
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest', inline: 'nearest' })
  })

  it('type 이 바뀌면 새로 선택된 항목을 스크롤해 보이게 한다', async () => {
    const scrollIntoView = vi.fn()
    HTMLElement.prototype.scrollIntoView = scrollIntoView
    const w = mountBar('apt-sale')
    scrollIntoView.mockClear()
    await w.setProps({ type: 'offitel-rent' })
    await nextTick() // watcher 내부에서 한 번 더 nextTick 을 기다린다 — setProps 의 flush 로는 안 잡힌다
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest', inline: 'nearest' })
  })
})
