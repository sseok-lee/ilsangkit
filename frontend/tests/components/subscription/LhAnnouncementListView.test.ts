import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { useLhAnnouncement } from '~/composables/useLhAnnouncement'
import LhAnnouncementListView from '~/components/subscription/LhAnnouncementListView.vue'
import type { LhAnnouncementListResponse, LhAnnouncement } from '~/types/lhAnnouncement'

const mockFetch = vi.fn()
vi.stubGlobal('$fetch', mockFetch)
vi.stubGlobal('useApiBase', () => 'http://localhost:8000')
vi.stubGlobal('useRuntimeConfig', () => ({ public: { apiBase: 'http://localhost:8000' } }))
vi.stubGlobal('useLhAnnouncement', useLhAnnouncement)

const sample: LhAnnouncement = {
  id: 7, panId: '20240003789', ccrCnntSysDsCd: '01',
  uppAisTpCd: '06', uppAisTpNm: '임대주택', aisTpCd: '01', aisTpNm: '국민임대',
  splInfTpCd: '060', panNm: '경기 부천 임대', cnpNm: '경기도',
  panDt: '2026-03-15T00:00:00Z', clsgDt: '2026-04-30T00:00:00Z',
  panSs: '공고중', dtlUrl: null, dtlUrlMob: null,
  bzdtNm: null, lctAraAdr: null, lctAraDtlAdr: null, minMaxRsdnDdoAr: null,
  sumTotHshCnt: null, mvinXpcYm: null, htnFmlaDsCdNm: null,
  edcFclCts: null, tffcFclCts: null, cvnFclCts: null, idtFclCts: null, splInfGudFcts: null,
  acpDttm: null, pzwrAncDt: null, pzwrPprSbmStDt: null, pzwrPprSbmEdDt: null,
  ctrtStDt: null, ctrtEdDt: null, hsSbscAcpTrgCdNm: null, splScdlGudFcts: null,
  panDtlCts: null, etcFcts: null,
  ctrtPlcAdr: null, ctrtPlcDtlAdr: null, silOfcTlno: null, silOfcGudFcts: null,
  lat: null, lng: null,
  sourceId: '20240003789-01', createdAt: '', updatedAt: '',
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('LhAnnouncementListView', () => {
  it('renders cards for fetched items', async () => {
    mockFetch.mockResolvedValue({
      success: true,
      data: {
        items: [sample],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      } as LhAnnouncementListResponse,
    })

    const wrapper = mount(LhAnnouncementListView, {
      global: {
        stubs: {
          SectionBlock: { template: '<section><slot /></section>' },
          Pagination: { template: '<nav />' },
          LhAnnouncementCard: { template: '<div class="lh-card">{{ announcement.panNm }}</div>', props: ['announcement'] },
        },
      },
    })
    await flushPromises()
    expect(wrapper.html()).toContain('경기 부천 임대')
  })

  it('exposes type/status filter chips', async () => {
    mockFetch.mockResolvedValue({
      success: true,
      data: {
        items: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      } as LhAnnouncementListResponse,
    })
    const wrapper = mount(LhAnnouncementListView, {
      global: {
        stubs: {
          SectionBlock: { template: '<section><slot /></section>' },
          Pagination: { template: '<nav />' },
          LhAnnouncementCard: true,
        },
      },
    })
    await flushPromises()
    expect(wrapper.text()).toContain('임대주택')
    expect(wrapper.text()).toContain('분양주택')
    expect(wrapper.text()).toContain('공고중')
    expect(wrapper.text()).toContain('마감')
  })

  it('shows empty state when items is []', async () => {
    mockFetch.mockResolvedValue({
      success: true,
      data: {
        items: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      } as LhAnnouncementListResponse,
    })
    const wrapper = mount(LhAnnouncementListView, {
      global: {
        stubs: {
          SectionBlock: { template: '<section><slot /></section>' },
          Pagination: { template: '<nav />' },
          LhAnnouncementCard: true,
        },
      },
    })
    await flushPromises()
    expect(wrapper.text()).toContain('조건에 맞는 공고가 없습니다')
  })
})
