import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import AuctionDetailInfo from '~/components/auction/AuctionDetailInfo.vue'
import { EMPTY_FIELD_TEXT } from '~/utils/emptyField'
import type { AuctionItem } from '~/types/auction'

function makeItem(overrides: Partial<AuctionItem> = {}): AuctionItem {
  return {
    id: 1, cltrMngNo: '2024-00001-001', pbctCdtnNo: 'X', plnmNo: null,
    city: '서울특별시', district: '강남구', bjdCode: '1168000000', dongName: '역삼동',
    address: '서울 강남구 역삼동 123-4', usage: '아파트', usageGroup: 'residential',
    propertyType: '주거용', dpslMtdNm: '매각', bidMethod: null, competitionMethod: null,
    bidType: null, evictionResp: null, isShare: false, thumbnailUrl: null,
    landArea: null, bldArea: 84.5,
    apslAssAmt: 980000000, minBidPrc: 686000000, failCnt: 2, bidRound: 3,
    bidBeginDtm: null, bidCloseDtm: null, orgNm: '한국자산관리공사', pvctTrgtYn: false,
    status: 'ongoing', isClosed: false,
    resultType: null, winBidPrc: null, bidRate: null, resultDate: null,
    lat: 37.5, lng: 127.04,
    ...overrides,
  } as AuctionItem
}

const mountInfo = (item: AuctionItem) =>
  mount(AuctionDetailInfo, {
    props: { item },
    global: { stubs: { SectionBlock: { template: '<div><slot /></div>' } } },
  })

describe('AuctionDetailInfo — 집행기관 빈값 (§5-8 rule4)', () => {
  it('집행기관(orgNm)이 있으면 기관명을 노출한다', () => {
    const w = mountInfo(makeItem({ orgNm: '한국자산관리공사' }))
    expect(w.text()).toContain('한국자산관리공사')
    expect(w.text()).not.toContain(EMPTY_FIELD_TEXT)
  })

  it('집행기관이 없으면 빈값 문구를 truncate 없이 노출한다', () => {
    const w = mountInfo(makeItem({ orgNm: null }))
    expect(w.text()).toContain(EMPTY_FIELD_TEXT)
    const fallback = w.findAll('p').find(p => p.text() === EMPTY_FIELD_TEXT)
    expect(fallback).toBeTruthy()
    expect(fallback!.classes()).not.toContain('truncate')
  })
})
