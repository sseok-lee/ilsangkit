import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h, Suspense } from 'vue'
import AboutPage from '~/pages/about.vue'

const { setMeta } = vi.hoisted(() => ({ setMeta: vi.fn() }))
vi.mock('~/composables/useFacilityMeta', () => ({
  useFacilityMeta: () => ({ setMeta, setHomeMeta: vi.fn() }),
}))
vi.mock('~/composables/useStructuredData', () => ({
  useStructuredData: () => ({ setBreadcrumbSchema: vi.fn() }),
}))

async function mountSuspended(component: any) {
  const wrapper = mount(
    defineComponent({
      render() {
        return h(Suspense, null, { default: () => h(component) })
      },
    }),
    { global: { stubs: { NuxtLink: { template: '<a><slot /></a>' } } } },
  )
  await flushPromises()
  return wrapper
}

const FACILITY_LABELS = [
  '공공화장실', '쓰레기 배출정보', '무료와이파이', '의류수거함', '공영주차장',
  '자동심장충격기(AED)', '공공도서관', '병원', '약국',
  '공원', '학교', '전통시장', '어린이집', '전기차 충전소', '체육시설',
]

describe('About Page', () => {
  it('renders the page title via PageHead', async () => {
    const wrapper = await mountSuspended(AboutPage)
    expect(wrapper.find('h1').text()).toContain('서비스 소개')
  })

  // 네이버 '일상킷' 브랜드 검색 대표결과가 홈 대신 /about 으로 잡힌다(7월·10월).
  // 소개 페이지 title·h1 이 브랜드명으로 시작하면 바 브랜드 쿼리 관련성이 홈보다 높아진다.
  it('title·h1 을 브랜드명으로 시작하지 않는다(브랜드 검색 대표결과는 홈)', async () => {
    const wrapper = await mountSuspended(AboutPage)
    expect(wrapper.find('h1').text().startsWith('일상킷')).toBe(false)
    expect(setMeta).toHaveBeenCalledWith(expect.objectContaining({ title: '서비스 소개', path: '/about' }))
  })

  it('lists all 15 facility categories', async () => {
    const wrapper = await mountSuspended(AboutPage)
    const text = wrapper.text()
    for (const label of FACILITY_LABELS) {
      expect(text, `expected about page to mention "${label}"`).toContain(label)
    }
  })

  it('does NOT mention the removed 무인민원발급기 category', async () => {
    const wrapper = await mountSuspended(AboutPage)
    expect(wrapper.text()).not.toContain('무인민원')
  })

  it('data-source 테이블을 dataSource.ts 레지스트리에서 단일 소스로 렌더한다', async () => {
    const wrapper = await mountSuspended(AboutPage)
    const text = wrapper.text()
    // 레지스트리 기준 데이터셋명 (옛 하드코딩 명칭이 아님)
    expect(text).toContain('건강보험심사평가원 병원 정보')
    expect(text).toContain('건강보험심사평가원 약국 정보')
    expect(text).toContain('도시공원')
    expect(text).toContain('전통시장')
    expect(text).toContain('공공체육시설')
    // 단일 소스화로 교정된 제공기관 (about 옛 값과 달라짐)
    expect(text).toContain('환경부') // 쓰레기: 행정안전부 → 환경부
    expect(text).toContain('과학기술정보통신부') // 와이파이: 행정안전부 → 과학기술정보통신부
  })

  it('data-source 테이블에 부동산 세부 데이터셋을 유지한다', async () => {
    const wrapper = await mountSuspended(AboutPage)
    const text = wrapper.text()
    expect(text).toContain('아파트 매매 실거래가 자료')
    expect(text).toContain('아파트 전월세 실거래가 자료')
    expect(text).toContain('연립다세대 매매·전월세 실거래가 자료')
    expect(text).toContain('오피스텔 매매·전월세 실거래가 자료')
    expect(text).toContain('토지 매매 실거래가 자료')
  })
})
