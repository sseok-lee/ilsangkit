import { shallowRef } from 'vue'
import { isBuildingItem, type MapBuildingItem, type MapItem, type MapRegionItem } from '~/types/realEstateMap'
import type { DealSnapshot } from '~/types/realEstateExploration'
import { toRealEstateUrl, type RealEstateUrlType } from '~/utils/realEstateUrl'
import { itemKey } from '~/composables/useRealEstateMap'
import { SIDO_CHIPS } from '~/utils/regionChips'
import { CITY_SLUG_MAP } from '~/shared/regionSlugs'

const DEALS_UNAVAILABLE_MESSAGE = '거래 정보를 불러오지 못했습니다'
const NO_DEAL_MESSAGE = '거래 없음'

/**
 * 만원 단위 금액을 "16억 8,340만" / "8,500만" / "3억" 형태로 만든다.
 *
 * 만원 자리가 보일 때만 '만' 을 붙인다 — 억 단위로 딱 떨어지면(rest=0) '3억' 이지
 * '3억 0만' 이 아니다. 단위 없이 "8,500" 만 두면 8,500원인지 8,500만원인지 읽는 사람이
 * 알 수 없다.
 */
function formatManwon(manwon: number): string {
  const eok = Math.floor(manwon / 10000)
  const rest = manwon % 10000
  if (eok === 0) return `${rest.toLocaleString('ko-KR')}만`
  if (rest === 0) return `${eok}억`
  return `${eok}억 ${rest.toLocaleString('ko-KR')}만`
}

function isRentBundle(bundle: NonNullable<MapBuildingItem['latestDeals']>, type: string): boolean {
  return type.endsWith('-rent') || (!type && bundle.sale == null && (bundle.jeonse != null || bundle.wolse != null))
}

/**
 * 마커가 보여주는 그 거래. 매매는 sale, 전월세는 전세·월세 중 더 최근 것이다.
 * 라벨 문자열(formatPriceLabel)과 "1년 넘은 거래" 판정(buildingMarkerTone)이 같은 거래를
 * 봐야 하므로 선택 규칙을 여기 한 곳에 둔다.
 */
function shownDeal(item: MapBuildingItem, type: string): DealSnapshot | null {
  const bundle = item.latestDeals
  if (!bundle) return null
  return isRentBundle(bundle, type) ? latestRentDeal(bundle.jeonse, bundle.wolse) : bundle.sale
}

/**
 * 건물 마커 라벨. 여섯 지도 유형은 latestDeals bundle 만 신뢰한다.
 * bundle 자체가 없으면 로드 실패, bundle 안의 null 슬롯은 확인된 거래 없음이다.
 */
export function formatPriceLabel(item: MapBuildingItem, type = ''): string {
  const bundle = item.latestDeals
  if (!bundle) return DEALS_UNAVAILABLE_MESSAGE

  if (!isRentBundle(bundle, type)) {
    return bundle.sale?.amount == null ? NO_DEAL_MESSAGE : formatManwon(bundle.sale.amount)
  }

  const deal = latestRentDeal(bundle.jeonse, bundle.wolse)
  if (!deal) return NO_DEAL_MESSAGE
  if (deal.kind === 'jeonse') {
    return deal.deposit == null ? NO_DEAL_MESSAGE : `전세 ${formatManwon(deal.deposit)}`
  }
  if (deal.deposit == null || deal.monthlyRent == null) return NO_DEAL_MESSAGE
  return `보 ${formatManwon(deal.deposit)}/월 ${deal.monthlyRent.toLocaleString('ko-KR')}만`
}

/**
 * 계약일이 오늘로부터 1년을 넘었는지.
 *
 * 일(dealDay)이 없는 거래는 그 달 말일로 본다 — 모르는 날짜를 오래된 쪽으로 몰면 실제로는
 * 1년 안쪽인 거래가 회색으로 깎인다. 경계일(정확히 1년 전 같은 날)은 아직 1년 안쪽이다.
 */
