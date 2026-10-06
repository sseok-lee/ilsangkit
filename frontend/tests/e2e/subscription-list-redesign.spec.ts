import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test } from '@playwright/test'
import type { APIRequestContext, Page } from '@playwright/test'

const evidenceDir = resolve(process.cwd(), '../.superpowers/subscription-list-redesign')
const shotDir = resolve(process.cwd(), 'test-results/subscription-list-redesign')

test.setTimeout(90_000)

function ensureDirs() {
  mkdirSync(evidenceDir, { recursive: true })
  mkdirSync(shotDir, { recursive: true })
}

async function resetFixture(request: APIRequestContext) {
  await request.post('http://127.0.0.1:18080/__test/subscription-list/reset')
}

async function controlFixture(request: APIRequestContext, body: Record<string, unknown>) {
  return request.post('http://127.0.0.1:18080/__test/subscription-list/control', { data: body })
}

async function waitForHydrated(page: Page) {
  await expect(page.getByRole('searchbox', { name: '공고명 또는 지역 검색' })).toBeVisible()
  await page.waitForFunction(() => {
    const root = document.querySelector('#__nuxt') as (Element & { __vue_app__?: { $nuxt?: { isHydrating?: boolean } } }) | null
    return Boolean(root?.__vue_app__?.$nuxt && root.__vue_app__.$nuxt.isHydrating === false)
  })
  await expect(page.locator('[data-testid="list-skeleton"]')).toHaveCount(0)
}

async function rows(page: Page) {
  return page.locator('.notice-row')
}

test.beforeEach(async ({ request }) => {
  ensureDirs()
  await resetFixture(request)
})

test('hub shows real totals while displaying four rows and keeps successful panels on partial 503', async ({ page, request }) => {
  let response = await page.goto('/subscription')
  expect(response?.status()).toBe(200)
  await expect(page.locator('[data-panel="sale"] .notice-row')).toHaveCount(4)
  await expect(page.locator('[data-panel="sale"] .panel-total')).toContainText('43건')
  await expect(page.locator('[data-panel="public-rent"] .notice-row')).toHaveCount(4)

  await controlFixture(request, { emptyNextList: 1 })
  const zeroPage = await page.context().newPage()
  response = await zeroPage.goto('/subscription')
  expect(response?.status()).toBe(200)
  await expect(zeroPage.locator('[data-panel="sale"] .panel-total')).toContainText('0건')
  await expect(zeroPage.locator('[data-panel="sale"] .state-box')).toContainText('현재 접수 중인 분양 공고가 없습니다')
  await expect(zeroPage.locator('[data-panel="public-rent"] .notice-row')).toHaveCount(4)
  await zeroPage.close()

  await controlFixture(request, { failNextList: 2 })
  const partialPage = await page.context().newPage()
  response = await partialPage.goto('/subscription')
  expect(response?.status()).toBe(503)
  await expect(partialPage.locator('[data-panel="sale"] .panel-total')).toContainText('조회 실패')
  await expect(partialPage.locator('[data-panel="public-rent"] .notice-row')).toHaveCount(4)
  await expect(partialPage.locator('.upcoming-panel .notice-row')).toHaveCount(4)
  await partialPage.close()
})

test('hub tabs keep real totals when revisiting sale and rent without reloading', async ({ page }) => {
  await page.goto('/subscription')
  await page.waitForFunction(() => {
    const root = document.querySelector('#__nuxt') as (Element & { __vue_app__?: { $nuxt?: { isHydrating?: boolean } } }) | null
    return root?.__vue_app__?.$nuxt?.isHydrating === false
  })
  const nav = page.getByRole('navigation', { name: '청약 주요 경로' })
  for (let visit = 0; visit < 2; visit++) {
    await nav.getByRole('link', { name: '분양', exact: true }).click()
    await expect(page).toHaveURL(/\/subscription\/sale$/)
    await expect(await rows(page)).toHaveCount(20)
    await expect(page.locator('#subscription-results')).toContainText('총 50건')

    await nav.getByRole('link', { name: '임대', exact: true }).click()
    await expect(page).toHaveURL(/\/subscription\/rent$/)
    await expect(await rows(page)).toHaveCount(20)
    await expect(page.locator('#subscription-results')).toContainText('총 51건')

    await nav.getByRole('link', { name: '한눈에 보기', exact: true }).click()
    await expect(page).toHaveURL(/\/subscription$/)
    await expect(page.locator('[data-panel="sale"] .notice-row')).toHaveCount(4)
  }

  await page.goBack()
  await expect(page).toHaveURL(/\/subscription\/rent$/)
  await expect(await rows(page)).toHaveCount(20)
  await expect(page.locator('#subscription-results')).toContainText('총 51건')
  await page.goForward()
  await expect(page).toHaveURL(/\/subscription$/)
  await expect(page.locator('[data-panel="sale"] .notice-row')).toHaveCount(4)
})

