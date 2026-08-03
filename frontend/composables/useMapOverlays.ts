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
    if (!import.meta.client || !map) return
    clearOverlays()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const kakao = (window as any).kakao
    if (!kakao?.maps) return

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const next: any[] = []
    for (const item of items) {
      if (item.lat == null || item.lng == null) continue
      const building = isBuildingItem(item)
      const el = document.createElement('div')
      el.className = building ? 'map-price-label' : 'map-region-bubble'
      el.textContent = building
        ? formatPriceLabel(item as MapBuildingItem)
        : formatPyeongLabel(item as MapRegionItem)

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
