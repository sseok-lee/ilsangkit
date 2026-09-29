import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

const { setRegion, refresh, marketState } = vi.hoisted(() => ({
  setRegion: vi.fn(),
  refresh: vi.fn(),
  marketState: { state: {} as Record<string, unknown> },
}))

vi.mock('~/composables/useHomeMarket', async () => {
  const { ref } = await import('vue')
  const defaultMarket = {
    region: { city: 'seoul', district: 'gangnam', label: '서울 강남구' },
    window: { from: '2026-08-23', to: '2026-09-21' },
    generatedAt: '2026-09-21T00:00:00.000Z',
    counts: {
      apt: { status: 'ok', data: { total: 12, daily: [{ date: '2026-09-20', count: 3 }, { date: '2026-09-21', count: 9 }] } },
      villa: { status: 'ok', data: { total: 0, daily: [] } },
      offitel: { status: 'error', data: null, code: 'UNAVAILABLE' },
    },
    recent: {
      status: 'ok',
      data: [
        {
          type: 'apt',
          transactionId: 10,
          buildingKey: 'a'.repeat(64),
          city: '서울특별시',
          district: '강남구',
          bjdCode: '11680',
          buildingName: '테스트아파트',
          dongName: '대치동',
          jibun: '934-2',
          date: '2026-09-21',
          amount: 123000,
          area: null,
        },
        {
          type: 'villa',
          transactionId: 11,
          buildingKey: 'b'.repeat(64),
          city: '서울특별시',
          district: '마포구',
          bjdCode: '11440',
          buildingName: '테스트빌라',
          dongName: '서교동',
          jibun: null,
          date: '2026-09-20',
          amount: 45000,
          area: '59.50',
        },
        {
          type: 'offitel',
          transactionId: 12,
          buildingKey: 'c'.repeat(64),
          city: '부산광역시',
          district: '해운대구',
          bjdCode: '26350',
          buildingName: '테스트오피스텔',
          dongName: '우동',
          jibun: null,
          date: '2026-09-19',
          amount: 32000,
          area: '42.00',
        },
      ],
    },
  }

  return {
    useHomeMarket: () => ({
      region: ref({ city: 'seoul', district: 'gangnam' }),
      data: ref(defaultMarket),
      pending: ref(false),
      error: ref(null),
      setRegion,
      refresh,
      ...marketState.state,
    }),
  }
})

import HomeMarketSection from '~/components/home/HomeMarketSection.vue'

function mountWith(state: Record<string, unknown>) {
  marketState.state = state
  return mount(HomeMarketSection, {
    global: {
      stubs: {
        HardLink: {
          template: '<a :href="to"><slot /></a>',
          props: ['to'],
        },
      },
    },
  })
}

describe('HomeMarketSection', () => {
  it('3유형 total, 30일 건수 sparkline, 최근 거래 5개 목록을 렌더한다', () => {
    const wrapper = mountWith({})

    expect(wrapper.text()).toContain('서울 강남구')
    expect(wrapper.text()).toContain('아파트')
    expect(wrapper.text()).toContain('12건')
    expect(wrapper.text()).toContain('기간')
    expect(wrapper.text()).toContain('2026.08.23~2026.09.21')
    expect(wrapper.text()).toContain('조회시각')
    expect(wrapper.text()).toContain('계약일 기준')
    expect(wrapper.text()).toContain('추가 신고에 따라 수치가 달라질 수 있습니다')
    expect(wrapper.text()).toContain('단위 건')
    expect(wrapper.find('svg[aria-label*="단위 건"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('테스트아파트')
    expect(wrapper.text()).toContain('테스트빌라')
    expect(wrapper.text()).toContain('테스트오피스텔')
    expect(wrapper.text()).toContain('아파트')
    expect(wrapper.text()).toContain('빌라')
    expect(wrapper.text()).toContain('오피스텔')
    expect(wrapper.text()).toContain('면적 미제공')
    expect(wrapper.text()).toContain('대치동 934-2')
    expect(wrapper.find(`a[href="/real-estate/apt-sale/seoul/gangnam/%ED%85%8C%EC%8A%A4%ED%8A%B8%EC%95%84%ED%8C%8C%ED%8A%B8/${'a'.repeat(64)}"]`).exists()).toBe(true)
  })

  it('native select 변경으로 지역 변경을 요청하고 live status를 노출한다', async () => {
    const wrapper = mountWith({})

    await wrapper.find('select[aria-label="시도 선택"]').setValue('busan')
    await wrapper.find('select[aria-label="시군구 선택"]').setValue('haeundae')

    expect(setRegion).toHaveBeenLastCalledWith('busan', 'haeundae')
    expect(wrapper.find('[aria-live="polite"]').text()).toContain('지역')
  })

  it('로딩과 오류 상태에서는 이전 성공 데이터를 성공처럼 보여주지 않는다', () => {
    const loading = mountWith({ data: ref(null), pending: ref(true) })
    expect(loading.text()).toContain('불러오는 중')
    expect(loading.text()).not.toContain('테스트아파트')

    const failed = mountWith({ data: ref(null), error: ref(new Error('fail')) })
    expect(failed.text()).toContain('시장 정보를 불러오지 못했습니다')
    expect(failed.text()).not.toContain('테스트아파트')
  })
})
