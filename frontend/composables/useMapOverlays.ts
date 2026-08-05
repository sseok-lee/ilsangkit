import { shallowRef } from 'vue'
import { isBuildingItem, type MapBuildingItem, type MapItem, type MapRegionItem } from '~/types/realEstateMap'

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

/**
 * 건물 마커 라벨.
 * monthlyRent 판별식: null=매매 / 0=전세 / >0=월세. IS NULL 을 전세로 쓰지 않는다 —
 * 전월세 타입에서 null 은 summary 미갱신을 뜻한다.
 */
export function formatPriceLabel(item: MapBuildingItem): string {
  if (item.latestPrice == null) return '—'
  const price = formatManwon(item.latestPrice)
  if (item.monthlyRent == null) return price
  if (item.monthlyRent === 0) return `전세 ${price}`
  // 두 숫자에 각각 무엇인지 라벨을 붙인다. 예전엔 `월 1억·80` 처럼 가운데점으로만
  // 갈랐는데, 앞이 보증금이고 뒤가 월세라는 걸 알아야 읽혔다. 월세액도 보증금과 같은
  // 만원 단위다.
  return `보 ${price}/월 ${item.monthlyRent.toLocaleString('ko-KR')}만`
}

/**
 * 전세 라벨. 값이 없으면 null 을 준다 — 호출부가 "거래 없음" 을 그릴지 줄을 뺄지 정한다.
 *
 * formatPriceLabel 과 달리 접두어("전세")를 붙이지 않는다. 목록과 펼침 카드가 라벨을
 * 별도 요소로 그리기 때문이다 — 문자열에 넣으면 스타일을 나눠 줄 수 없다.
 */
export function formatJeonseLabel(item: MapBuildingItem): string | null {
  if (item.jeonseDeposit == null) return null
  return formatManwon(item.jeonseDeposit)
}

/**
 * 월세 라벨 — "보증금 · 월세액".
 *
 * 둘 중 하나라도 없으면 null 이다. 보증금만 그리면 전세로 읽히고, 월세액만 그리면
 * 보증금이 0인지 미상인지 알 수 없다. 0 은 유효한 값이라 `== null` 로만 판정한다.
 */
export function formatWolseLabel(item: MapBuildingItem): string | null {
  if (item.wolseDeposit == null || item.wolseMonthlyRent == null) return null
  return `${formatManwon(item.wolseDeposit)} · ${item.wolseMonthlyRent.toLocaleString('ko-KR')}만`
}

/** 지역 버블 라벨. 단위를 명시해 줌 전환 시 의미가 바뀌는 걸 알린다. */
export function formatPyeongLabel(item: MapRegionItem): string {
  if (item.avgPricePerPyeong == null) return '—'
  return `${formatManwon(item.avgPricePerPyeong)}/평`
}

interface Box { x1: number; y1: number; x2: number; y2: number }

/** 라벨 한 글자당 대략 폭(px). 실측 대신 근사로 충분하다 — 겹침 판정용 여유 상자다. */
const CHAR_PX = 7.2
/** 좌우 패딩 + 테두리. .map-price-label 의 px-2 와 맞춘다. */
const LABEL_PAD_PX = 18
const LABEL_H_PX = 22
/** 상자 사이 최소 간격. 붙어 있으면 읽기 어려워 약간 띄운다. */
const GAP_PX = 3