test('filtered URL is rendered by real SSR and remains hydrated with the same filters', async ({ browser, page, request }) => {
  const path = '/subscription/rent/public?city=서울&district=강남구&q=매입&status=ongoing'
  const response = await request.get(path)
  expect(response.status()).toBe(200)
  const html = await response.text()
  expect(html).toContain('서울 강남 매입 공고')
  expect(html).toMatch(/noindex, follow/)
  expect(html).not.toMatch(/rel="canonical"/)

  const noJs = await browser.newContext({ javaScriptEnabled: false, baseURL: 'http://127.0.0.1:13000' })
  const noJsPage = await noJs.newPage()
  await noJsPage.goto(path)
  await expect(noJsPage.getByRole('link', { name: /서울 강남 매입 공고/ }).first()).toBeVisible()
  await noJs.close()

  await page.goto(path)
  await waitForHydrated(page)
  await expect(page.getByRole('combobox', { name: '시/도 선택' })).toHaveValue('서울')
  await expect(page.getByRole('combobox', { name: '구/군 선택' })).toHaveValue('강남구')
  await expect(page.getByRole('searchbox', { name: '공고명 또는 지역 검색' })).toHaveValue('매입')
  await expect((await rows(page)).first()).toBeVisible()
  const control = await controlFixture(request, {})
  const body = await control.json()
  expect(body.data.subscriptionListRequests.at(-1).region).toBe('서울 강남구')
})

test('routes, subtypes, normalized metadata, and invalid subtype status are stable', async ({ page, request }) => {
  const goodRoutes = [
    '/subscription',
    '/subscription/sale',
    '/subscription/sale/apt',
    '/subscription/sale/offitel',
    '/subscription/sale/remaining',
    '/subscription/sale/optional',
    '/subscription/rent',
    '/subscription/rent/public',
    '/subscription/rent/private',
  ]
  for (const route of goodRoutes) {
    const response = await request.get(route)
    expect(response.status(), route).toBe(200)
  }

  expect((await request.get('/subscription/sale/unknown')).status()).toBe(404)

  await page.goto('/subscription/sale?status=all&sort=priority')
  await waitForHydrated(page)
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/subscription\/sale$/)

  await page.goto('/subscription/rent/public?q=매입')
  await waitForHydrated(page)
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex, follow/)
  await expect(page.locator('link[rel="canonical"]')).toHaveCount(0)
})

test('search applies on submit, load-more retries page 2, and share URLs start at first 20', async ({ page, request }) => {
  await page.goto('/subscription/rent/public')
  await waitForHydrated(page)
  await expect(await rows(page)).toHaveCount(20)

  const search = page.getByRole('searchbox', { name: '공고명 또는 지역 검색' })
  await search.fill('수원')
  await page.waitForTimeout(150)
  let control = await controlFixture(request, {})
  let body = await control.json()
  const beforeSubmitRequests = body.data.subscriptionListRequests.length
  await expect(await rows(page)).toHaveCount(20)

  await search.press('Enter')
  await expect(page).toHaveURL(/q=%EC%88%98%EC%9B%90/)
  await expect((await rows(page)).first()).toContainText('외 1개 지역')
  control = await controlFixture(request, {})
  body = await control.json()
  expect(body.data.subscriptionListRequests.length).toBeGreaterThan(beforeSubmitRequests)
  expect(body.data.subscriptionListRequests.at(-1).q).toBe('수원')

  await controlFixture(request, { failNextList: 2 })
  await page.getByTestId('load-more').click()
  await expect(page.getByTestId('load-more-retry')).toBeVisible()
  await page.getByTestId('load-more-retry').click()
  await expect(await rows(page)).toHaveCount(40)
  control = await controlFixture(request, {})
  body = await control.json()
  const pageTwoRequests = body.data.subscriptionListRequests.filter(entry => entry.page === '2')
  expect(pageTwoRequests.length).toBeGreaterThanOrEqual(2)

  await page.goto('/subscription/rent/public?q=수원')
  await waitForHydrated(page)
  await expect(await rows(page)).toHaveCount(20)
})