export function isDealOlderThanYear(deal: DealSnapshot, now: Date = new Date()): boolean {
  const cutoff = (now.getFullYear() - 1) * 10000 + (now.getMonth() + 1) * 100 + now.getDate()
  return deal.dealYear * 10000 + deal.dealMonth * 100 + (deal.dealDay ?? 31) < cutoff
}

/**
 * 단지 핀의 색 구분. recent = 최근 1년 거래(primary), muted = 1년 넘은 거래·거래 없음·
 * 로드 실패(회색). 로드 실패도 회색인 이유: 값이 없는 핀이 최신 거래와 같은 색이면 "최근에
 * 거래된 단지"로 읽힌다. 문구(거래 정보를 불러오지 못했습니다)는 그대로라 원인은 구분된다.
 */
export function buildingMarkerTone(item: MapBuildingItem, type = '', now: Date = new Date()): 'recent' | 'muted' {
  const label = formatPriceLabel(item, type)
  if (label === NO_DEAL_MESSAGE || label === DEALS_UNAVAILABLE_MESSAGE) return 'muted'
  const deal = shownDeal(item, type)
  return deal && !isDealOlderThanYear(deal, now) ? 'recent' : 'muted'
}

function dealDateKey(deal: DealSnapshot): number {
  return deal.dealYear * 10000 + deal.dealMonth * 100 + (deal.dealDay ?? 0)
}

function latestRentDeal(jeonse: DealSnapshot | null, wolse: DealSnapshot | null): DealSnapshot | null {
  if (!jeonse) return wolse
  if (!wolse) return jeonse
  return dealDateKey(wolse) > dealDateKey(jeonse) ? wolse : jeonse
}

/**
 * 전세 라벨. 값이 없으면 null 을 준다 — 호출부가 "거래 없음" 을 그릴지 줄을 뺄지 정한다.
 *
 * formatPriceLabel 과 달리 접두어("전세")를 붙이지 않는다. 목록과 펼침 카드가 라벨을
 * 별도 요소로 그리기 때문이다 — 문자열에 넣으면 스타일을 나눠 줄 수 없다.
 */
export function formatJeonseLabel(item: MapBuildingItem): string | null {
  const deposit = item.latestDeals?.jeonse?.deposit
  return deposit == null ? null : formatManwon(deposit)
}

/**
 * 월세 라벨 — "보증금 · 월세액".
 *
 * 둘 중 하나라도 없으면 null 이다. 보증금만 그리면 전세로 읽히고, 월세액만 그리면
 * 보증금이 0인지 미상인지 알 수 없다. 0 은 유효한 값이라 `== null` 로만 판정한다.
 */
export function formatWolseLabel(item: MapBuildingItem): string | null {
  const deal = item.latestDeals?.wolse
  if (deal?.deposit == null || deal.monthlyRent == null) return null
  return `${formatManwon(deal.deposit)} · ${deal.monthlyRent.toLocaleString('ko-KR')}만`
}

/**
 * 전세/월세 표시 값. bundle 존재 여부를 null 슬롯과 분리해 호출부가 오류와 거래 없음을
 * 서로 다른 상태로 표시할 수 있게 한다.
 */
export function getRentDisplay(item: MapBuildingItem): { jeonse: string | null; wolse: string | null; unavailable: boolean } {
  if (!item.latestDeals) return { jeonse: null, wolse: null, unavailable: true }
  return {
    jeonse: formatJeonseLabel(item),
    wolse: formatWolseLabel(item),
    unavailable: false,
  }
}

/** 지역 버블 라벨. 단위를 명시해 줌 전환 시 의미가 바뀌는 걸 알린다. */
export function formatPyeongLabel(item: MapRegionItem): string {
  if (item.avgPricePerPyeong == null) return '—'
  return `${formatManwon(item.avgPricePerPyeong)}/평`
}

/**
 * 시·도 표시 이름. API 의 name 은 DB city 원값이라 대부분 축약형('서울')이지만 통합시는
 * 풀네임('전남광주통합특별시')이다 — 지도 핀에 그대로 쓰면 다른 핀보다 세 배 길어진다.
 * 목록(MapSidebar)이 쓰는 SIDO_CHIPS 라벨('전남·광주')과 맞춘다.
 */
