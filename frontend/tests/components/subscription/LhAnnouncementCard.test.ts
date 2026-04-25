import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import LhAnnouncementCard from '~/components/subscription/LhAnnouncementCard.vue'
import type { LhAnnouncement } from '~/types/lhAnnouncement'

const base: LhAnnouncement = {
  id: 7,
  panId: '20240003789',
  ccrCnntSysDsCd: '01',
  uppAisTpCd: '06',
  uppAisTpNm: '임대주택',
  aisTpCd: '01',
  aisTpNm: '국민임대',
  splInfTpCd: '060',
  panNm: '경기 부천 국민임대',
  cnpNm: '경기도',
  panDt: '2026-03-15T00:00:00Z',
  clsgDt: '2026-04-30T00:00:00Z',
  panSs: '공고중',
  dtlUrl: null,
  dtlUrlMob: null,
  bzdtNm: null, lctAraAdr: null, lctAraDtlAdr: null, minMaxRsdnDdoAr: null,
  sumTotHshCnt: null, mvinXpcYm: null, htnFmlaDsCdNm: null,
  edcFclCts: null, tffcFclCts: null, cvnFclCts: null, idtFclCts: null, splInfGudFcts: null,
  acpDttm: null, pzwrAncDt: null, pzwrPprSbmStDt: null, pzwrPprSbmEdDt: null,
  ctrtStDt: null, ctrtEdDt: null, hsSbscAcpTrgCdNm: null, splScdlGudFcts: null,
  panDtlCts: null, etcFcts: null,
  ctrtPlcAdr: null, ctrtPlcDtlAdr: null, silOfcTlno: null, silOfcGudFcts: null,
  lat: null, lng: null,
  sourceId: '20240003789-01',
  createdAt: '', updatedAt: '',
}

beforeEach(() => {
  // Pin 'today' to 2026-04-25 for deterministic D-day
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-04-25T09:00:00Z'))
})

describe('LhAnnouncementCard', () => {
  it('renders panNm and cnpNm', () => {
    const wrapper = mount(LhAnnouncementCard, { props: { announcement: base } })
    expect(wrapper.text()).toContain('경기 부천 국민임대')
    expect(wrapper.text()).toContain('경기도')
  })

  it('renders 공고중 status badge', () => {
    const wrapper = mount(LhAnnouncementCard, { props: { announcement: base } })
    expect(wrapper.text()).toContain('공고중')
    expect(wrapper.html()).toContain('green')
  })

  it('renders 마감 status badge with slate styling', () => {
    const wrapper = mount(LhAnnouncementCard, {
      props: { announcement: { ...base, panSs: '마감' } },
    })
    expect(wrapper.text()).toContain('마감')
    expect(wrapper.html()).toContain('slate-500')
  })

  it('uses amber badge for 임대 type and blue for 분양 type', () => {
    const rental = mount(LhAnnouncementCard, { props: { announcement: base } })
    expect(rental.html()).toContain('amber')

    const sale = mount(LhAnnouncementCard, {
      props: { announcement: { ...base, uppAisTpNm: '분양주택' } },
    })
    expect(sale.html()).toContain('bg-blue-100')
  })

  it('computes D-day for upcoming closing date', () => {
    // today 2026-04-25, closing 2026-04-30 → D-5
    const wrapper = mount(LhAnnouncementCard, { props: { announcement: base } })
    expect(wrapper.text()).toContain('D-5')
  })

  it('does not render D-day when status is 마감', () => {
    const wrapper = mount(LhAnnouncementCard, {
      props: { announcement: { ...base, panSs: '마감' } },
    })
    expect(wrapper.text()).not.toMatch(/D-\d+/)
  })

  it('formats panDt as YYYY.MM.DD', () => {
    const wrapper = mount(LhAnnouncementCard, { props: { announcement: base } })
    expect(wrapper.text()).toContain('2026.03.15')
  })
})
