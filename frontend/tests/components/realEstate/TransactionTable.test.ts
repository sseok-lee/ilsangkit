import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import TransactionTable from '~/components/realEstate/TransactionTable.vue'
import type { SaleTransaction, RentTransaction } from '~/types/realEstate'

const mockSaleTransactions: SaleTransaction[] = [
  {
    id: 1,
    city: '서울특별시',
    district: '강남구',
    bjdCode: '1168010100',
    dongName: '대치동',
    buildingName: '대치아이파크',
    buildYear: 2005,
    floor: 10,
    exclusiveArea: 84.5,
    jibun: '123',
    roadName: '테헤란로',
    lat: 37.5,
    lng: 127.0,
    dealYear: 2024,
    dealMonth: 3,
    dealDay: 15,
    dealAmount: 150000,
    dealType: '중개거래',
    cancelDealDay: null,
    cancelDealType: null,
    buyerType: '개인',
    sellerType: '법인',
  },
  {
    id: 2,
    city: '서울특별시',
    district: '강남구',
    bjdCode: '1168010100',
    dongName: '대치동',
    buildingName: '래미안대치팰리스',
    buildYear: 2015,
    floor: 5,
    exclusiveArea: 59.3,
    jibun: '456',
    roadName: '남부순환로',
    lat: 37.5,
    lng: 127.0,
    dealYear: 2024,
    dealMonth: 3,
    dealDay: 20,
    dealAmount: 5000,
    dealType: '직거래',
    cancelDealDay: null,
    cancelDealType: null,
    buyerType: null,
    sellerType: null,
  },
]

const mockCancelledSale: SaleTransaction = {
  id: 99,
  city: '서울특별시',
  district: '강남구',
  bjdCode: '1168010100',
  dongName: '대치동',
  buildingName: '취소테스트아파트',
  buildYear: 2010,
  floor: 3,
  exclusiveArea: 60,
  jibun: '789',
  roadName: '강남대로',
  lat: 37.5,
  lng: 127.0,
  dealYear: 2024,
  dealMonth: 2,
  dealDay: 10,
  dealAmount: 90000,
  dealType: '중개거래',
  cancelDealDay: '2024-03-01',
  cancelDealType: '취소',
  buyerType: '개인',
  sellerType: '개인',
}

const mockRentTransactions: RentTransaction[] = [
  {
    id: 3,
    city: '서울특별시',
    district: '강남구',
    bjdCode: '1168010100',
    dongName: '대치동',
    buildingName: '대치아이파크',
    buildYear: 2005,
    floor: 10,
    exclusiveArea: 84.5,
    jibun: '123',
    roadName: '테헤란로',
    lat: 37.5,
    lng: 127.0,
    dealYear: 2024,
    dealMonth: 3,
    dealDay: 15,
    rentType: '월세',
    deposit: 5000,
    monthlyRent: 200,
    contractTerm: 24,
    contractType: '갱신',
    preDeposit: 4500,
    preMonthlyRent: 180,
    useRenewalRight: '사용',
  },
  {
    id: 4,
    city: '서울특별시',
    district: '강남구',
    bjdCode: '1168010100',
    dongName: '대치동',
    buildingName: '래미안대치팰리스',
    buildYear: 2015,
    floor: 5,
    exclusiveArea: 59.3,
    jibun: '456',
    roadName: '남부순환로',
    lat: 37.5,
    lng: 127.0,
    dealYear: 2024,
    dealMonth: 3,
    dealDay: 20,
    rentType: '전세',
    deposit: 80000,
    monthlyRent: null,
    contractTerm: 24,
    contractType: '신규',
    preDeposit: null,
    preMonthlyRent: null,
    useRenewalRight: null,
  },
]

