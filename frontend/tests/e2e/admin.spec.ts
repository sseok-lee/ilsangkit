import { expect, test } from '@playwright/test'

// 어드민 E2E는 실행 중인 로컬 백엔드(:8000)에 의존한다 —
// ADMIN_PASSWORD_HASH(테스트 비밀번호의 bcrypt 해시)가 설정된 백엔드가 필요하다.
// 표준 CI job(lint+test+build)에는 이 값들이 없어 전체 스킵된다.
// 로컬 실행: ADMIN_TEST_PASSWORD=<원문 비밀번호> npm run test:e2e -- admin.spec.ts --project=chromium
test.describe('어드민 로그인 → 검토 → 발행', () => {
  test.skip(!process.env.ADMIN_TEST_PASSWORD, 'requires ADMIN_TEST_PASSWORD + running backend with matching ADMIN_PASSWORD_HASH')

  test('비로그인 상태로 /admin 접근 시 /admin/login으로 리다이렉트된다', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', '어드민 플로우는 chromium에서만 검증(--project=chromium)')

    await page.goto('/admin')
    await expect(page).toHaveURL(/\/admin\/login$/)
    await expect(page.getByRole('heading', { name: '어드민 로그인' })).toBeVisible()
  })

  test('로그인 → 대시보드 → 초안 검토 → 발행', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', '어드민 플로우는 chromium에서만 검증(--project=chromium)')

    const password = process.env.ADMIN_TEST_PASSWORD as string

    // 1. 로그인
    await page.goto('/admin/login')
    await page.locator('#admin-password').fill(password)
    await page.getByRole('button', { name: '로그인' }).click()

    await expect(page).toHaveURL(/\/admin$/)
    await expect(page.getByRole('heading', { name: '오늘의 이슈 어드민' })).toBeVisible()

    // 2. 초안 필터로 좁혀 검토할 draft 확보. 없으면 "지금 생성"으로 트리거해보고,
    //    그래도(키 미설정 등으로) 확보 실패하면 하드-fail 대신 skip한다.
    await page.getByTestId('filter-draft').click()

    const draftCard = page.getByTestId('admin-article-card').first()
    let hasDraft = await draftCard.isVisible().catch(() => false)

    if (!hasDraft) {
      await page.getByTestId('generate-button').click()
      // 생성 트리거 직후 키 미설정(GENERATION_NOT_CONFIGURED 등) 시 에러 배너가 뜬다 — 잠시 대기 후 확인.
      await page.waitForTimeout(3000)
      const generateFailed = await page.getByTestId('error').isVisible().catch(() => false)
      test.skip(generateFailed, '초안 생성 트리거 실패(OPENAI/NAVER 키 미설정 등) — 발행 플로우 검증용 초안을 확보하지 못했다')

      // 백그라운드 생성(LLM 호출 포함)이 끝나 초안이 목록에 나타날 때까지 폴링.
      await expect(draftCard).toBeVisible({ timeout: 60_000 })
      hasDraft = true
    }

    test.skip(!hasDraft, '검토할 초안이 없어 발행 플로우를 검증할 수 없다')

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
