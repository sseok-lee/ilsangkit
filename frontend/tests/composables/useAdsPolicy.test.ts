import { afterEach, describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { isBotSignature, useAdsEnabled, useAdsPolicy, suppressAds, markAdsBlocked } from '~/composables/useAdsPolicy'

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
