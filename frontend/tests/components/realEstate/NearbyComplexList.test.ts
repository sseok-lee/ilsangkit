import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import NearbyComplexList from '~/components/realEstate/NearbyComplexList.vue'
import type { NearbyComplexItem, NearbyResponse } from '~/types/realEstate'

function item(over: Partial<NearbyComplexItem> = {}): NearbyComplexItem {
  return {
    buildingKey: 'a'.repeat(64),
    buildingName: '래미안',
    bjdCode: '1144012700',
    city: '서울특별시',
    district: '마포구',
    dongName: '한강로동',
    jibun: '123-4',
    buildYear: 2018,
    transactionCount: 30,
    latestPrice: 150_000,
    monthlyRent: null,
    latestDealYear: 2026,
    latestDealMonth: 9,
    lat: null,
    lng: null,
    recentCount3y: 42,
    areaDeal: {
      areaKey: '85',
      areaLabel: '84',
      isRepresentative: false,
      date: '2026-09-12',
      floor: 12,
      price: 49_800,
      monthlyRent: null,
      exclusiveArea: 84.94,
    },
    ...over,
  }
}

function nearby(over: Partial<NearbyResponse> = {}): NearbyResponse {
  return { apt: [], villa: [], offitel: [], targetArea: { key: '85', label: '84' }, ...over }
}

const baseProps = {
  currentProperty: 'apt' as const,
  mode: 'sale' as const,
  rentType: 'all' as const,
  dongName: '한강로동',
  districtName: '마포구',
  citySlug: 'seoul',
  districtSlug: 'mapo',
}

function mountList(data: NearbyResponse, props: Partial<typeof baseProps> & Record<string, unknown> = {}) {
  return mount(NearbyComplexList, { props: { ...baseProps, ...props, nearby: data } })
}

describe('NearbyComplexList 탭', () => {
  it('결과가 있는 유형만 "{유형} {건수}" 탭으로, 아파트·오피스텔·빌라 순서', () => {
    const wrapper = mountList(nearby({ apt: [item(), item({ buildingName: '자이' })], villa: [item({ buildingName: '빌라1' })] }))
    const tabs = wrapper.findAll('[role="tab"]')
    expect(tabs.map((t) => t.text())).toEqual(['아파트 2', '빌라 1'])
    expect(wrapper.find('[role="tablist"]').exists()).toBe(true)
  })

  it('기본 탭은 현재 페이지 유형, 없으면 첫 탭', () => {
    const data = nearby({ apt: [item()], villa: [item({ buildingName: '빌라1' })] })
    const onVilla = mountList(data, { currentProperty: 'villa' })
    expect(onVilla.find('[role="tab"][aria-selected="true"]').text()).toBe('빌라 1')

    const onOffitel = mountList(data, { currentProperty: 'offitel' })
    expect(onOffitel.find('[role="tab"][aria-selected="true"]').text()).toBe('아파트 1')
  })

  it('탭이 1개면 탭 줄을 숨긴다', () => {
    const wrapper = mountList(nearby({ apt: [item()] }))
    expect(wrapper.find('[role="tablist"]').exists()).toBe(false)
    expect(wrapper.find('[role="tabpanel"]').exists()).toBe(true)
  })

  it('비활성 패널도 DOM 에 있고(v-show) 내부 링크가 렌더된다', () => {
    const wrapper = mountList(nearby({ apt: [item()], villa: [item({ buildingName: '빌라1' })] }))
    const panels = wrapper.findAll('[role="tabpanel"]')
    expect(panels).toHaveLength(2)
    const villaPanel = wrapper.find('#nearby-panel-villa')
    expect(villaPanel.attributes('style')).toContain('display: none')
    expect(villaPanel.find('a').attributes('href')).toContain('/real-estate/villa-sale/')
    const villaTab = wrapper.find('#nearby-tab-villa')
    expect(villaTab.attributes('aria-controls')).toBe('nearby-panel-villa')
    expect(villaPanel.attributes('aria-labelledby')).toBe('nearby-tab-villa')
  })

  it('탭을 누르면 패널과 제목의 유형이 바뀐다', async () => {
    const wrapper = mountList(nearby({ apt: [item()], villa: [item({ buildingName: '빌라1' })] }))
    expect(wrapper.find('h3').text()).toBe('주변 아파트 매매가')
    await wrapper.find('#nearby-tab-villa').trigger('click')
    expect(wrapper.find('h3').text()).toBe('주변 빌라 매매가')
    expect(wrapper.find('#nearby-panel-apt').attributes('style')).toContain('display: none')
    expect(wrapper.find('#nearby-panel-villa').attributes('style') ?? '').not.toContain('display: none')
  })

  it('제목·설명은 모드를 따른다', () => {
    expect(mountList(nearby({ apt: [item()] }), { mode: 'rent', rentType: 'jeonse' }).find('h3').text()).toBe('주변 아파트 전세가')
    expect(mountList(nearby({ apt: [item()] }), { mode: 'rent', rentType: 'wolse' }).find('h3').text()).toBe('주변 아파트 월세가')
  })
})