export function cityDisplayName(name: string): string {
  const chip = SIDO_CHIPS.find((c) => c.label === name || CITY_SLUG_MAP[c.slug] === name)
  return chip?.label ?? name
}

/** 지역 핀의 이름. 동 단계는 동, 구·군 단계는 구·군, 시·도 단계는 시·도 이름이다. */
export function regionDisplayName(item: MapRegionItem): string {
  return item.dong ?? item.district ?? cityDisplayName(item.name)
}

/** 지역 핀 전체 문구 — "서울 5,117만/평". 값이 없어도 이름은 남긴다("제주 —"). */
export function formatRegionLabel(item: MapRegionItem): string {
  return `${regionDisplayName(item)} ${formatPyeongLabel(item)}`
}

/**
 * 겹칠 때 자리를 먼저 차지하는 순서. 선택된 단지 > 거래 수 많은 순, 같으면 원래 순서.
 *
 * 지역 항목은 서버가 뷰포트 중심에서 가까운 순으로 준다(sortRegionsByDistance). 그 순서를
 * 그대로 우선순위로 쓰면 중심이 경기 쪽일 때 서울·인천이 경기 핀에 가려졌다(운영 실측:
 * 시·도 16곳 중 11곳만 보임). 거래가 많은 지역일수록 찾는 사람이 많으므로 거래 수로 정한다.
 */
export function overlayPriority(items: MapItem[], selectedKey: string | null = null): MapItem[] {
  const isSelected = (i: MapItem) => selectedKey != null && isBuildingItem(i) && itemKey(i) === selectedKey
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const sel = Number(isSelected(b.item)) - Number(isSelected(a.item))
      if (sel !== 0) return sel
      const count = (b.item.transactionCount ?? 0) - (a.item.transactionCount ?? 0)
      return count !== 0 ? count : a.index - b.index
    })
    .map((x) => x.item)
}

interface Box { x1: number; y1: number; x2: number; y2: number }

/**
 * 글자 폭 근사(px) — 겹침 판정용. 로컬 Chrome 실측(2026-10-27)으로 맞춘 비율이다:
 * 한글 ≈ 글자 크기 × 0.88, 숫자·기호·영문 ≈ × 0.55. 예) 지역 핀 "경기 2,403만/평" 실측 113px,
 * 추정 115px. 크게 잡으면 들어갈 자리가 있는 핀까지 점으로 접힌다.
 */
function textPx(text: string, fontPx: number): number {
  let w = 0
  for (const ch of text) w += fontPx * (ch.charCodeAt(0) < 0x2000 ? 0.55 : 0.88)
  return w
}

/** 단지명 말줄임 폭. main.css .map-price-label 의 max-width(좌우 패딩 제외)와 맞춘다. */
const BUILDING_NAME_MAX_PX = 120
/** 단지 핀: 좌우 패딩 + 테두리 / 두 줄 높이 + 위아래 패딩 + 꼬리. main.css 와 맞춘다. */
const BUILDING_PAD_PX = 18
const BUILDING_H_PX = 45
/** 선택 카드(펼침): 단지명·값 1~2줄·상세 링크. */
const POPUP_W_PX = 150
const POPUP_H_PX = 100
/** 지역 핀: 좌우 패딩 + 이름·값 사이 간격 + 테두리 / 한 줄 + 꼬리. */
const REGION_PAD_PX = 28
const REGION_H_PX = 34
/** 상자 사이 최소 간격. 붙어 있으면 읽기 어려워 약간 띄운다. */
const GAP_PX = 3

function buildingBoxSize(name: string, price: string, selected: boolean): { w: number; h: number } {
  const w = Math.max(Math.min(textPx(name, 10.5), BUILDING_NAME_MAX_PX), textPx(price, 12.5)) + BUILDING_PAD_PX
  return selected ? { w: Math.max(w, POPUP_W_PX), h: POPUP_H_PX } : { w, h: BUILDING_H_PX }
}

