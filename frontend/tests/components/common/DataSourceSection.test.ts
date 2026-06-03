import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import DataSourceSection from '~/components/common/DataSourceSection.vue'

vi.mock('~/utils/dataSource', async (importOriginal) => {
  const actual = await importOriginal<typeof import('~/utils/dataSource')>()
  return { ...actual }
})
import * as dataSourceModule from '~/utils/dataSource'

const NuxtLinkStub = { props: ['to'], template: '<a :href="to"><slot /></a>' }

function mountSection(props: Record<string, unknown>) {
  return mount(DataSourceSection, {
    props,
    global: { stubs: { NuxtLink: NuxtLinkStub } },
  })
}

describe('DataSourceSection', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('헤더 라벨이 "데이터 출처"이다', () => {
    const wrapper = mountSection({ domain: 'facility', category: 'hospital' })
    expect(wrapper.text()).toContain('데이터 출처')
    expect(wrapper.text()).not.toContain('데이터 정보')
  })

  it('동기화일 없이도 제공기관·데이터셋을 항상 렌더한다', () => {
    const wrapper = mountSection({ domain: 'facility', category: 'hospital' })
    expect(wrapper.text()).toContain('건강보험심사평가원')
    expect(wrapper.text()).toContain('건강보험심사평가원 병원 정보')
  })

  it('lastSyncDate가 전달되면 "최근 동기화" 행을 표시한다', () => {
    const wrapper = mountSection({ domain: 'real-estate', lastSyncDate: '2026-05-28' })
    expect(wrapper.text()).toContain('최근 동기화')
    expect(wrapper.text()).toContain('2026-05-28')
  })

  it('데이터 기준일(dataDate) 행은 더 이상 렌더하지 않는다', () => {
    const wrapper = mountSection({ domain: 'facility', category: 'hospital', lastSyncDate: '2026-05-28' })
    expect(wrapper.text()).not.toContain('데이터 기준일')
  })

  it('알 수 없는 도메인/카테고리면 아무것도 렌더하지 않는다', () => {
    const wrapper = mountSection({ domain: 'facility' })
    expect(wrapper.text()).toBe('')
  })

  it('compact 모드는 한 줄 안내와 /about 링크를 렌더한다', () => {
    const wrapper = mountSection({ domain: 'facility', compact: true })
    expect(wrapper.text()).toContain('데이터 출처')
    expect(wrapper.text()).toContain('공공데이터포털')
    expect(wrapper.get('a').attributes('href')).toBe('/about')
    // compact와 full 카드는 상호 배타적 — full 카드(h2 헤더)는 렌더되지 않는다
    expect(wrapper.findAll('h2').length).toBe(0)
  })

  it('kogl 유형이 없으면 "공공누리 제N유형" 문구를 표시하지 않는다', () => {
    const wrapper = mountSection({ domain: 'real-estate' })
    expect(wrapper.text()).not.toContain('공공누리 제')
  })

  it('kogl 유형이 있으면 "공공누리 제N유형" 문구를 포함한다', () => {
    vi.spyOn(dataSourceModule, 'resolveDataSource').mockReturnValue({
      datasetName: '테스트셋',
      provider: '테스트기관',
      url: 'https://example.com',
      kogl: 1,
    })
    const wrapper = mountSection({ domain: 'facility', category: 'toilet' })
    expect(wrapper.text()).toContain('공공누리 제1유형')
  })
})
