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