function regionBoxSize(name: string, price: string): { w: number; h: number } {
  return { w: textPx(name, 12) + textPx(price, 13) + REGION_PAD_PX, h: REGION_H_PX }
}

/**
 * 핀을 좌표의 어느 쪽에 놓을지. x = CustomOverlay xAnchor(꼬리의 가로 위치와 같다),
 * below = 좌표 아래에 놓고 꼬리를 위로(yAnchor 0). 기본은 좌표 바로 위 가운데다.
 */
interface Placement { x: number; below: boolean }
const DEFAULT_PLACEMENT: Placement = { x: 0.5, below: false }

/**
 * 지역 핀이 기본 자리에서 겹칠 때 차례로 시도하는 자리. 시·도 단계는 서울·경기·인천의
 * 중심 좌표가 서로 20~30km(화면 20px 안팎) 안에 붙어 있어 기본 자리 하나로는 셋 중 둘이
 * 반드시 접힌다. 지역 핀은 개수가 적어(시·도 16, 구·군 수십) 비껴 놓아도 지도가 어지럽지 않다.
 * 단지 핀은 수백 개라 비껴 놓으면 어느 핀이 어느 건물인지 흐려지므로 기본 자리만 쓴다.
 */
const REGION_PLACEMENTS: Placement[] = [
  DEFAULT_PLACEMENT,
  { x: 0.5, below: true },
  { x: 0.15, below: false },
  { x: 0.85, below: false },
  { x: 0.15, below: true },
  { x: 0.85, below: true },
]

/**
 * 시·도 핀을 찍을 자리를 바꾸는 표. 경기는 서울을 둘러싸고 있어 구·군 평균 좌표(서버 값,
 * 로컬 실측 37.43, 127.03)가 서울(37.55, 126.99) 바로 아래 — 화면 17px — 에 찍힌다. 그러면
 * 서울 좌표가 경기 말풍선 안에 들어가 서울은 어느 자리로도 비껴 갈 수 없다(거래는 경기가
 * 서울의 약 3.7배라 경기가 먼저 자리를 잡는다). 경기 핀만 경기 남동부(용인·이천 사이) 안쪽으로
 * 옮긴다. 핀 위치만 바꾸고, 핀을 눌렀을 때 이동하는 좌표(item.lat/lng)는 그대로다.
 */
const CITY_PIN_ANCHORS: Record<string, { lat: number; lng: number }> = {
  경기: { lat: 37.2, lng: 127.4 },
}

/** 핀을 찍을 좌표. 시·도 항목만 CITY_PIN_ANCHORS 로 바뀐다. */
function pinPosition(item: MapItem): { lat: number; lng: number } | null {
  if (item.lat == null || item.lng == null) return null
  if (!isBuildingItem(item) && item.district == null && item.dong == null) {
    const anchor = CITY_PIN_ANCHORS[cityDisplayName(item.name)]
    if (anchor) return anchor
  }
  return { lat: item.lat, lng: item.lng }
}

/**
 * 좌표의 화면 위치. projection 이 없거나(테스트 fake) 변환이 실패하면 null → 호출부가
 * 겹침 판정을 건너뛴다.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function pointAt(projection: any, kakao: any, lat: number, lng: number): { x: number; y: number } | null {
  try {
    const pt = projection.containerPointFromCoords(new kakao.maps.LatLng(lat, lng))
    if (!pt || !Number.isFinite(pt.x) || !Number.isFinite(pt.y)) return null
    return pt
  } catch {
    return null
  }
}

/**
 * 라벨이 차지할 화면 영역. 기본(위) 자리는 좌표 위쪽, below 자리는 아래쪽으로 잡는다.
 * 꼬리 끝(좌표) 쪽에는 간격을 두지 않는다 — 같은 좌표의 위·아래 핀은 꼬리 끝이 맞닿을 뿐
 * 말풍선끼리는 떨어져 있다. 거기에도 간격을 두면 위·아래 자리가 서로 겹친다고 판정된다.
 */
