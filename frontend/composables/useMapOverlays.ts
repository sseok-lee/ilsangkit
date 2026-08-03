import { shallowRef } from 'vue'
import { isBuildingItem, type MapBuildingItem, type MapItem, type MapRegionItem } from '~/types/realEstateMap'

/** 만원 단위 금액을 "16억 8,340" / "8,500" 형태로 만든다. */
function formatManwon(manwon: number): string {
  const eok = Math.floor(manwon / 10000)
  const rest = manwon % 10000
  if (eok === 0) return rest.toLocaleString('ko-KR')
  if (rest === 0) return `${eok}억`
  return `${eok}억 ${rest.toLocaleString('ko-KR')}`
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
  return `월 ${price}·${item.monthlyRent.toLocaleString('ko-KR')}`
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

      // 밀집 지역에서 라벨이 서로 덮으면 아무것도 못 읽는다. items 는 서버가
      // transactionCount DESC 로 주므로 순서가 곧 우선순위 — 앞선 라벨과 겹치는 것은 건너뛴다.
      if (projection) {
        const box = boxAt(projection, kakao, item.lat, item.lng, text.length)
        if (box) {
          if (placed.some((p) => intersects(p, box))) continue
          placed.push(box)
        }
      }

      const el = document.createElement('div')
      el.className = building ? 'map-price-label' : 'map-region-bubble'
      el.textContent = text

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
