import type { SaleTransaction } from '~/types/realEstate'
import type { DetailOverview, DetailSnapshot } from '~/types/housingRedesign'

export const twoDealPoints = [
  { id: 1, date: '2026-09-12', amount: 80000, area: '84.90', floor: 3, deposit: null },
  { id: 2, date: '2026-09-12', amount: 81000, area: '84.90', floor: 5, deposit: null },
]

export const saleFilters = {
  bjdCode: '11680',
  buildingName: '일상숲 리버파크',
  mode: 'sale' as const,
  months: 6 as const,
  area: '84.90',
  deposit: null,
}

export const saleRows: SaleTransaction[] = Array.from({ length: 21 }, (_, i) => ({
  id: 21 - i,
  city: '서울특별시',
  district: '강남구',
  bjdCode: '11680',
  dongName: '역삼동',
  buildingName: '일상숲 리버파크',
  buildYear: 2018,
  floor: i,
  exclusiveArea: 84.9,
  jibun: '123',
  roadName: null,
  lat: null,
  lng: null,
  dealYear: 2026,
  dealMonth: 9,
  dealDay: 12,
  dealAmount: 80000 + i,
  dealType: null,
  cancelDealDay: null,
  cancelDealType: null,
  buyerType: null,
  sellerType: null,
}))

export const saleSnapshot: DetailSnapshot<SaleTransaction> = {
  filters: saleFilters,
  window: { from: '2026-03-21', to: '2026-09-21' },
  options: { areas: ['84.90'], deposits: [] },
  points: saleRows.map(row => ({
    id: row.id,
    date: '2026-09-12',
    amount: row.dealAmount,
    area: '84.90',
    floor: row.floor,
    deposit: null,
  })),
  table: { items: saleRows.slice(0, 20), total: 21, page: 1, totalPages: 2 },
  generatedAt: '2026-09-21T03:00:00Z',
  adjustment: null,
}

export const saleOverview: DetailOverview = {
  identity: { bjdCode: '11680', buildingName: '일상숲 리버파크' },
  latestSale: { id: 21, amount: 80000, year: 2026, month: 9, day: 12, area: '84.90', floor: 0 },
  buildYear: 2018,
  minArea: '84.90',
  maxArea: '84.90',
  saleCount6m: 21,
  window6m: saleSnapshot.window,
  addresses: [{ dongName: '역삼동', jibun: '123', roadName: null }],
  location: null,
  locationAmbiguous: false,
  generatedAt: saleSnapshot.generatedAt,
}