test('list 503 retries the same page without exposing raw errors or stale counts', async ({ page, request }) => {
  await page.setViewportSize({ width: 390, height: 900 })
  await controlFixture(request, { failNextList: 4 })
  const response = await page.goto('/subscription/rent/public?q=수원')
  expect(response?.status()).toBe(503)
  await waitForHydrated(page)
  await expect(page).toHaveURL(/q=%EC%88%98%EC%9B%90/)
  const alert = page.getByRole('alert')
  await expect(alert).toBeVisible()
  await expect(alert).toContainText('청약 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.')
  await expect(alert).not.toContainText('/api/subscription')
  await expect(alert).not.toContainText('503 Service Unavailable')
  await expect(page.locator('#subscription-results')).toHaveText(/조회 결과를 불러오지 못했습니다/)
  await expect(page.locator('#subscription-results')).not.toContainText(/건 표시 \/ 총/)
  await expect(page.locator('.notice-row')).toHaveCount(0)
  await expect.poll(async () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), {
    message: '390px error state should not overflow horizontally',
  }).toBeLessThanOrEqual(0)
  await page.setViewportSize({ width: 360, height: 900 })
  await expect.poll(async () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), {
    message: '360px error state should not overflow horizontally',
  }).toBeLessThanOrEqual(0)

  await controlFixture(request, { failNextList: 0 })
  await page.getByRole('button', { name: '다시 시도' }).click()
  await expect(await rows(page)).toHaveCount(20)
  const control = await controlFixture(request, {})
  const body = await control.json()
  const pageOne = body.data.subscriptionListRequests.filter(entry => entry.page === '1' && entry.q === '수원')
  expect(pageOne.length).toBeGreaterThanOrEqual(2)
  expect(pageOne.at(-1).failed).toBeUndefined()
})

test('region failure does not widen the URL and slow races keep latest filters', async ({ page, request }) => {
  await controlFixture(request, { failNextRegions: 2 })
  const response = await page.goto('/subscription/rent/public?city=서울&district=강남구')
  expect(response?.status()).toBe(503)
  await expect(page).toHaveURL(/city=%EC%84%9C%EC%9A%B8/)

  await resetFixture(request)
  await page.goto('/subscription/rent/public')
  await waitForHydrated(page)
  await controlFixture(request, { delayMs: 300 })
  await page.getByRole('searchbox', { name: '공고명 또는 지역 검색' }).fill('서울')
  await page.getByRole('button', { name: '검색' }).click()
  await expect(page).toHaveURL(/q=%EC%84%9C%EC%9A%B8/)
  await page.getByRole('searchbox', { name: '공고명 또는 지역 검색' }).fill('수원')
  await page.getByRole('button', { name: '검색' }).click()
  await expect(page).toHaveURL(/q=%EC%88%98%EC%9B%90/)
  await expect.poll(async () => {
    const control = await controlFixture(request, {})
    const body = await control.json()
    return body.data.subscriptionListRequests.some(entry => entry.q === '수원')
  }).toBe(true)
  await expect(page.getByRole('searchbox', { name: '공고명 또는 지역 검색' })).toHaveValue('수원')
  await expect((await rows(page)).first()).toContainText('외 1개 지역')
})

