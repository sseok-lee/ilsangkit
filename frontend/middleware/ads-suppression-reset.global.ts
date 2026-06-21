import { suppressAds } from '~/composables/useAdsPolicy'

// 매 내비게이션마다 광고 억제 플래그를 해제한다. degraded/noindex 페이지는 자신의
// watchEffect 에서 다시 true 로 세팅하므로(미들웨어는 페이지 마운트 전에 실행),
// 정상 페이지로 이동했을 때 이전 페이지의 suppression 이 남아 광고가 사라지는
// 회귀(SPA soft-nav)를 막는다.
export default defineNuxtRouteMiddleware(() => {
  suppressAds(false)
})
