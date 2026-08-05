import { shallowRef } from 'vue'
import { isBuildingItem, type MapBuildingItem, type MapItem, type MapRegionItem } from '~/types/realEstateMap'
import { toRealEstateUrl, type RealEstateUrlType } from '~/utils/realEstateUrl'
import { itemKey } from '~/composables/useRealEstateMap'

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

/**
 * 전세/월세 표시 값. 새 분리 컬럼(jeonseDeposit, wolseDeposit)이 **둘 다 null** 이면
 * "거래가 없다"가 아니라 "이 시·도 배치가 아직 안 돌았다"는 뜻이다 — 전월세 요약 행은
 * 반드시 전세 또는 월세 거래에서 나오므로, 정상적으로 갱신됐다면 둘 중 최소 하나는
 * 채워져 있어야 한다. 배포 직후엔 `prisma db push` 만 돌아 다섯 새 컬럼이 전부 NULL
 * 인 채로 다음 nightly sync(~03:50 KST, 최대 ~18시간 뒤)까지 남는다 — 그동안은 레거시
 * 컬럼(latestPrice/monthlyRent, monthlyRent: null=매매/0=전세/>0=월세)으로 폴백해
 * 예전과 같은 값을 보여준다. 둘 중 하나라도 값이 있으면 정상 갱신된 것으로 보고
 * formatJeonseLabel/formatWolseLabel 을 그대로 쓴다.
 */
export function getRentDisplay(item: MapBuildingItem): { jeonse: string | null; wolse: string | null } {
  if (item.jeonseDeposit != null || item.wolseDeposit != null) {
    return { jeonse: formatJeonseLabel(item), wolse: formatWolseLabel(item) }
  }
  if (item.latestPrice == null) return { jeonse: null, wolse: null }
  if (item.monthlyRent === 0) return { jeonse: formatManwon(item.latestPrice), wolse: null }
  if (item.monthlyRent != null && item.monthlyRent > 0) {
    return { jeonse: null, wolse: `${formatManwon(item.latestPrice)} · ${item.monthlyRent.toLocaleString('ko-KR')}만` }
  }
  return { jeonse: null, wolse: null }
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
    const { jeonse, wolse } = getRentDisplay(item)
    addLine('전세', jeonse ?? '거래 없음', { secondary: false, absent: jeonse == null })
    addLine('월세', wolse ?? '거래 없음', { secondary: true, absent: wolse == null })
  } else {
    addLine('매매', formatPriceLabel(item), { secondary: false, absent: false })
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
    opts: { type?: string; selectedKey?: string | null } = {},
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
    // 겹침 판정은 items 순서를 우선순위로 쓰지만(아래 루프 주석 참고) 선택된 항목은
    // `!selected` 조건으로 그 판정 자체를 건너뛰므로, 순서를 뒤로 옮겨도 점으로
    // 접히지 않는다는 보장은 그대로 유지된다.
    const selectedKey = opts.selectedKey ?? null
    const ordered = selectedKey == null
      ? items
      : [
          ...items.filter((i) => !(isBuildingItem(i) && itemKey(i) === selectedKey)),
          ...items.filter((i) => isBuildingItem(i) && itemKey(i) === selectedKey),
        ]
    const isRent = (opts.type ?? '').endsWith('-rent')

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const kakao = (window as any).kakao
    if (!kakao?.maps) return

    // 겹침 회피용 화면좌표 변환기. 없으면(테스트 fake 등) 전부 그린다.
    const projection = typeof map.getProjection === 'function' ? map.getProjection() : null
    const placed: Box[] = []

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const next: any[] = []
    for (const item of ordered) {
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
      const selected = building && itemKey(item) === selectedKey
      let collapsed = false
      if (projection && !selected) {
        const box = boxAt(projection, kakao, item.lat, item.lng, text.length)
        if (box) {
          if (placed.some((p) => intersects(p, box))) collapsed = true
          else placed.push(box)
        }
      }

      const el = selected
        ? buildPopup(item as MapBuildingItem, opts.type ?? '', isRent)
        : (() => {
            const d = document.createElement('div')
            d.className = collapsed
              ? 'map-price-dot'
              : building
                ? 'map-price-label'
                : 'map-region-bubble'
            // 점에도 값을 남긴다 — 호버 시 툴팁으로 뜨고, 스크린리더도 읽는다.
            if (collapsed) d.title = text
            else d.textContent = text
            return d
          })()

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
