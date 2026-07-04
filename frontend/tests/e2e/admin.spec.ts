import { expect, test } from '@playwright/test'

// 어드민 E2E는 실행 중인 로컬 백엔드(:8000)에 의존한다 —
// ADMIN_PASSWORD_HASH(테스트 비밀번호의 bcrypt 해시)가 설정된 백엔드가 필요하다.
// 표준 CI job(lint+test+build)에는 이 값들이 없어 전체 스킵된다.
// 로컬 실행: ADMIN_TEST_PASSWORD=<원문 비밀번호> npm run test:e2e -- admin.spec.ts --project=chromium
test.describe('어드민 로그인 → 검토 → 발행', () => {
  test.skip(!process.env.ADMIN_TEST_PASSWORD, 'requires ADMIN_TEST_PASSWORD + running backend with matching ADMIN_PASSWORD_HASH')

  test('비로그인 상태로 /admin 접근 시 /admin/login으로 리다이렉트된다', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', '어드민 플로우는 chromium 프로젝트에서만 검증(--project=chromium)')

    await page.goto('/admin')
    await expect(page).toHaveURL(/\/admin\/login$/)
    await expect(page.getByRole('heading', { name: '어드민 로그인' })).toBeVisible()
  })

  test('로그인 → 대시보드 → 초안 검토 → 발행', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', '어드민 플로우는 chromium 프로젝트에서만 검증(--project=chromium)')

    const password = process.env.ADMIN_TEST_PASSWORD as string

    // 1. 로그인
    await page.goto('/admin/login')
    await page.locator('#admin-password').fill(password)
    await page.getByRole('button', { name: '로그인' }).click()

    await expect(page).toHaveURL(/\/admin$/)
    await expect(page.getByRole('heading', { name: '오늘의 이슈 어드민' })).toBeVisible()

    // 2. 초안 필터로 좁혀 검토할 draft 확보. 생성은 백엔드가 spawn하는 detached 백그라운드
    //    프로세스(즉시 202 응답)이고, 대시보드는 생성 트리거 직후 1회 load()만 하고
    //    이후 재조회하지 않으므로 방금 생성된 초안은 DOM에 나타나지 않는다.
    //    따라서 라이브 생성은 트리거하지 않고, 사전 존재하는 draft에만 의존한다 — 없으면 skip.
    await page.getByTestId('filter-draft').click()

    const draftCard = page.getByTestId('admin-article-card').first()
    const hasDraft = await draftCard.isVisible().catch(() => false)

    test.skip(!hasDraft, 'no pre-existing draft to review — seed a draft (run generate:article) before running this E2E')

    // 3. 초안 선택 → 편집기 + 마크다운 미리보기 렌더 확인
    await draftCard.click()
    await expect(page.getByTestId('editor-title')).toBeVisible()
    const preview = page.getByTestId('editor-preview')
    await expect(preview).toBeVisible()
    await expect(async () => {
      const html = await preview.innerHTML()
      expect(html.trim().length).toBeGreaterThan(0)
    }).toPass()

    // 4. 발행 — confirm 다이얼로그 자동 수락
    page.once('dialog', (dialog) => dialog.accept())
    await page.getByTestId('publish-button').click()

    // 5. 발행 후 상태 갱신 확인 — 편집기 상단 상태 배지가 "발행됨"으로 바뀐다.
    //    (page.getByText('발행됨')은 좌측 필터 버튼과도 매치되므로 <section>=편집기 영역으로 스코핑)
    const editorSection = page.locator('section')
    await expect(editorSection.getByText('발행됨', { exact: true })).toBeVisible()
  })
})
