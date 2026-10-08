import { describe, it, expect, vi, afterEach } from 'vitest'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { createSSRApp, nextTick, ref } from 'vue'
import { renderToString } from 'vue/server-renderer'
import AppFooter from '~/components/common/AppFooter.vue'
import { SITE_BRAND_LINE } from '~/utils/seoConstants'

enableAutoUnmount(afterEach)
afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

const groups = [
  ['real-estate', '부동산 실거래가', [
    ['아파트', '/real-estate/apt-sale'], ['빌라', '/real-estate/villa-sale'],
    ['오피스텔', '/real-estate/offitel-sale'], ['지도로 찾기', '/real-estate'],
  ]],
  ['subscription', '청약·임대', [
    ['청약 전체 보기', '/subscription'], ['아파트 청약', '/subscription/sale/apt'],
    ['공공임대주택', '/subscription/rent/public'],
  ]],
  ['facilities', '생활시설', [
    ['병원', '/hospital'], ['약국', '/pharmacy'], ['학교', '/school'],
    ['어린이집', '/childcare'], ['전체 시설 보기', '/search'],
  ]],
  ['support', '일상킷 안내', [
    ['서비스 소개', '/about'], ['생활 가이드', '/guide'], ['자주 묻는 질문', '/faq'],
    ['문의하기', '/contact'], ['정보 수정 요청', '/contact#data-fix'],
  ]],
] as const

describe('AppFooter', () => {
  it('keeps the footer landmark, brand and aligned container', () => {
    const w = mount(AppFooter)
    expect(w.element.tagName).toBe('FOOTER')
    expect(w.attributes('role')).toBeUndefined()
    expect(w.classes()).toEqual(expect.arrayContaining(['bg-background-light', 'border-line', 'py-6', 'md:py-10']))
    expect(w.get('footer > div').classes()).toContain('page-container')
    expect(w.get('a[href="/"]').text()).toContain('일상킷')
    expect(w.text()).toContain(SITE_BRAND_LINE)
  })

  it.each(groups)('offers the agreed %s destinations in both navigation variants', (id, label, links) => {
    const w = mount(AppFooter)
    for (const prefix of ['footer-', 'footer-mobile-']) {
      const nav = w.get(`[data-testid="${prefix}${id}-links"]`)
      expect(nav.attributes('aria-label')).toBe(`${label} 링크`)
      expect(nav.findAll('a').map(a => [a.text(), a.attributes('href')])).toEqual(links)
      expect(nav.findAll('a').every(a => !a.attributes('target'))).toBe(true)
    }
  })

  it('omits rental links even in hidden markup and compact mode', () => {
    for (const compact of [false, true]) {
      const w = mount(AppFooter, { props: { compact } })
      for (const type of ['apt-rent', 'villa-rent', 'offitel-rent']) {
        expect(w.find(`a[href="/real-estate/${type}"]`).exists()).toBe(false)
      }
    }
  })

  it('initially opens only the property group with non-link summaries', () => {
    const w = mount(AppFooter)
    const details = w.findAll('details')
    expect(details.map(d => d.get('summary').text())).toEqual(groups.map(g => g[1]))
    expect(details.map(d => (d.element as HTMLDetailsElement).open)).toEqual([true, false, false, false])
    expect(w.findAll('summary a')).toHaveLength(0)
  })

  it('keeps one always-available policy, contact and source block', () => {
    const w = mount(AppFooter)
    expect(w.findAll('[data-testid="footer-meta"]')).toHaveLength(1)
    const meta = w.get('[data-testid="footer-meta"]')
    expect(meta.element.closest('details')).toBeNull()
    expect(meta.get('nav').findAll('a').map(a => a.attributes('href'))).toEqual(['/privacy', '/terms'])
    expect(meta.get('a[href="mailto:contact@ilsangkit.co.kr"]').text()).toBe('contact@ilsangkit.co.kr')
    expect(meta.text()).toContain('공공데이터를 가공한 참고용 정보입니다. 데이터셋별 출처와 이용 조건은 각 상세페이지를 확인해 주세요.')
    expect(meta.text()).toContain('운영 · 일상킷 팀')
    for (const href of ['https://www.data.go.kr', 'https://rt.molit.go.kr']) {
      const source = meta.get(`a[href="${href}"]`)
      expect(source.attributes('target')).toBe('_blank')
      expect(source.attributes('rel').split(/\s+/)).toEqual(expect.arrayContaining(['noopener', 'noreferrer']))
      expect(source.attributes('aria-label')).toContain('새 창')
    }
    for (const oldCopy of ['공공누리(KOGL)', 'All rights reserved', '확인 후 3~5일 내 반영']) {
      expect(w.text()).not.toContain(oldCopy)
    }
  })

  it('uses the current year rather than the preview year', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2028-04-01T12:00:00Z'))
    expect(mount(AppFooter).text()).toContain('© 2028 일상킷')
  })

  it.each([null, '2026-10-01T00:00:00.000Z', 'invalid'])('hides only the unavailable sync row: %s', value => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-08T12:00:00Z'))
    vi.stubGlobal('useAsyncData', () => ({ data: ref(value ? { pharmacy: value } : null) }))
    const w = mount(AppFooter)
    expect(w.text()).not.toContain('데이터 최종 동기화')
    expect(w.find('a[href="/privacy"]').exists()).toBe(true)
  })

  it('preserves native open state when fresh sync data arrives', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-08T12:00:00Z'))
    const data = ref<Record<string, string> | null>(null)
    vi.stubGlobal('useAsyncData', () => ({ data }))
    const w = mount(AppFooter)
    const first = w.get('details').element as HTMLDetailsElement
    first.open = false
    data.value = { pharmacy: '2026-10-08T06:00:00.000Z' }
    await nextTick()
    expect(first.open).toBe(false)
    expect(w.text()).toContain('데이터 최종 동기화')
    expect(w.text()).toContain('2026.10.08 15:00')
  })

  it('includes every destination in initial SSR HTML', async () => {
    const html = await renderToString(createSSRApp(AppFooter))
    for (const [, , links] of groups) {
      for (const [, href] of links) expect(html).toContain(`href="${href}"`)
    }
    expect(html).toContain('<details')
    expect(html).not.toContain('href="/real-estate/villa-rent"')
  })
})
