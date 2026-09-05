/**
 * /og-map 이 실제로 내보내는 이미지 규격 — 라우트 요청과 og:image:width/height 선언의 단일 소스.
 *
 * 이 두 숫자가 갈라진 적이 있다. 최초 커밋(f74abc66)부터 라우트는 `scale: '2'` 로 2048x1072 를
 * 내보내는데 메타는 1024x536 을 선언했다. 소셜 플랫폼은 선언값으로 카드 레이아웃을 잡은 뒤
 * 4배 픽셀의 이미지를 받았고, 응답은 837KB 까지 커졌다(상세 HTML 은 71KB).
 *
 * 라우트와 메타가 각자 숫자를 들고 있으면 또 갈라지므로 여기서만 정의한다.
 * 비율 1.910 은 OG 권장 규격 1200x630(1.905)과 사실상 동일하고,
 * 대형 카드 최소 규격(600x315)을 넉넉히 넘는다.
 */
export const OG_MAP_WIDTH = 1024
export const OG_MAP_HEIGHT = 536

/** NCP Static Map 배율. 1 이어야 출력이 위 규격과 일치한다. */
export const OG_MAP_SCALE = 1

/**
 * 지도 래스터는 사진에 가까워 PNG 가 비효율적이다.
 * 같은 이미지 기준 PNG 837KB → JPEG 147KB (-82%).
 */
export const OG_MAP_FORMAT = 'jpg'
export const OG_MAP_CONTENT_TYPE = 'image/jpeg'

/**
 * NCP Static Map 마커 label 최대 길이(문자 수).
 *
 * 라우트(`server/routes/og-map.get.ts` 의 sanitizeLabel)가 어차피 여기서 자른다.
 * 생산 쪽(`utils/ogImageUrl.ts`)이 같은 상수를 쓰지 않으면, 잘려나갈 문자열을
 * 크롤러가 percent-encoding 된 채 실어나르게 된다 — 실측 2,004자짜리 og:image URL이
 * 그렇게 나왔다. 두 쪽이 같은 값을 보게 여기서만 정의한다.
 */
export const OG_MAP_LABEL_MAX = 20

/**
 * /og-map 이 지도를 그릴 수 있는 좌표 범위(대한민국).
 *
 * 라우트는 이 범위를 벗어나면 지도를 요청하지 않고 inlineFallback 으로 떨어진다. Cafe24 에는
 * sharp 네이티브 바인딩이 없어 그 폴백이 **SVG** 로 나가는데, 네이버 크롤러는 SVG 를 렌더하지
 * 않는다(규칙 #441).
 *
 * 그래서 URL 생성기(`utils/ogImageUrl.ts`)도 같은 범위를 봐야 한다. 안 그러면 "라우트는 못
 * 그리는데 메타는 가리키는" og:image 를 계속 발행하게 된다. 실제로 그렇게 됐다 — 백엔드
 * toDetail 이 `lat: Number(record.lat)` 이라 좌표 없는 행이 `Number(null) === 0` 으로 0 이 되어
 * 도착하는데, 생성기가 `Number.isFinite` 만 봐서 0 을 유효 좌표로 통과시켰다.
 * 실측 2026-09-04: 좌표 없는 색인 대상 행 7,591개가 `/og-map?lat=0&lng=0` 을 발행했고
 * 프로덕션 응답은 200 image/svg+xml 이었다(정상 좌표는 image/jpeg).
 */
export const KOREA_LAT_MIN = 33
export const KOREA_LAT_MAX = 39
export const KOREA_LNG_MIN = 124
export const KOREA_LNG_MAX = 131

/** /og-map 이 실제로 지도를 그릴 수 있는 좌표인지 — 라우트와 생성기의 단일 판정. */
export function isMappableCoord(lat: number | null | undefined, lng: number | null | undefined): boolean {
  if (lat === null || lat === undefined || lng === null || lng === undefined) return false
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false
  return lat >= KOREA_LAT_MIN && lat <= KOREA_LAT_MAX
    && lng >= KOREA_LNG_MIN && lng <= KOREA_LNG_MAX
}