describe('TransactionTable', () => {
  describe('매매 테이블 (type=sale)', () => {
    it('매매 컬럼 헤더를 렌더링한다', () => {
      const wrapper = mount(TransactionTable, {
        props: { transactions: mockSaleTransactions, type: 'sale', loading: false },
      })
      expect(wrapper.text()).toContain('거래일')
      expect(wrapper.text()).toContain('건물명')
      expect(wrapper.text()).toContain('층')
      expect(wrapper.text()).toContain('전용면적')
      expect(wrapper.text()).toContain('거래금액')
    })

    it('매매 거래 데이터를 렌더링한다', () => {
      const wrapper = mount(TransactionTable, {
        props: { transactions: mockSaleTransactions, type: 'sale', loading: false },
      })
      expect(wrapper.text()).toContain('대치아이파크')
      expect(wrapper.text()).toContain('래미안대치팰리스')
    })

    it('1억 이상 금액을 "X억 Y만원"으로 포맷팅한다', () => {
      const wrapper = mount(TransactionTable, {
        props: { transactions: mockSaleTransactions, type: 'sale', loading: false },
      })
      // 150000만원 = 15억
      expect(wrapper.text()).toContain('15억')
    })

    it('1억 미만 금액을 "Y만원"으로 포맷팅한다', () => {
      const wrapper = mount(TransactionTable, {
        props: { transactions: mockSaleTransactions, type: 'sale', loading: false },
      })
      // 5000만원
      expect(wrapper.text()).toContain('5,000만원')
    })

    it('전월세 구분 컬럼을 표시하지 않는다', () => {
      const wrapper = mount(TransactionTable, {
        props: { transactions: mockSaleTransactions, type: 'sale', loading: false },
      })
      expect(wrapper.text()).not.toContain('전월세구분')
      expect(wrapper.text()).not.toContain('보증금')
      expect(wrapper.text()).not.toContain('월세')
    })
  })

  describe('전월세 테이블 (type=rent)', () => {
    it('전월세 컬럼 헤더를 렌더링한다', () => {
      const wrapper = mount(TransactionTable, {
        props: { transactions: mockRentTransactions, type: 'rent', loading: false },
      })
      expect(wrapper.text()).toContain('거래일')
      expect(wrapper.text()).toContain('건물명')
      expect(wrapper.text()).toContain('층')
      expect(wrapper.text()).toContain('전용면적')
      expect(wrapper.text()).toContain('보증금')
      expect(wrapper.text()).toContain('월세')
      expect(wrapper.text()).toContain('전월세구분')
    })

    it('전월세 거래 데이터를 렌더링한다', () => {
      const wrapper = mount(TransactionTable, {
        props: { transactions: mockRentTransactions, type: 'rent', loading: false },
      })
      expect(wrapper.text()).toContain('대치아이파크')
      expect(wrapper.text()).toContain('월세')
      expect(wrapper.text()).toContain('전세')
    })

    it('거래금액 컬럼을 표시하지 않는다', () => {
      const wrapper = mount(TransactionTable, {
        props: { transactions: mockRentTransactions, type: 'rent', loading: false },
      })
      expect(wrapper.text()).not.toContain('거래금액')
    })
  })

  describe('로딩 상태', () => {
    it('loading=true일 때 스켈레톤 UI를 표시한다', () => {
      const wrapper = mount(TransactionTable, {
        props: { transactions: [], type: 'sale', loading: true },
      })
      const skeletons = wrapper.findAll('[data-testid="skeleton-row"]')
      expect(skeletons.length).toBe(5)
    })

    it('loading=true일 때 실제 데이터를 표시하지 않는다', () => {
      const wrapper = mount(TransactionTable, {
        props: { transactions: mockSaleTransactions, type: 'sale', loading: true },
      })
      expect(wrapper.text()).not.toContain('대치아이파크')
    })
  })

  describe('빈 상태', () => {
    it('데이터가 없으면 "거래 내역이 없습니다" 메시지를 표시한다', () => {
      const wrapper = mount(TransactionTable, {
        props: { transactions: [], type: 'sale', loading: false },
      })
      expect(wrapper.text()).toContain('거래 내역이 없습니다')
    })
  })

  describe('취소 거래 (P0)', () => {
    it('cancelDealDay가 있으면 "취소" 배지를 표시한다', () => {
      const wrapper = mount(TransactionTable, {
        props: { transactions: [mockCancelledSale], type: 'sale', loading: false },
      })
      expect(wrapper.text()).toContain('취소')
    })

    it('cancelDealDay가 없으면 "취소" 배지를 표시하지 않는다', () => {
      const wrapper = mount(TransactionTable, {
        props: { transactions: mockSaleTransactions, type: 'sale', loading: false },
      })
      expect(wrapper.text()).not.toContain('취소')
    })

    it('취소된 거래 행에 opacity-50 클래스가 적용된다', () => {
      const wrapper = mount(TransactionTable, {
        props: { transactions: [mockCancelledSale], type: 'sale', loading: false },
      })
      expect(wrapper.html()).toContain('opacity-50')
    })
  })

  describe('계약유형 + 이전 가격 (P1)', () => {
    it('전월세 컬럼에 "계약유형" 헤더가 표시된다', () => {
      const wrapper = mount(TransactionTable, {
        props: { transactions: mockRentTransactions, type: 'rent', loading: false },
      })
      expect(wrapper.text()).toContain('계약유형')
    })

    it('contractType이 "갱신"이면 갱신 배지를 표시한다', () => {
      const wrapper = mount(TransactionTable, {
        props: { transactions: [mockRentTransactions[0]], type: 'rent', loading: false },
      })
      expect(wrapper.text()).toContain('갱신')
    })

    it('contractType이 "신규"이면 신규 배지를 표시한다', () => {
      const wrapper = mount(TransactionTable, {
        props: { transactions: [mockRentTransactions[1]], type: 'rent', loading: false },
      })
      expect(wrapper.text()).toContain('신규')
    })

    it('이전 보증금 대비 변화율을 표시한다', () => {
      // 4500 → 5000 = +11.1%
      const wrapper = mount(TransactionTable, {
        props: { transactions: [mockRentTransactions[0]], type: 'rent', loading: false },
      })
      expect(wrapper.text()).toContain('↑11.1%')
    })

    it('이전 월세 대비 변화율을 표시한다', () => {
      // 180 → 200 = +11.1%
      const wrapper = mount(TransactionTable, {
        props: { transactions: [mockRentTransactions[0]], type: 'rent', loading: false },
      })
      expect(wrapper.text()).toContain('↑11.1%')
    })

    it('이전 가격이 없으면 변화율을 표시하지 않는다', () => {
      const wrapper = mount(TransactionTable, {
        props: { transactions: [mockRentTransactions[1]], type: 'rent', loading: false },
      })
      // 신규 계약에는 preDeposit이 null이므로 변화율 없음
      expect(wrapper.text()).not.toContain('↑')
      expect(wrapper.text()).not.toContain('↓')
    })
  })

  describe('매수/매도자 유형 (P2)', () => {
    it('매매 컬럼에 "매수/매도" 헤더가 표시된다', () => {
      const wrapper = mount(TransactionTable, {
        props: { transactions: mockSaleTransactions, type: 'sale', loading: false },
      })
      expect(wrapper.text()).toContain('매수/매도')
    })

    it('buyerType/sellerType이 있으면 표시한다', () => {
      const wrapper = mount(TransactionTable, {
        props: { transactions: [mockSaleTransactions[0]], type: 'sale', loading: false },
      })
      expect(wrapper.text()).toContain('개인')
      expect(wrapper.text()).toContain('법인')
    })

    it('buyerType/sellerType이 없으면 "-"를 표시한다', () => {
      const wrapper = mount(TransactionTable, {
        props: { transactions: [mockSaleTransactions[1]], type: 'sale', loading: false },
      })
      // 두 번째 mock에는 buyerType/sellerType이 null
      const partyCell = wrapper.findAll('td').pop()
      expect(partyCell?.text()).toBe('-')
    })
  })

  describe('반응형', () => {
    it('테이블 컨테이너에 overflow-x-auto 클래스가 있다', () => {
      const wrapper = mount(TransactionTable, {
        props: { transactions: mockSaleTransactions, type: 'sale', loading: false },
      })
      expect(wrapper.html()).toContain('overflow-x-auto')
    })
  })
})
