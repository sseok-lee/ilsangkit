import { computed, type ComputedRef } from 'vue'

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

/** 플러그인(스크립트 주입)용 — per-page suppression은 보지 않음(전역·1회). */
export function canLoadAdScript(): boolean {
  return useAdsEnabled() && !isLikelyBot()
}

/** degraded/noindex 페이지가 광고를 억제하도록 set (reactive 소스에서 호출). */
export function suppressAds(value: boolean): void {
  useState<boolean>('ads:suppressed', () => false).value = value
}

/** AdBanner용 — 3요소 전부. shouldServeAds는 suppression을 추적하는 reactive. */
export function useAdsPolicy(): { shouldServeAds: ComputedRef<boolean> } {
  const adsEnabled = useAdsEnabled()
  const suppressed = useState<boolean>('ads:suppressed', () => false)
  const shouldServeAds = computed(() => adsEnabled && !isLikelyBot() && !suppressed.value)
  return { shouldServeAds }
}