test('filtered detail back restores pushed-history rows and scroll position without another list fetch', async ({ page, request }) => {
  await page.goto('/subscription/rent/public')
  await waitForHydrated(page)
  await page.getByRole('radio', { name: '접수 중' }).click()
  await expect(page).toHaveURL(/status=ongoing/)
  await expect(await rows(page)).toHaveCount(20)
  await page.getByTestId('load-more').click()
  await expect(await rows(page)).toHaveCount(40)
  let control = await controlFixture(request, {})
  let body = await control.json()
  const beforeRequestCount = body.data.subscriptionListRequests.length

  await page.evaluate(() => window.scrollTo(0, 900))
  const detailLink = page.locator('a[href="/subscription/90002"]')
  await detailLink.scrollIntoViewIfNeeded()
  const before = await page.evaluate(() => window.scrollY)
  await detailLink.click()
  await expect(page).toHaveURL(/\/subscription\/90002$/)
  await expect(page.locator('h1')).toBeVisible()
  await page.goBack({ waitUntil: 'networkidle' })
  await waitForHydrated(page)
  await expect(page).toHaveURL(/status=ongoing/)
  await expect(await rows(page)).toHaveCount(40)
  const after = await page.evaluate(() => window.scrollY)
  expect(Math.abs(after - before)).toBeLessThanOrEqual(20)
  control = await controlFixture(request, {})
  body = await control.json()
  expect(body.data.subscriptionListRequests.length).toBe(beforeRequestCount)
})


test('expired detail-back restore falls back to a fresh first page and result start', async ({ page, request }) => {
  await page.clock.install()
  await page.goto('/subscription/rent/public')
  await waitForHydrated(page)
  await page.getByTestId('load-more').click()
  await expect(await rows(page)).toHaveCount(40)
  let control = await controlFixture(request, {})
  let body = await control.json()
  const beforeRequestCount = body.data.subscriptionListRequests.length

  await page.evaluate(() => window.scrollTo(0, 900))
  const detailLink = page.locator('a[href="/subscription/90002"]')
  await detailLink.scrollIntoViewIfNeeded()
  await detailLink.click()
  await expect(page).toHaveURL(/\/subscription\/90002$/)
  await page.clock.fastForward(301_000)
  await page.goBack({ waitUntil: 'networkidle' })
  await waitForHydrated(page)
  await expect(await rows(page)).toHaveCount(20)
  await expect.poll(() => page.locator('#subscription-results').evaluate((el) => {
    const targetStyle = getComputedStyle(el)
    const rootStyle = getComputedStyle(document.documentElement)
    const expectedTop = (Number.parseFloat(targetStyle.scrollMarginTop) || 0) + (Number.parseFloat(rootStyle.scrollPaddingTop) || 0)
    return Math.abs(el.getBoundingClientRect().top - expectedTop)
  })).toBeLessThanOrEqual(20)
  control = await controlFixture(request, {})
  body = await control.json()
  expect(body.data.subscriptionListRequests.length).toBeGreaterThan(beforeRequestCount)
})

test('responsive screenshots have no horizontal overflow across primary states', async ({ page }) => {
  const scenarios = [
    { name: 'sale', path: '/subscription/sale' },
    { name: 'rent-empty', path: '/subscription/rent/public?q=없는공고' },
    { name: 'rent-long-unknown', path: '/subscription/rent/public?status=unknown' },
  ]
  const viewports = [
    { width: 360, height: 900 },
    { width: 390, height: 900 },
    { width: 768, height: 1024 },
    { width: 1440, height: 1100 },
  ]
  const evidence = []

  for (const scenario of scenarios) {
    for (const viewport of viewports) {
      await page.setViewportSize(viewport)
      await page.goto(scenario.path)
      await waitForHydrated(page)
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      expect(overflow, `${scenario.name}-${viewport.width}`).toBeLessThanOrEqual(0)
      const screenshot = resolve(shotDir, `${scenario.name}-${viewport.width}.png`)
      await page.screenshot({ path: screenshot, fullPage: true })
      evidence.push({ ...scenario, viewport, overflow, screenshot })
    }
  }

  await page.goto('/subscription/rent/public')
  await waitForHydrated(page)
  await page.keyboard.press('Tab')
  await page.keyboard.press('Tab')
  await expect(page.locator(':focus')).toBeVisible()
  await page.getByTestId('load-more').click()
  await expect(await rows(page)).toHaveCount(40)
  await expect(page.locator('.notice-name').nth(20)).toBeFocused()

  writeFileSync(resolve(evidenceDir, 'task-8-browser-evidence.json'), JSON.stringify(evidence, null, 2))
})
