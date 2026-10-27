/**
 * 부동산 지도 단지 단계 면적·가격 필터.
 *
 * 구간 id 는 백엔드 schemas/realEstateMap.ts(AREA_BUCKETS·PRICE_BUCKETS)와 글자까지 같아야 한다 —
 * 다르면 API 가 422 를 낸다. 의미는 "하한 초과 ~ 상한 이하"(만원·㎡), 하한 0 은 하한 없음,
 * 상한이 비면 상한 없음이다.
 */

export type RentPriceKind = 'jeonse' | 'wolse'

export interface MapFilterState {
  /** 전용면적 구간 id. null = 전체 */
  area: string | null
  /** 가격 구간 id. null = 전체 */
  price: string | null
  /** 전월세 지도에서 price 가 전세 보증금인지 월세액인지. 매매·가격 없음이면 null */
  priceKind: RentPriceKind | null
}

export const EMPTY_MAP_FILTER: MapFilterState = Object.freeze({ area: null, price: null, priceKind: null })

interface Bucket { id: string; label: string }

export const AREA_OPTIONS: readonly Bucket[] = [
  { id: '0-60', label: '60㎡ 이하' },
  { id: '60-85', label: '60~85㎡' },
  { id: '85-135', label: '85~135㎡' },
  { id: '135-', label: '135㎡ 초과' },
]

export const SALE_PRICE_OPTIONS: readonly Bucket[] = [
  { id: '0-30000', label: '3억 이하' },
  { id: '30000-60000', label: '3~6억' },
  { id: '60000-90000', label: '6~9억' },
  { id: '90000-150000', label: '9~15억' },
  { id: '150000-250000', label: '15~25억' },
  { id: '250000-', label: '25억 초과' },
]

export const JEONSE_PRICE_OPTIONS: readonly Bucket[] = [
  { id: '0-10000', label: '1억 이하' },
  { id: '10000-30000', label: '1~3억' },
  { id: '30000-50000', label: '3~5억' },
  { id: '50000-80000', label: '5~8억' },
  { id: '80000-', label: '8억 초과' },
]

export const WOLSE_PRICE_OPTIONS: readonly Bucket[] = [
  { id: '0-50', label: '50만 이하' },
  { id: '50-100', label: '50~100만' },
  { id: '100-', label: '100만 초과' },
]

function isRentType(type: string): boolean {
  return type.endsWith('-rent')
}

function priceOptionsFor(type: string, kind: RentPriceKind | null): readonly Bucket[] | null {
  if (!isRentType(type)) return SALE_PRICE_OPTIONS
  if (kind === 'jeonse') return JEONSE_PRICE_OPTIONS
  if (kind === 'wolse') return WOLSE_PRICE_OPTIONS
  return null
}

/**
 * 유형에 맞지 않는 값을 버린다. 유형을 바꿀 때(매매↔전월세)·해시/저장값을 읽을 때 쓴다.
 * 면적은 모든 유형에 공통이라 유지하고, 가격은 그 유형의 구간이 아니면 버린다.
 */
export function sanitizeMapFilter(type: string, f: Partial<MapFilterState> | null | undefined): MapFilterState {
  const area = f?.area && AREA_OPTIONS.some((o) => o.id === f.area) ? f.area : null
  const kind = isRentType(type) && (f?.priceKind === 'jeonse' || f?.priceKind === 'wolse') ? f.priceKind : null
  const options = priceOptionsFor(type, kind)
  const price = f?.price && options?.some((o) => o.id === f.price) ? f.price : null
  return { area, price, priceKind: price ? kind : null }
}

export function isMapFilterActive(f: MapFilterState): boolean {
  return f.area != null || f.price != null
}

/** API 쿼리 파라미터. 필터가 없으면 빈 객체 — 필터 없는 요청은 예전 URL 과 같아야 한다. */
export function mapFilterParams(f: MapFilterState): Record<string, string> {
  const out: Record<string, string> = {}
  if (f.area) out.area = f.area
  if (f.price) {
    out.price = f.price
    if (f.priceKind) out.priceKind = f.priceKind
  }
  return out
}

export function areaLabel(id: string | null): string | null {
  return AREA_OPTIONS.find((o) => o.id === id)?.label ?? null
}

/** 가격 칩 문구. 전월세는 "전세 3~5억" / "월세 50만 이하" 처럼 종류를 붙인다. */
export function priceLabel(type: string, f: MapFilterState): string | null {
  if (!f.price) return null
  const label = priceOptionsFor(type, f.priceKind)?.find((o) => o.id === f.price)?.label
  if (!label) return null
  if (!isRentType(type)) return label
  return `${f.priceKind === 'wolse' ? '월세' : '전세'} ${label}`
}

/** 가격 메뉴 묶음. 매매는 한 묶음, 전월세는 전세 보증금·월세액 두 묶음. */
export function priceMenuGroups(type: string): Array<{ kind: RentPriceKind | null; title: string | null; options: readonly Bucket[] }> {
  if (!isRentType(type)) return [{ kind: null, title: null, options: SALE_PRICE_OPTIONS }]
  return [
    { kind: 'jeonse', title: '전세 보증금', options: JEONSE_PRICE_OPTIONS },
    { kind: 'wolse', title: '월세액', options: WOLSE_PRICE_OPTIONS },
  ]
}
