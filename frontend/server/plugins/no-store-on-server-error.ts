import { enforceNoStoreOnServerError } from '../utils/errorResponseCache'

/**
 * 5xx 응답에 `cache-control: no-store` 를 강제한다.
 *
 * beforeResponse 는 라우트 핸들러(= routeRules swr 이 걸린 경우 Nitro 의
 * cachedEventHandler 포함)가 끝난 뒤, 응답이 전송되기 전에 실행된다.
 * 따라서 Nitro 가 덮어쓴 swr cache-control 을 여기서 되돌릴 수 있다.
 *
 * 근거와 영향 범위는 utils/errorResponseCache.ts 주석 참조.
 */
export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('beforeResponse', (event) => {
    enforceNoStoreOnServerError(event.node.res)
  })
})