/**
 * 라벨이 차지할 화면 영역. yAnchor:1 이라 좌표 위쪽에 그려지므로 상자도 위로 잡는다.
 * projection 이 없거나(테스트 fake) 변환이 실패하면 null → 호출부가 겹침 판정을 건너뛴다.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function boxAt(projection: any, kakao: any, lat: number, lng: number, textLen: number): Box | null {
  try {
    const pt = projection.containerPointFromCoords(new kakao.maps.LatLng(lat, lng))
    if (!pt || !Number.isFinite(pt.x) || !Number.isFinite(pt.y)) return null
    const w = textLen * CHAR_PX + LABEL_PAD_PX
    return {
      x1: pt.x - w / 2 - GAP_PX,
      y1: pt.y - LABEL_H_PX - GAP_PX,
      x2: pt.x + w / 2 + GAP_PX,
      y2: pt.y + GAP_PX,
    }
  } catch {
    return null
  }
}

function intersects(a: Box, b: Box): boolean {
  return a.x1 < b.x2 && b.x1 < a.x2 && a.y1 < b.y2 && b.y1 < a.y2
}

interface OverlayHandlers {
  onClick?: (item: MapItem) => void
  onHover?: (item: MapItem | null) => void
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function renderOverlays(map: any, items: MapItem[], handlers: OverlayHandlers = {}): void {
    // import.meta.server 극성 사용(useKakaoMap.ts:124 컨벤션과 동일): 실제 Nuxt 빌드에서는
    // server/client 가 항상 서로 반대이므로 프로덕션 동작은 !client 와 완전히 동일하다.
    // 차이는 두 플래그가 모두 undefined 인 vitest 환경뿐 — 그때 이 극성이라야 렌더러가 실행되어 테스트 가능해진다.
    if (import.meta.server || !map) return
    clearOverlays()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const kakao = (window as any).kakao
    if (!kakao?.maps) return

    // 겹침 회피용 화면좌표 변환기. 없으면(테스트 fake 등) 전부 그린다.
    const projection = typeof map.getProjection === 'function' ? map.getProjection() : null
    const placed: Box[] = []

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const next: any[] = []
    for (const item of items) {
      if (item.lat == null || item.lng == null) continue
      const building = isBuildingItem(item)
      const text = building
        ? formatPriceLabel(item as MapBuildingItem)
        : formatPyeongLabel(item as MapRegionItem)

      // 밀집 지역에서 라벨이 서로 덮으면 아무것도 못 읽는다. items 순서가 곧 우선순위 —
      // 앞선 라벨과 겹치면 라벨 대신 점을 찍는다. 단, 그 순서의 출처는 종류별로 다르다:
      // building 은 서버가 transactionCount DESC 로 주고(fetchBuildings), region(city/
      // district/dong)은 뷰포트 중심에서 가까운 순으로 준다(sortRegionsByDistance) — 정렬
      // 기준이 통일돼 있지 않으므로 여기서 "우선순위 = items 순서"라고만 가정하고, 그 기준이
      // transactionCount 라고 단정하지 않는다.
      //
      // 건너뛰지 않고 점이라도 남기는 이유: 좌측 목록은 items 전부를 보여주므로, 겹친다고
      // 아예 지우면 "목록엔 있는데 지도엔 없는" 건물이 생긴다(실측 강남 level 4: 목록 114 vs
      // 라벨 76 → 38개 실종). 점은 자리를 차지하지 않으면서 위치와 클릭 대상을 유지한다.
      let collapsed = false
      if (projection) {
        const box = boxAt(projection, kakao, item.lat, item.lng, text.length)
        if (box) {
          if (placed.some((p) => intersects(p, box))) collapsed = true
          else placed.push(box)
        }
      }

      const el = document.createElement('div')
      el.className = collapsed
        ? 'map-price-dot'
        : building
          ? 'map-price-label'
          : 'map-region-bubble'
      // 점에도 값을 남긴다 — 호버 시 툴팁으로 뜨고, 스크린리더도 읽는다.
      if (collapsed) el.title = text
      else el.textContent = text

      if (handlers.onClick) el.addEventListener('click', () => handlers.onClick!(item))
      if (handlers.onHover) {
        el.addEventListener('mouseenter', () => handlers.onHover!(item))
        el.addEventListener('mouseleave', () => handlers.onHover!(null))
      }

      const overlay = new kakao.maps.CustomOverlay({
        position: new kakao.maps.LatLng(item.lat, item.lng),
        content: el,
        yAnchor: 1,
        clickable: true,
      })
      overlay.setMap(map)
      next.push(overlay)
    }
    overlays.value = next
  }

  return { renderOverlays, clearOverlays }
}
