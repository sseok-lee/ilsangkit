/**
 * og:image URL 단일 생성기.
 *
 * ## 왜 한곳에 모으는가
 *
 * og:image URL 은 5곳(시설 상세·부동산 건물 상세·공매 물건·지하철역·청약 상세)에서 각자
 * 템플릿 문자열로 조립되고 있었고, 그래서 두 가지 결함이 동시에 자랐다.
 *
 * 1. **`/og?...` 는 프로덕션에서 100% 302 다.** `server/routes/og.get.ts` 는 SVG 를 PNG 로
 *    바꾸려고 `sharp` 를 동적 import 하는데, sharp 는 frontend 의 선언 의존성이 아니고
 *    Cafe24 에는 네이티브 바인딩이 없다. 따라서 catch 로 떨어져 `/og-image.png` 로
 *    302 한다. 즉 페이지마다 고유한 "영구 리다이렉트 URL" 을 하나씩 발행해 온 셈이고,
 *    네이버 진단의 리디렉션 3,193 건이 여기서 나온다. robots.txt 는 `/og-map` 만 막고
 *    `/og` 는 어느 그룹에도 규칙이 없어 전 크롤러가 그대로 수집한다.
 *    → 최종 도착지(`DEFAULT_OG_IMAGE`)를 메타에 직접 쓴다. 리다이렉트 URL 을 아예 만들지 않는다.
 *
 * 2. **`/og-map?...` 는 같은 문자열을 두 번 싣고 잘라내지 않았다.** `label` 과 `title` 에
 *    동일한 시설명/건물명이 통째로 들어갔고, 한글은 percent-encoding 에서 3배로 부풀어
 *    실측 2,004 자짜리 URL 까지 나왔다. 정작 라우트는 label 을 20자로 자르고(sanitizeLabel)
 *    title/city/district 는 NCP 성공 경로에서 쓰지도 않는다 — 크롤러가 실어나른 바이트가
 *    서버에서 그대로 버려진다. 고유 쿼리마다 별개 리소스라 크롤 예산도 그만큼 샌다.
 *    → 생산 시점에 라우트와 같은 상한으로 자르고, 쓰이지 않는 파라미터는 싣지 않는다.
 *
 * 규칙이 한곳에 있으므로 길이 상한을 테스트로 강제할 수 있다.
 */
import { SITE_URL, DEFAULT_OG_IMAGE } from './seoConstants'
import { OG_MAP_LABEL_MAX, isMappableCoord } from './ogMapSpec'

/**
 * og:image URL 길이 상한.
 *
 * 소셜/검색 크롤러가 실제로 거부하는 하드 리밋은 아니지만, 이 값을 넘으면 "쿼리에 본문을
 * 싣고 있다"는 뜻이다. 좌표(약 45자) + 20자 label(한글 percent-encoding 최악 180자) +
 * 카테고리 + origin 을 모두 더해도 여유가 있는 값으로 잡았다.
 */
export const OG_IMAGE_URL_MAX = 320

/** 좌표 소수 자릿수. 6자리면 약 0.1m — 지도 마커에 충분하고 URL 은 짧아진다. */
const COORD_PRECISION = 6

function roundCoord(value: number): string {
  return String(Number(value.toFixed(COORD_PRECISION)))
}

export interface OgMapImageInput {
  lat: number | null | undefined
  lng: number | null | undefined
  /** 지도 마커 라벨. OG_MAP_LABEL_MAX 로 잘린다. */
  label?: string | null
  /** og-map 폴백 카드의 색/라벨을 고르는 키. 미지정 시 라우트 기본값. */
  category?: string | null
}

/**
 * 좌표가 유효하면 `/og-map` URL 을, 아니면 정적 대표 PNG 를 돌려준다.
 *
 * `/og?...` 는 절대 만들지 않는다 — 위 주석 (1) 참고.
 * 상한을 넘으면 label 을 떼고, 그래도 넘으면 정적 PNG 로 떨어진다(항상 200 인 경로).
 */
export function buildOgMapImageUrl(input: OgMapImageInput): string {
  const { lat, lng } = input
  // 판정은 ogMapSpec 의 isMappableCoord 하나로 한다. 여기서 자체 검사를 하면 라우트와 갈라지고,
  // 갈라진 결과가 곧 "라우트는 SVG 로 떨어지는데 메타는 그 URL 을 가리키는" og:image 다.
  // 특히 0 을 걸러야 한다 — 백엔드가 좌표 없음을 0 으로 직렬화한다(Number(null) === 0).
  if (!isMappableCoord(lat, lng)) {
    return DEFAULT_OG_IMAGE
  }

  const params = new URLSearchParams({ lat: roundCoord(lat), lng: roundCoord(lng) })
  if (input.category) params.set('category', input.category)

  const label = (input.label ?? '').replace(/[|:]/g, '').replace(/\s+/g, ' ').trim().slice(0, OG_MAP_LABEL_MAX)

  if (label) {
    const withLabel = new URLSearchParams(params)
    withLabel.set('label', label)
    const candidate = `${SITE_URL}/og-map?${withLabel.toString()}`
    if (candidate.length <= OG_IMAGE_URL_MAX) return candidate
  }

  const withoutLabel = `${SITE_URL}/og-map?${params.toString()}`
  return withoutLabel.length <= OG_IMAGE_URL_MAX ? withoutLabel : DEFAULT_OG_IMAGE
}

/**
 * 좌표 없는 문서의 og:image. 예전에는 `/og?category=…&title=…` 을 썼는데 그건 302 다.
 * 최종 도착지를 그대로 쓴다.
 */
export function staticOgImageUrl(): string {
  return DEFAULT_OG_IMAGE
}

/** og:image URL 이 이 사이트의 리다이렉트 라우트(`/og?…`)를 가리키는가. 테스트/검증용. */
export function isRedirectingOgUrl(url: string): boolean {
  return /^https?:\/\/[^/]+\/og\?/.test(url) || url.startsWith('/og?')
}
