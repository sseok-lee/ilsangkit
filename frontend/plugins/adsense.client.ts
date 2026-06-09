// AdSense adsbygoogle.js 를 hydration 완료 후(onNuxtReady)에 주입한다.
// head 에 정적 async 로 두면 Auto Ads 가 hydration 도중 #__nuxt 내부에 광고 DOM 을 주입해
// Vue hydration mismatch + adsbygoogle no_div + 순간 레이아웃 깨짐을 유발한다 (2026-06-09 Playwright 실측).
// onNuxtReady 는 hydration 완료 + requestIdleCallback 이후 콜백을 실행하므로 광고 주입과 hydration 의
// 레이스를 구조적으로 제거한다. (.client 접미사로 클라이언트에서만 실행 → SSR HTML 에 스크립트 미포함)
const ADSENSE_SRC =
  'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-2088264360250020'

export default defineNuxtPlugin(() => {
  onNuxtReady(() => {
    // HMR/재실행 대비 중복 주입 가드
    if (document.querySelector(`script[src="${ADSENSE_SRC}"]`)) return
    const s = document.createElement('script')
    s.src = ADSENSE_SRC
    s.async = true
    s.crossOrigin = 'anonymous'
    document.head.appendChild(s)
  })
})
