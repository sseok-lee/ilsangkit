import { describe, it, expect, vi, afterEach } from 'vitest'
import { ref } from 'vue'
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

describe('DataSourceSection — 수정 요청은 카드가 아닌 푸터가 담당', () => {
  it('full 카드에는 수정 요청 링크를 렌더하지 않는다(푸터 운영블록과 중복 제거)', () => {
    const w = mount(DataSourceSection, {
      props: { domain: 'facility', category: 'pharmacy' },
      global: { stubs: { NuxtLink: NuxtLinkStub } },
    })
    expect(w.text()).not.toContain('정보가 실제와 다른가요?')
    expect(w.text()).not.toContain('수정 요청')
    expect(w.text()).not.toContain('3~5일 내 반영')
    expect(w.html()).not.toContain('/contact#data-fix')
  })

  it('compact 모드에도 수정 요청 링크가 없다', () => {
    const w = mount(DataSourceSection, {
      props: { domain: 'facility', compact: true },
      global: { stubs: { NuxtLink: NuxtLinkStub } },
    })
    expect(w.text()).not.toContain('수정 요청')
  })
})

describe('DataSourceSection — ⓘ 안내 문구(데이터셋 이름 미반복)', () => {
  afterEach(() => vi.restoreAllMocks())

  it('full 카드 안내 문구가 데이터셋 이름을 반복하지 않고 "공표된 원본 데이터 기준입니다"를 렌더한다', () => {
    vi.spyOn(dataSourceModule, 'resolveDataSource').mockReturnValue({
      datasetName: '테스트셋',
      provider: '테스트기관',
      url: 'https://example.com',
    })
    const w = mountSection({ domain: 'facility', category: 'toilet' })
    expect(w.text()).toContain('공표된 원본 데이터 기준입니다')
    // 데이터셋 이름을 값 행 + 안내 문구에 이중 렌더하지 않는다
    expect(w.text()).not.toContain('테스트셋 기준 정보입니다')
  })
})

describe('DataSourceSection — TrustLine 억제 레지스트리', () => {
  afterEach(() => vi.restoreAllMocks())

  function mountWithRegistry(props: Record<string, unknown>, registry: { value: number }) {
    return mount(DataSourceSection, {
      props,
      global: { stubs: { NuxtLink: NuxtLinkStub }, provide: { sourceCardRegistry: registry } },
    })
  }

  it('full 카드는 sourceCardRegistry를 +1 하고 언마운트 시 -1 한다(전역 TrustLine 억제)', () => {
    const reg = ref(0)
    const w = mountWithRegistry({ domain: 'facility', category: 'hospital' }, reg)
    expect(reg.value).toBe(1)
    w.unmount()
    expect(reg.value).toBe(0)
  })

  it('compact 모드는 레지스트리를 증가시키지 않는다(작은 인라인 안내는 억제 대상 아님)', () => {
    const reg = ref(0)
    mountWithRegistry({ domain: 'facility', compact: true }, reg)
    expect(reg.value).toBe(0)
  })

  it('source가 없으면(카드 미렌더) 레지스트리를 증가시키지 않는다', () => {
    const reg = ref(0)
    mountWithRegistry({ domain: 'facility' }, reg) // category 없음 → source null → 카드 미렌더
    expect(reg.value).toBe(0)
  })
})
