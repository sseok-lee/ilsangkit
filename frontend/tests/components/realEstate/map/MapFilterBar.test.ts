import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
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
})
