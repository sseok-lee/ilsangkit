import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import RegionChips from '~/components/common/RegionChips.vue'

// 전역 NuxtLink stub 이 href 를 안 뿌릴 수 있으므로 로컬 stub 으로 to→href 매핑
const NuxtLinkStub = { props: ['to'], template: '<a :href="to"><slot /></a>' }

function mountChips(props: Record<string, unknown> = {}) {
  return mount(RegionChips, {
    props: { hrefFor: (slug: string) => (slug ? `/toilet?city=${slug}` : '/toilet'), ...props },
    global: { stubs: { NuxtLink: NuxtLinkStub } },
  })
}

describe('RegionChips', () => {
  it('activeSlug 없으면 16개 칩을 렌더하고 hrefFor 를 적용한다', () => {
    const w = mountChips()
    const links = w.findAll('a')
    expect(links).toHaveLength(16)
    expect(links[0].attributes('href')).toBe('/toilet?city=seoul')
    const hrefs = links.map((a) => a.attributes('href'))
    expect(hrefs).toContain('/toilet?city=jeonnamgwangju')
    expect(hrefs).not.toContain('/toilet?city=gwangju')
    expect(w.text()).toContain('전남·광주')
  })

  it('activeSlug 가 있으면 맨 앞에 "전체" 리셋 칩을 두고 활성 칩에 aria-current 를 준다', () => {
    const w = mountChips({ activeSlug: 'seoul' })
    const links = w.findAll('a')
    expect(links).toHaveLength(17) // 전체 + 16
    expect(links[0].text()).toBe('전체')
    expect(links[0].attributes('href')).toBe('/toilet')
    const current = w.find('[aria-current="page"]')
    expect(current.exists()).toBe(true)
    expect(current.text()).toBe('서울')
  })
})
