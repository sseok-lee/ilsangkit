import { computed, type ComputedRef, type Ref } from 'vue'

// 광고를 발화하면 안 되는 비인간/자동화 UA. 'Headless'는 구·신 헤드리스 모두 커버.
const BOT_UA = /Headless|playwright|puppeteer|lighthouse|bot|crawl|spider|slurp|bingbot|googlebot|yeti|yandex|amazonbot|bytespider|ahrefs|semrush/i
// 실모바일/인앱 — 봇 매칭보다 우선(allowlist-wins). 과탐=수익 손실 방지.
const HUMAN_UA = /NAVER\(inapp|SamsungBrowser|FBAN|FBAV|Instagram|KAKAOTALK|Line\//i

/** UA/webdriver만으로 봇 여부 판정하는 순수 함수. */
export function isBotSignature(userAgent: string, webdriver: boolean): boolean {
  if (!userAgent) return false
  if (HUMAN_UA.test(userAgent)) return false // allowlist-wins (네이버 인앱이 webdriver여도 통과)
  if (webdriver) return true                  // Playwright/Selenium (단, Lighthouse는 CDP라 못 잡음)
  return BOT_UA.test(userAgent)
}

/** 클라이언트에서만 평가. SSR/단위테스트(import.meta.client falsy)에선 false로 클라이언트에 위임. */
export function isLikelyBot(): boolean {
  if (!import.meta.client) return false
  const nav = navigator as Navigator & { webdriver?: boolean }
  return isBotSignature(nav.userAgent || '', nav.webdriver === true)
}

/** 리터럴 boolean(nuxt.config) 전제. 명시적 false만 비활성. */
export function useAdsEnabled(): boolean {
  return useRuntimeConfig().public.adsEnabled !== false
}

/**
 * 광고를 전혀 싣지 않는 경로. 정확히 일치할 때만 막는다 — 하위 경로
 * (/real-estate/apt-sale 등)는 평범한 목록 페이지라 광고를 그대로 싣는다.
 *
 * /real-estate 는 지도 전용 화면이라 인피드 슬롯을 뺐는데, 그것만으로는 Auto Ads 가
 * body 에 직접 심는 앵커·오버레이 자리가 남는다(실측: ins.adsbygoogle-noablate 1개).
 * 그건 슬롯 코드가 아니라 스크립트가 만드는 것이라 스크립트 주입 자체를 막아야 한다.
 */
const AD_FREE_PATHS = new Set(['/real-estate'])

/** 경로 끝 슬래시만 다른 경우(/real-estate/)도 같은 페이지다. */
export function isAdFreePath(pathname: string): boolean {
  const normalized = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  return AD_FREE_PATHS.has(normalized)
}

/**
 * 플러그인(스크립트 주입)용 — per-page suppression은 보지 않음(전역·1회).
 *
 * ⚠️ 이 판정은 **최초 로드 시점의 경로**로만 이뤄진다. 다른 페이지에서 SPA 소프트
 * 내비게이션으로 /real-estate 에 들어오면 스크립트가 이미 주입돼 있어 막지 못한다.
 * GNB·푸터가 HardLink(전체 리로드)라 실사용 유입 대부분은 이 경로를 탄다.
 */
export function canLoadAdScript(): boolean {
  if (import.meta.client && isAdFreePath(window.location.pathname)) return false
  return useAdsEnabled() && !isLikelyBot()
}

/** degraded/noindex 페이지가 광고를 억제하도록 set (reactive 소스에서 호출). */
export function suppressAds(value: boolean): void {
  useState<boolean>('ads:suppressed', () => false).value = value
}

/** 애드블록(스크립트 로드 실패) 감지 시 호출. 넘겨받은 blocked ref 를 true 로 + 세션 저장.
 *  ref 를 인자로 받아 async 콜백(plugin onerror/timeout)에서 useState 문맥 없이 쓸 수 있게 한다. */
export function markAdsBlocked(blocked: Ref<boolean>): void {
  blocked.value = true
  try {
    sessionStorage.setItem('ads:blocked', '1')
  } catch {
    // SSR(sessionStorage 미정의)·프라이빗 모드 등 — 무시(런타임 state 만으로 동작)
  }
}

/** AdBanner용 — 3요소 전부. shouldServeAds는 suppression을 추적하는 reactive. */
export function useAdsPolicy(): { shouldServeAds: ComputedRef<boolean> } {
  const adsEnabled = useAdsEnabled()
  const suppressed = useState<boolean>('ads:suppressed', () => false)
  const blocked = useState<boolean>('ads:blocked', () => false)
  const shouldServeAds = computed(
    () => adsEnabled && !isLikelyBot() && !suppressed.value && !blocked.value
  )
  return { shouldServeAds }
}
