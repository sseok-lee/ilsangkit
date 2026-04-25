import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useLhAnnouncement } from '~/composables/useLhAnnouncement'
import type { LhAnnouncement, LhAnnouncementListResponse } from '~/types/lhAnnouncement'

const mockFetch = vi.fn()
vi.stubGlobal('$fetch', mockFetch)
vi.stubGlobal('useApiBase', () => 'http://localhost:8000')
vi.stubGlobal('useRuntimeConfig', () => ({ public: { apiBase: 'http://localhost:8000' } }))

const baseAnnouncement: LhAnnouncement = {
  id: 7,
  panId: '20240003789',
  ccrCnntSysDsCd: '01',
  uppAisTpCd: '06',
  uppAisTpNm: '임대주택',
  aisTpCd: '01',
  aisTpNm: '국민임대',
  splInfTpCd: '060',
  panNm: '경기 부천 매입임대',
  cnpNm: '경기도',
  panDt: '2026-03-15T00:00:00Z',
  clsgDt: '2026-04-15T00:00:00Z',
  panSs: '공고중',
  dtlUrl: 'https://apply.lh.or.kr/notice/7',
  dtlUrlMob: null,
  bzdtNm: '부천 ABC 아파트',
  lctAraAdr: '경기도 부천시 원미로 100',
  lctAraDtlAdr: null,
  minMaxRsdnDdoAr: null,
  sumTotHshCnt: 200,
  mvinXpcYm: null,
  htnFmlaDsCdNm: null,
  edcFclCts: null,
  tffcFclCts: null,
  cvnFclCts: null,
  idtFclCts: null,
  splInfGudFcts: null,
  acpDttm: null,
  pzwrAncDt: null,
  pzwrPprSbmStDt: null,
  pzwrPprSbmEdDt: null,
  ctrtStDt: null,
  ctrtEdDt: null,
  hsSbscAcpTrgCdNm: null,
  splScdlGudFcts: null,
  panDtlCts: null,
  etcFcts: null,
  ctrtPlcAdr: null,
  ctrtPlcDtlAdr: null,
  silOfcTlno: null,
  silOfcGudFcts: null,
  lat: null,
  lng: null,
  sourceId: '20240003789-01',
  createdAt: '2026-03-15T00:00:00Z',
  updatedAt: '2026-04-25T00:00:00Z',
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useLhAnnouncement.fetchList', () => {
  it('populates items + pagination', async () => {
    mockFetch.mockResolvedValueOnce({
      success: true,
      data: {
        items: [baseAnnouncement],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      } as LhAnnouncementListResponse,
    })

    const { items, total, totalPages, fetchList } = useLhAnnouncement()
    await fetchList({ uppAisTpCd: '06', panSs: '공고중' })

    expect(items.value).toHaveLength(1)
    expect(items.value[0].panNm).toBe('경기 부천 매입임대')
    expect(total.value).toBe(1)
    expect(totalPages.value).toBe(1)

    const [url, options] = mockFetch.mock.calls[0]
    expect(url).toBe('http://localhost:8000/api/lh-announcement')
    expect(options.query).toEqual({ uppAisTpCd: '06', panSs: '공고중' })
  })

  it('captures error and clears state on failure', async () => {
    mockFetch.mockRejectedValueOnce(new Error('502 bad gateway'))
    const { items, total, fetchList, error } = useLhAnnouncement()
    await fetchList()
    expect(items.value).toEqual([])
    expect(total.value).toBe(0)
    expect(error.value).toBe('502 bad gateway')
  })
})

describe('useLhAnnouncement.fetchDetail', () => {
  it('populates detail with supplies + attachments', async () => {
    mockFetch.mockResolvedValueOnce({
      success: true,
      data: {
        ...baseAnnouncement,
        supplies: [
          {
            id: 10,
            announcementId: 7,
            listType: '02',
            htyNm: '49A',
            rsdnDdoAr: 49.0,
            splAr: 65.0,
            silHshCnt: 50,
            totHshCnt: 50,
            silAmt: null,
            lsGmy: 30000000,
            mmRfe: 200000,
            elyDsuAmt: null,
          },
        ],
        attachments: [
          { id: 99, announcementId: 7, ahflUrl: 'https://x', slPanAhflDsCdNm: '공고', cmnAhflNm: '공고문' },
        ],
      },
    })

    const { detail, fetchDetail } = useLhAnnouncement()
    await fetchDetail(7)
    expect(detail.value?.id).toBe(7)
    expect(detail.value?.supplies).toHaveLength(1)
    expect(detail.value?.supplies?.[0].lsGmy).toBe(30000000)
    expect(detail.value?.attachments).toHaveLength(1)
  })
})