describe('NearbyComplexList 설명·리스트', () => {
  it('같은 유형 탭 설명은 비교 면적, 다른 유형 탭은 대표 면적', async () => {
    const wrapper = mountList(nearby({ apt: [item()], villa: [item({ buildingName: '빌라1' })] }))
    expect(wrapper.text()).toContain('같은 한강로동 단지의 84㎡ 최근 매매가입니다. 평당가는 전용면적 기준입니다.')
    await wrapper.find('#nearby-tab-villa').trigger('click')
    expect(wrapper.text()).toContain('같은 한강로동 빌라 단지의 대표 면적 최근 매매가입니다.')
  })

  it('전세 설명', () => {
    const wrapper = mountList(nearby({ apt: [item()] }), { mode: 'rent', rentType: 'jeonse' })
    expect(wrapper.text()).toContain('같은 한강로동 단지의 84㎡ 최근 전세가입니다.')
  })

  it('데스크톱 2열·모바일 1열 그리드', () => {
    const wrapper = mountList(nearby({ apt: [item()] }))
    const list = wrapper.find('#nearby-panel-apt ul')
    expect(list.classes()).toEqual(expect.arrayContaining(['grid', 'grid-cols-1', 'md:grid-cols-2']))
  })

  it('행 문구: 준공·3년 거래 / 가격 / 면적·날짜·층 / 평당가(49800만원·84.94㎡ → 1,938만)', () => {
    const wrapper = mountList(nearby({ apt: [item()] }))
    const row = wrapper.find('[data-testid="nearby-row"]')
    expect(row.text()).toContain('래미안')
    expect(row.text()).toContain('2018년 준공 · 3년 거래 42건')
    expect(row.text()).toContain('4억 9,800만원')
    expect(row.text()).toContain('84㎡ · 26.09.12 · 12층')
    expect(row.text()).toContain('평당 1,938만원')
  })

  it('준공년도·층이 없으면 생략', () => {
    const base = item()
    const wrapper = mountList(nearby({ apt: [item({ buildYear: null, areaDeal: { ...base.areaDeal!, floor: null } })] }))
    const row = wrapper.find('[data-testid="nearby-row"]')
    expect(row.text()).toContain('3년 거래 42건')
    expect(row.text()).not.toContain('준공')
    expect(row.text()).toContain('84㎡ · 26.09.12')
    expect(row.text()).not.toContain('층')
  })

  it('대표 면적 행은 면적 뒤에 (대표 면적)', () => {
    const base = item()
    const wrapper = mountList(nearby({
      apt: [item({ areaDeal: { ...base.areaDeal!, areaKey: '60', areaLabel: '59', isRepresentative: true, floor: 1 } })],
    }))
    expect(wrapper.text()).toContain('59㎡(대표 면적) · 26.09.12 · 1층')
  })

  it('월세 거래는 보증금/월세, 평당가 생략', () => {
    const base = item()
    const wrapper = mountList(nearby({
      apt: [item({ areaDeal: { ...base.areaDeal!, price: 10_000, monthlyRent: 120 } })],
    }), { mode: 'rent', rentType: 'wolse' })
    const row = wrapper.find('[data-testid="nearby-row"]')
    expect(row.text()).toContain('1억/120만원')
    expect(row.text()).not.toContain('평당')
  })

  it('전세(월세 0)는 보증금과 평당가', () => {
    const base = item()
    const wrapper = mountList(nearby({
      apt: [item({ areaDeal: { ...base.areaDeal!, price: 49_800, monthlyRent: 0 } })],
    }), { mode: 'rent', rentType: 'jeonse' })
    const row = wrapper.find('[data-testid="nearby-row"]')
    expect(row.text()).toContain('4억 9,800만원')
    expect(row.text()).not.toContain('/')
    expect(row.text()).toContain('평당 1,938만원')
  })

  it('36개월 거래가 없으면 "최근 3년 거래 없음"(latestPrice 로 폴백하지 않음)', () => {
    const wrapper = mountList(nearby({ apt: [item({ areaDeal: null, recentCount3y: 0 })] }))
    const row = wrapper.find('[data-testid="nearby-row"]')
    expect(row.text()).toContain('최근 3년 거래 없음')
    expect(row.text()).not.toContain('15억')
  })

  it('행 링크는 유형+모드 상세 URL', () => {
    const wrapper = mountList(nearby({ villa: [item({ buildingKey: undefined, buildingName: '래미안' })] }), { currentProperty: 'villa' })
    expect(wrapper.find('[data-testid="nearby-row"] a').attributes('href')).toBe(
      `/real-estate/villa-sale/seoul/mapo/${encodeURIComponent('래미안')}`,
    )
  })

  it('하단: 출처와 활성 유형 목록 링크', async () => {
    const wrapper = mountList(nearby({ apt: [item()], villa: [item({ buildingName: '빌라1' })] }))
    expect(wrapper.text()).toContain('최근 3년 국토교통부 실거래')
    const footerLink = () => wrapper.find('[data-testid="nearby-list-link"]')
    expect(footerLink().text()).toContain('마포구 아파트 전체 보기')
    expect(footerLink().attributes('href')).toBe('/real-estate/apt-sale/seoul/mapo')
    await wrapper.find('#nearby-tab-villa').trigger('click')
    expect(footerLink().text()).toContain('마포구 빌라 전체 보기')
    expect(footerLink().attributes('href')).toBe('/real-estate/villa-sale/seoul/mapo')
  })

  it('구 응답(새 필드 없음)도 깨지지 않는다', () => {
    const legacy = item()
    delete legacy.areaDeal
    delete legacy.recentCount3y
    const wrapper = mountList({ apt: [legacy], villa: [], offitel: [] })
    const row = wrapper.find('[data-testid="nearby-row"]')
    expect(row.text()).toContain('래미안')
    expect(row.text()).toContain('15억')
    expect(wrapper.text()).toContain('같은 한강로동 아파트 단지의 대표 면적 최근 매매가입니다.')
  })
})
