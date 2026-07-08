import { canLoadAdScript, markAdsBlocked } from '~/composables/useAdsPolicy'

// AdSense adsbygoogle.js 를 hydration 완료 후(onNuxtReady)에 주입한다.
// (head 정적 async 는 Auto Ads 가 hydration 도중 DOM 주입 → mismatch/레이아웃 깨짐, 2026-06-09 실측)
const ADSENSE_SRC =
  'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-2088264360250020'
// onerror 가 안 뜨는 블로커(빈 200 응답) 백업 — 이 시간 뒤 adsbygoogle.loaded 미설정이면 차단으로 간주.
// onerror 가 대개 먼저 발동하므로 백업용. 정상 로드는 이 시간 안에 loaded=true 가 된다(느린 회선 오탐 방지 위해 넉넉히).
const AD_BLOCK_CHECK_MS = 3000

export default defineNuxtPlugin(() => {
  // plugin setup(문맥 있음)에서 ref 를 캡처 → async 콜백에선 ref 만 사용.
  const blocked = useState<boolean>('ads:blocked', () => false)

  onNuxtReady(() => {
    // CI(adsEnabled=false)·봇/헤드리스면 스크립트 자체를 주입하지 않는다.
    if (!canLoadAdScript()) return

    // 이번 세션에서 이미 애드블록 확인됨 → 주입/슬롯 스킵(빈칸 없이 바로 미표시).
    try {
      if (sessionStorage.getItem('ads:blocked') === '1') {
        blocked.value = true
        return
      }
    } catch {
      // sessionStorage 불가 — 무시하고 정상 경로 진행
    }

    // HMR/재실행 대비 중복 주입 가드
    if (document.querySelector(`script[src="${ADSENSE_SRC}"]`)) return

    const s = document.createElement('script')
    s.src = ADSENSE_SRC
    s.async = true
    s.crossOrigin = 'anonymous'
    // 애드블록/네트워크 실패 → 로드 실패. 이 경우에만 차단으로 판정(오탐 방지).
    s.onerror = () => markAdsBlocked(blocked)
    document.head.appendChild(s)

    // 백업: onerror 없이 조용히 막는 블로커(빈 200) — loaded 미설정이면 차단.
    window.setTimeout(() => {
      const w = window as Window & { adsbygoogle?: { loaded?: boolean } }
      if (!(w.adsbygoogle && w.adsbygoogle.loaded)) markAdsBlocked(blocked)
    }, AD_BLOCK_CHECK_MS)
  })
})