function boxAt(pt: { x: number; y: number }, size: { w: number; h: number }, place: Placement): Box {
  const x1 = pt.x - size.w * place.x
  return place.below
    ? { x1: x1 - GAP_PX, y1: pt.y, x2: x1 + size.w + GAP_PX, y2: pt.y + size.h + GAP_PX }
    : { x1: x1 - GAP_PX, y1: pt.y - size.h - GAP_PX, x2: x1 + size.w + GAP_PX, y2: pt.y }
}

function intersects(a: Box, b: Box): boolean {
  return a.x1 < b.x2 && b.x1 < a.x2 && a.y1 < b.y2 && b.y1 < a.y2
}

interface OverlayHandlers {
  onClick?: (item: MapItem) => void
  onHover?: (item: MapItem | null) => void
}

/**
 * 선택된 마커의 펼침 카드. 건물명 + 값 + 상세 링크.
 *
 * 지도 마커 클릭은 지금까지 사실상 아무 일도 하지 않았다 — onSelect 는 지역 단계에서만
 * setLevel 로 파고들고 building 분기가 없어서 지도가 그 건물로 가운데 정렬되는 게 전부였다.
 *
 * 링크는 SSR HTML 에 실리지 않는다(이 렌더러 자체가 클라이언트 전용이다). 크롤러용이 아니라
 * 사용자 동선용이며, 내부 링크 역할은 사이드바 행이 계속 담당한다.
 */
function buildPopup(item: MapBuildingItem, type: string, isRent: boolean): HTMLElement {
  const el = document.createElement('div')
  el.className = 'map-popup'

  const name = document.createElement('b')
  name.textContent = item.buildingName
  el.appendChild(name)

  /**
   * `secondary` 와 `absent` 는 다른 축이다. 전세는 주값(강조), 월세는 보조값이라는 게
   * secondary 이고, 거래 자체가 없는 건 absent 다. 하나로 합치면 "월세 거래 없음"과
   * 실제 월세 금액이 같은 회색으로 나와 없는 값이 값처럼 읽힌다.
   */
  const addLine = (label: string, value: string, opts: { secondary: boolean; absent: boolean }): void => {
    const line = document.createElement('span')
    line.className = ['map-popup-line',
      opts.secondary ? 'map-popup-line--sub' : '',
      opts.absent ? 'map-popup-line--absent' : ''].filter(Boolean).join(' ')
    const tag = document.createElement('i')
    tag.textContent = label
    line.appendChild(tag)
    line.appendChild(document.createTextNode(value))
    el.appendChild(line)
  }

  if (isRent) {
    const { jeonse, wolse, unavailable } = getRentDisplay(item)
    if (unavailable) {
      addLine('', DEALS_UNAVAILABLE_MESSAGE, { secondary: false, absent: true })
    } else {
      addLine('전세', jeonse ?? NO_DEAL_MESSAGE, { secondary: false, absent: jeonse == null })
      addLine('월세', wolse ?? NO_DEAL_MESSAGE, { secondary: true, absent: wolse == null })
    }
  } else {
    const value = formatPriceLabel(item, type)
    const absent = value === NO_DEAL_MESSAGE || value === DEALS_UNAVAILABLE_MESSAGE
    addLine('매매', value, { secondary: false, absent })
  }

  const link = document.createElement('a')
  link.className = 'map-popup-link'
  link.textContent = '상세 보기 →'
  // 슬러그 변환·NFC 정규화·encodeURIComponent 가 전부 이 유틸에 있다. 직접 조립하지 않는다.
  link.href = toRealEstateUrl({
    type: type as RealEstateUrlType,
    city: item.city,
    district: item.district,
    buildingName: item.buildingName,
    buildingKey: item.buildingKey,
    canonicalPath: item.canonicalPath,
  })
  el.appendChild(link)

  return el
}

/**
 * 가격 라벨·지역 버블 오버레이를 그린다.
 *
 * useKakaoMap 을 확장하지 않고 별도로 두는 이유: useKakaoMap 의 addMarkers 는
 * FacilitySearchItem 전용이고, 시설 상세·건물 상세·공매·청약·지하철 5개 페이지가
 * 이미 쓰고 있다. 확장하면 그 5개가 전부 회귀 표면이 된다.
 */
