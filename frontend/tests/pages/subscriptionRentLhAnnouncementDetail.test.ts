import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref } from 'vue'
import LhDetail from '~/pages/subscription/rent/lh/announcement/[id].vue'
import type { LhAnnouncement } from '~/types/lhAnnouncement'

vi.mock('~/composables/useStructuredData', () => ({
  useStructuredData: () => ({ setBreadcrumbSchema: vi.fn() }),
}))

const baseAnnouncement: LhAnnouncement = {
  id: 7,
  panId: '20240003789',
  ccrCnntSysDsCd: '01',
  uppAisTpCd: '06',
  uppAisTpNm: '임대주택',
  aisTpCd: '01',
  aisTpNm: '국민임대',
  splInfTpCd: '060',
  panNm: '경기 부천 매입임대 1차',
  cnpNm: '경기도',
  panDt: '2026-03-15T00:00:00Z',
  clsgDt: '2026-04-30T00:00:00Z',
  panSs: '공고중',
  dtlUrl: 'https://apply.lh.or.kr/notice/7',
  dtlUrlMob: null,
  bzdtNm: '부천 ABC 아파트',
  lctAraAdr: '경기도 부천시 원미로 100',
  lctAraDtlAdr: null,
  minMaxRsdnDdoAr: '49.0~74.94',
  sumTotHshCnt: 200,
  mvinXpcYm: '2026.10',
  htnFmlaDsCdNm: '아파트',
  edcFclCts: '초/중/고 도보권',
  tffcFclCts: '7호선 부천시청역',
  cvnFclCts: null,
  idtFclCts: null,
  splInfGudFcts: null,
  acpDttm: '2026.04.10 09:00 ~ 2026.04.12 17:00',
  pzwrAncDt: '2026.04.20',
  pzwrPprSbmStDt: '2026.04.21',
  pzwrPprSbmEdDt: '2026.04.25',
  ctrtStDt: '2026.05.01',
  ctrtEdDt: '2026.05.05',
  hsSbscAcpTrgCdNm: '청년/신혼/일반',
  splScdlGudFcts: null,
  panDtlCts: '본 공고 내용은 다음과 같습니다.\n…',
  etcFcts: null,
  ctrtPlcAdr: '경기도 부천시 길주로 200',
  ctrtPlcDtlAdr: '2층 안내데스크',
  silOfcTlno: '032-123-4567',
  silOfcGudFcts: null,
  lat: null,
  lng: null,
  sourceId: '20240003789-01',
  createdAt: '', updatedAt: '',
  supplies: [
    { id: 10, announcementId: 7, listType: '02', htyNm: '49A', rsdnDdoAr: 49.0, splAr: 65.0, silHshCnt: 50, totHshCnt: 50, silAmt: null, lsGmy: 30000000, mmRfe: 200000, elyDsuAmt: null },
    { id: 11, announcementId: 7, listType: '02', htyNm: '74B', rsdnDdoAr: 74.94, splAr: 99.09, silHshCnt: 14, totHshCnt: 14, silAmt: null, lsGmy: 84196000, mmRfe: 669250, elyDsuAmt: null },
  ],
  attachments: [
    { id: 99, announcementId: 7, ahflUrl: 'https://lh.or.kr/file.pdf', slPanAhflDsCdNm: '공고문', cmnAhflNm: '공고문 첨부' },
  ],
}

const stubs = {
  SectionBlock: { template: '<section :data-test-section="$attrs[\'data-test-section\']"><h2>{{ heading }}</h2><slot /></section>', props: ['heading'], inheritAttrs: false },
  ClientOnly: { template: '<div><slot /></div>' },
  KakaoMap: { template: '<div class="kakao-stub" />', props: ['center', 'level'] },
}

function setupMocks(payload: { success: boolean; data: LhAnnouncement } | null, opts: { id?: string; throwOnFetch?: boolean } = {}) {
  vi.stubGlobal('useRoute', () => ({ params: { id: opts.id ?? '7' } }))
  vi.stubGlobal('createError', (e: unknown) => {
    const err = new Error(typeof e === 'object' && e !== null && 'statusMessage' in e ? String((e as { statusMessage: unknown }).statusMessage) : 'createError')
    Object.assign(err, e)
    return err
  })
  vi.stubGlobal('useApiBase', () => 'http://localhost:8000')
  vi.stubGlobal('$fetch', vi.fn())
  vi.stubGlobal('useAsyncData', vi.fn(() => {
    const result = (opts.throwOnFetch || !payload)
      ? {
          data: ref(null),
          pending: ref(false),
          error: ref(new Error('boom')),
          refresh: vi.fn(),
          status: ref('error'),
        }
      : {
          data: ref(payload),
          pending: ref(false),
          error: ref(null),
          refresh: vi.fn(),
          status: ref('success'),
        }
    return Object.assign(Promise.resolve(result), result)
  }))
}

async function mountAndCatch(): Promise<{ wrapper: ReturnType<typeof mount> | null; error: unknown }> {
  try {
    const wrapper = mount(LhDetail, { global: { stubs } })
    await flushPromises()
    return { wrapper, error: null }
  } catch (err) {
    return { wrapper: null, error: err }
  }
}

describe('subscription/rent/lh/announcement/[id].vue', () => {
  it('renders all 7 sections when announcement is fully populated', async () => {
    setupMocks({ success: true, data: baseAnnouncement })
    const { wrapper, error } = await mountAndCatch()
    expect(error).toBeNull()
    expect(wrapper).not.toBeNull()
    const html = wrapper!.html()
    expect(html).toContain('data-test-section="header"')
    expect(html).toContain('data-test-section="schedule"')
    expect(html).toContain('data-test-section="complex"')
    expect(html).toContain('data-test-section="supplies"')
    expect(html).toContain('data-test-section="contact"')
    expect(html).toContain('data-test-section="body"')
    expect(html).toContain('data-test-section="attachments"')
    expect(wrapper!.text()).toContain('경기 부천 매입임대 1차')
    expect(wrapper!.text()).toContain('공고중')
  })

  it('shows 마감 status with slate badge', async () => {
    setupMocks({ success: true, data: { ...baseAnnouncement, panSs: '마감' } })
    const { wrapper } = await mountAndCatch()
    expect(wrapper!.text()).toContain('마감')
    expect(wrapper!.html()).toContain('slate-500')
  })

  it('omits attachments section when no attachments', async () => {
    setupMocks({ success: true, data: { ...baseAnnouncement, attachments: [] } })
    const { wrapper } = await mountAndCatch()
    expect(wrapper!.html()).not.toContain('data-test-section="attachments"')
  })

  it('throws 404 createError when api fetch fails', async () => {
    setupMocks(null, { throwOnFetch: true })
    const { wrapper, error } = await mountAndCatch()
    expect(error).not.toBeNull()
    expect(wrapper).toBeNull()
    expect(String(error)).toContain('존재하지 않는 LH 공고')
  })

  it('throws 404 createError when id param is non-numeric', async () => {
    setupMocks({ success: true, data: baseAnnouncement }, { id: 'abc' })
    const { wrapper, error } = await mountAndCatch()
    expect(error).not.toBeNull()
    expect(wrapper).toBeNull()
    expect(String(error)).toContain('존재하지 않는 LH 공고')
  })

  it('renders 임대보증금 header in supplies table for rental announcement', async () => {
    setupMocks({ success: true, data: baseAnnouncement })
    const { wrapper } = await mountAndCatch()
    const html = wrapper!.html()
    expect(html).toContain('임대보증금')
    expect(html).toContain('월임대료')
  })
})
