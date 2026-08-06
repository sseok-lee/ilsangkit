import { afterEach, describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { isBotSignature, useAdsEnabled, useAdsPolicy, suppressAds, markAdsBlocked, isAdFreePath } from '~/composables/useAdsPolicy'

const realConfig = (globalThis as any).useRuntimeConfig

afterEach(() => {
  ;(globalThis as any).useRuntimeConfig = realConfig
  ;(globalThis as any).__resetUseState?.()
  sessionStorage.clear()
})

describe('isBotSignature', () => {
  it('webdriver=true면 봇', () => {
    expect(isBotSignature('Mozilla/5.0 (Windows) Chrome/120', true)).toBe(true)
  })
  it('HeadlessChrome UA면 봇', () => {
    expect(isBotSignature('Mozilla/5.0 HeadlessChrome/146', false)).toBe(true)
  })
  it('신헤드리스(Headless 토큰)도 봇', () => {
    expect(isBotSignature('Mozilla/5.0 Chrome/146 Headless', false)).toBe(true)
  })
  it('Yeti/Amazonbot 등 크롤러는 봇', () => {
    expect(isBotSignature('compatible; Yeti/1.1', false)).toBe(true)
    expect(isBotSignature('compatible; Amazonbot/0.1', false)).toBe(true)
  })
  it('실 iPhone Safari는 봇 아님', () => {
    expect(isBotSignature('Mozilla/5.0 (iPhone; CPU iPhone OS 18_5) Safari/604.1', false)).toBe(false)
  })
  it('네이버 인앱은 webdriver여도 allowlist-wins로 통과', () => {
    expect(isBotSignature('Mozilla/5.0 ... NAVER(inapp; search; 2100; 12.21)', true)).toBe(false)
  })
  it('SamsungBrowser는 봇 아님', () => {
    expect(isBotSignature('Mozilla/5.0 (Linux; Android 10) SamsungBrowser/30.0 Chrome/143', false)).toBe(false)
  })
})

describe('useAdsEnabled', () => {
  it('기본(true)이면 enabled', () => {
    expect(useAdsEnabled()).toBe(true)
  })
  it('public.adsEnabled === false면 disabled', () => {
    ;(globalThis as any).useRuntimeConfig = () => ({ public: { adsEnabled: false } })
    expect(useAdsEnabled()).toBe(false)
  })
})

describe('useAdsPolicy.shouldServeAds', () => {
  it('기본은 true', () => {
    expect(useAdsPolicy().shouldServeAds.value).toBe(true)
  })
  it('suppressAds(true)면 false', () => {
    suppressAds(true)
    expect(useAdsPolicy().shouldServeAds.value).toBe(false)
  })
})

describe('useAdsPolicy — 애드블록', () => {
  it('ads:blocked state가 true면 shouldServeAds=false', () => {
    ;(globalThis as any).useState('ads:blocked', () => false).value = true
    expect(useAdsPolicy().shouldServeAds.value).toBe(false)
  })
  it('markAdsBlocked는 ref를 true로 + sessionStorage 세팅', () => {
    const r = ref(false)
    markAdsBlocked(r)
    expect(r.value).toBe(true)
    expect(sessionStorage.getItem('ads:blocked')).toBe('1')
  })
})

// /real-estate 는 지도 전용 화면이라 광고를 싣지 않는다(사용자 결정). 인피드 슬롯을
// 빼는 것만으로는 Auto Ads 가 body 에 직접 심는 앵커 자리가 남아, 스크립트 주입 자체를
// 막아야 한다. 하위 경로는 평범한 목록 페이지라 광고를 그대로 실어야 한다.
describe('isAdFreePath', () => {
  it('지도 페이지는 광고 없음', () => {
    expect(isAdFreePath('/real-estate')).toBe(true)
  })

  it('끝 슬래시만 다른 경우도 같은 페이지다', () => {
    expect(isAdFreePath('/real-estate/')).toBe(true)
  })

  it('하위 경로는 광고를 싣는다 — 목록·상세는 평범한 페이지다', () => {
    expect(isAdFreePath('/real-estate/apt-sale')).toBe(false)
    expect(isAdFreePath('/real-estate/apt-rent/seoul/gangnam/도곡렉슬')).toBe(false)
  })

  it('접두어만 같은 다른 경로를 잘못 막지 않는다', () => {
    expect(isAdFreePath('/real-estate-guide')).toBe(false)
  })

  it('무관한 경로는 영향 없음', () => {
    expect(isAdFreePath('/')).toBe(false)
    expect(isAdFreePath('/search')).toBe(false)
  })
})
