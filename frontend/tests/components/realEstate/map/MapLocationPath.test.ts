import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MapLocationPath from '~/components/realEstate/map/MapLocationPath.vue'
import type { MapPathCrumb } from '~/utils/mapLocationPath'

const CRUMBS: MapPathCrumb[] = [
  { label: '전국', href: '/real-estate/apt-sale', level: 13 },
  { label: '서울', href: '/real-estate/apt-sale/seoul', level: 9, city: '서울' },
  { label: '서초구', href: '/real-estate/apt-sale/seoul/seocho', level: 7, city: '서울', district: '서초구' },
  { label: '서초동', href: null, level: null },
]

describe('MapLocationPath', () => {
  it('상위 칸은 링크, 마지막 칸은 현재 위치 글자다', () => {
    const w = mount(MapLocationPath, { props: { crumbs: CRUMBS } })
    expect(w.text().replace(/\s+/g, '')).toBe('전국›서울›서초구›서초동')
    const links = w.findAll('a')
    expect(links.map((a) => a.attributes('href'))).toEqual([
      '/real-estate/apt-sale', '/real-estate/apt-sale/seoul', '/real-estate/apt-sale/seoul/seocho',
    ])
    expect(w.find('[aria-current="location"]').text()).toBe('서초동')
  })

  it('링크 클릭은 페이지 이동 대신 navigate 로 그 칸을 올린다', async () => {
    const w = mount(MapLocationPath, { props: { crumbs: CRUMBS } })
    const ev = new MouseEvent('click', { bubbles: true, cancelable: true })
    w.findAll('a')[1].element.dispatchEvent(ev)
    expect(ev.defaultPrevented).toBe(true)
    expect(w.emitted('navigate')?.[0]).toEqual([CRUMBS[1]])
  })

  it('링크는 터치 타깃 44px 이상', () => {
    const w = mount(MapLocationPath, { props: { crumbs: CRUMBS } })
    for (const a of w.findAll('a')) expect(a.classes()).toContain('min-h-[44px]')
  })
})