export function useMapOverlays() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const overlays = shallowRef<any[]>([])

  function clearOverlays(): void {
    for (const o of overlays.value) o.setMap(null)
    overlays.value = []
  }

  function renderOverlays(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    map: any,
    items: MapItem[],
    handlers: OverlayHandlers = {},
    opts: { type?: string; selectedKey?: string | null; now?: Date } = {},
  ): void {
    // import.meta.server 극성 사용(useKakaoMap.ts:124 컨벤션과 동일): 실제 Nuxt 빌드에서는
    // server/client 가 항상 서로 반대이므로 프로덕션 동작은 !client 와 완전히 동일하다.
    // 차이는 두 플래그가 모두 undefined 인 vitest 환경뿐 — 그때 이 극성이라야 렌더러가 실행되어 테스트 가능해진다.
    if (import.meta.server || !map) return
    clearOverlays()

    // 선택된 항목을 맨 뒤로 옮긴다. Kakao CustomOverlay 는 항목마다 절대위치 wrapper
    // <div> 를 생성 순서대로 append 하는데, 그 wrapper 들이 전부 z-index:0 이라
    // 각자 독립된 스태킹 컨텍스트가 된다 — .map-popup(z-index:4) vs .map-price-label
    // (z-index:1) 규칙은 서로 경쟁할 대상이 없고, DOM 형제 순서만으로 페인트 순서가
    // 정해진다. 그래서 펼침 카드(.map-popup)가 먼저 그려지면 나중에 그려지는 이웃
    // 라벨이 그 위를 덮어 클릭을 가로챈다(실측: 상세 보기 링크 클릭이 이웃
    // map-price-label 에 막혀 6회 연속 실패). 선택된 항목을 배열 맨 뒤에 둬 wrapper 를
    // 마지막 형제로 만들면 항상 위에 그려져 클릭이 통과한다.
    // 겹침 판정 순서(overlayPriority)는 그리는 순서와 별개다 — 아래에서 따로 계산한다.
    const selectedKey = opts.selectedKey ?? null
    const isSelected = (i: MapItem) => selectedKey != null && isBuildingItem(i) && itemKey(i) === selectedKey
    const ordered = selectedKey == null
      ? items
      : [...items.filter((i) => !isSelected(i)), ...items.filter(isSelected)]
    const type = opts.type ?? ''
    const isRent = type.endsWith('-rent')
    const now = opts.now ?? new Date()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const kakao = (window as any).kakao
    if (!kakao?.maps) return

    const labelOf = (item: MapItem): { name: string; price: string } => isBuildingItem(item)
      ? { name: item.buildingName, price: formatPriceLabel(item, type) }
      : { name: regionDisplayName(item), price: formatPyeongLabel(item) }

    // 밀집 지역에서 라벨이 서로 덮으면 아무것도 못 읽는다. 우선순위(선택 > 거래 수) 순으로
    // 자리를 잡고, 앞선 라벨과 겹치면 라벨 대신 점을 찍는다. 선택된 단지는 카드가 커서
    // 가장 먼저 자리를 잡는다 — 이웃 라벨이 카드 밑에 깔려 클릭을 가로채지 않게.
    //
    // 건너뛰지 않고 점이라도 남기는 이유: 좌측 목록은 items 전부를 보여주므로, 겹친다고
    // 아예 지우면 "목록엔 있는데 지도엔 없는" 건물이 생긴다(실측 강남 level 4: 목록 114 vs
    // 라벨 76 → 38개 실종). 점은 자리를 차지하지 않으면서 위치와 클릭 대상을 유지한다.
    //
    // projection 이 없으면(테스트 fake 등) 겹침 판정 없이 전부 그린다.
    const projection = typeof map.getProjection === 'function' ? map.getProjection() : null
    const collapsed = new Set<MapItem>()
    const placements = new Map<MapItem, Placement>()
    if (projection) {
      const placed: Box[] = []
      for (const item of overlayPriority(items, selectedKey)) {
        const pos = pinPosition(item)
        if (!pos) continue
        const pt = pointAt(projection, kakao, pos.lat, pos.lng)
        if (!pt) continue
        const { name, price } = labelOf(item)
        const selected = isSelected(item)
        const building = isBuildingItem(item)
        const size = building ? buildingBoxSize(name, price, selected) : regionBoxSize(name, price)
        if (selected) {
          placed.push(boxAt(pt, size, DEFAULT_PLACEMENT))
          continue
        }
        const candidates = building ? [DEFAULT_PLACEMENT] : REGION_PLACEMENTS
        const fit = candidates.find((place) => {
          const box = boxAt(pt, size, place)
          return !placed.some((p) => intersects(p, box))
        })
        if (!fit) {
          collapsed.add(item)
          continue
        }
        placed.push(boxAt(pt, size, fit))
        if (fit !== DEFAULT_PLACEMENT) placements.set(item, fit)
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const next: any[] = []
    for (const item of ordered) {
      const pos = pinPosition(item)
      if (!pos) continue
      const building = isBuildingItem(item)
      const { name, price } = labelOf(item)
      const muted = building && buildingMarkerTone(item, type, now) === 'muted'

      let el: HTMLElement
      if (isSelected(item)) {
        el = buildPopup(item as MapBuildingItem, type, isRent)
      } else if (collapsed.has(item)) {
        el = document.createElement('div')
        el.className = muted ? 'map-price-dot map-price-dot--muted' : 'map-price-dot'
        // 점에도 값을 남긴다 — 호버 시 툴팁으로 뜨고, 스크린리더도 읽는다.
        el.title = `${name} ${price}`
      } else {
        // 단지명·지역명은 반드시 textContent 로 넣는다(innerHTML 금지) — 공공데이터 원문이라
        // 꺾쇠 등이 섞여 들어와도 마크업으로 해석되지 않는다.
        el = document.createElement('div')
        el.className = building
          ? (muted ? 'map-price-label map-price-label--muted' : 'map-price-label')
          : 'map-region-bubble'
        const place = placements.get(item)
        if (place) {
          // 비껴 놓은 자리: 꼬리를 좌표 쪽(아래 자리면 위)으로, 가로 위치는 xAnchor 와 같게.
          if (place.below) el.classList.add('map-region-bubble--below')
          el.style.setProperty('--tail-x', `${place.x * 100}%`)
        }
        const nameEl = document.createElement('span')
        nameEl.className = building ? 'map-price-label-name' : 'map-region-bubble-name'
        nameEl.textContent = name
        const priceEl = document.createElement('span')
        priceEl.className = building ? 'map-price-label-price' : 'map-region-bubble-price'
        priceEl.textContent = price
        el.append(nameEl, priceEl)
        // 말줄임된 긴 단지명은 호버 툴팁으로 전체를 보여준다.
        if (building) el.title = `${name} ${price}`
      }

      if (handlers.onClick) {
        el.addEventListener('click', (ev) => {
          // 펼침 카드의 상세 링크는 이동이 목적이다 — 토글까지 돌면 이동 직전에 카드가 접힌다.
          if ((ev.target as HTMLElement).closest('a')) return
          handlers.onClick!(item)
        })
      }
      if (handlers.onHover) {
        el.addEventListener('mouseenter', () => handlers.onHover!(item))
        el.addEventListener('mouseleave', () => handlers.onHover!(null))
      }

      const place = collapsed.has(item) ? undefined : placements.get(item)
      const overlay = new kakao.maps.CustomOverlay({
        position: new kakao.maps.LatLng(pos.lat, pos.lng),
        content: el,
        ...(place ? { xAnchor: place.x, yAnchor: place.below ? 0 : 1 } : { yAnchor: 1 }),
        clickable: true,
      })
      overlay.setMap(map)
      next.push(overlay)
    }
    overlays.value = next
  }

  return { renderOverlays, clearOverlays }
}
