import { expect, test } from '@playwright/test'

/**
 * 클라이언트 네비게이션에서 시설 상세 에러 페이지가 실제로 뜨는지 검증한다.
 *
 * 회귀 배경 — `[category]/[id].vue` 는 `watch(fetchError, ...)` 안에서
 * `throw createError(...)` 를 했다. Vue 가 watcher 예외를 삼켜 Nuxt 의 showError 까지
 * 가지 않으므로, 직접 진입(SSR)은 정상인데 사이트 내부 이동만 **빈 페이지**가 됐다.
 * 2026-08-28 프로덕션 실측: title 이 사이트 기본값 "일상킷 - 부동산 실거래가·청약·내
 * 주변 생활정보" 로 뜨고 h1·<main> 이 아예 없었다.
 *
 * 픽스처를 안 만들기 위해 410(FacilityGone 행 필요) 대신 404 경로로 검증한다 —
 * 같은 watch·같은 showError 배선을 타므로 결함이 되살아나면 여기서 잡힌다.
 */
test('클라이언트 네비게이션에서 없는 시설로 이동하면 에러 페이지가 뜬다 (빈 페이지 회귀)', async ({ page }) => {
  // 1) 먼저 목록으로 진입해 SPA 를 띄운다 — 이후 이동은 풀 리로드가 아니어야 한다
  await page.goto('/childcare', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()

  // 하이드레이션 완료까지 기다린다. SSR HTML 만 있는 시점에는 __vue_app__ 이 없어
  // 아래 router.push 가 옵셔널 체이닝으로 조용히 no-op 되고, 그러면 "이동을 안 했는데
  // 통과" 하거나 반대로 엉뚱한 이유로 실패하는 flaky 테스트가 된다.
  await page.waitForFunction(
    () => !!(document.querySelector('#__nuxt') as unknown as { __vue_app__?: unknown })?.__vue_app__,
  )

  // CSR 경로 진입은 "하이드레이션된 앱의 라우터를 직접 호출"로 보장된다.
  // load 이벤트로 풀 리로드를 감시하지는 않는다 — dev 모드에서는 Vite HMR 이 페이지를
  // 리로드해 load 가 뜨므로(제품 결함과 무관) 그 어서션은 그냥 flaky 해진다.

  // 2) 존재하지 않는 id 로 클라이언트 네비게이션
  const missingId = `childcare-nonexistent-${Date.now()}`
  const pushed = await page.evaluate(async (path) => {
    const app = (document.querySelector('#__nuxt') as unknown as { __vue_app__?: {
      config: { globalProperties: { $router: { push: (p: string) => Promise<unknown> } } }
    } })?.__vue_app__
    const router = app?.config?.globalProperties?.$router
    if (!router) return false
    // 회귀(watch 안 throw) 시 push 가 reject 될 수 있다. 여기서 죽으면 실패 메시지가
    // push 예외를 가리키므로, 삼키고 아래 렌더 어서션이 진짜 증상을 가리키게 한다.
    await router.push(path).catch(() => {})
    return true
  }, `/childcare/${missingId}`)

  // 라우터를 못 잡았으면 이 테스트는 아무것도 검증하지 못한다 — 조용히 통과시키지 않는다
  expect(pushed, 'Nuxt 라우터를 잡지 못했다 (하이드레이션 미완료?)').toBe(true)

  await expect(page).toHaveURL(new RegExp(`/childcare/${missingId}$`))

  // 3) 에러 페이지가 실제로 렌더돼야 한다
  await expect(page.getByRole('heading', { level: 1, name: '페이지를 찾을 수 없습니다' })).toBeVisible()

  // 4) 빈 페이지 + 사이트 기본 title 유출이 아니어야 한다
  await expect(page).not.toHaveTitle(/^일상킷 - 부동산 실거래가·청약·내 주변 생활정보$/)
  await expect(page).toHaveTitle(/페이지를 찾을 수 없습니다/)
})
