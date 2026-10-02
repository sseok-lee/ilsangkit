import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

const api = 'http://127.0.0.1:18080'
const evidence = resolve('../.superpowers/remaining-pages/editorial/e2e')
test.setTimeout(120_000)
async function control(request: APIRequestContext, settings: { failNext?: number; delayMs?: number } = {}) {
  expect((await request.post(`${api}/__test/remaining-pages`, { data: { domain: 'editorial', ...settings } })).ok()).toBe(true)
}
async function hydrated(page: Page) {
  await page.waitForFunction(() => {
    const root = document.querySelector('#__nuxt') as Element & { __vue_app__?: { config: { globalProperties: { $nuxt?: { isHydrating: boolean } } } } }
    return root?.__vue_app__?.config.globalProperties.$nuxt?.isHydrating === false
  })
}
async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
}
test.beforeEach(async ({ request, page }) => {
  mkdirSync(evidence, { recursive: true }); await control(request)
  await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort())
})
test.afterEach(async ({ request }) => {
  await request.post(`${api}/__test/remaining-pages`, { data: { domain: null } })
})

test('topic and second page are server rendered without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false })
  const page = await context.newPage()
  for (const kind of ['guide', 'article']) {
    const response = await page.goto(`http://127.0.0.1:13000/${kind}?topic=parking&page=2`)
    expect(response?.status()).toBe(200)
    await expect(page.locator(`main a[href^="/${kind}/remaining-"]`)).toHaveCount(1)
    await expect(page.getByRole('heading', { name: kind === 'guide' ? '주차 가이드13' : '주차 이슈13', exact: true })).toBeVisible()
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, follow')
    await expect(page.locator('link[rel="canonical"]')).toHaveCount(0)
  }
  await context.close()
})

test('featured guide remains one of twelve results and back restores topic/page', async ({ page }) => {
  await page.goto('/guide'); await hydrated(page)
  const links = page.locator('main a[href^="/guide/remaining-"]')
  await expect(links).toHaveCount(12)
  expect(new Set(await links.evaluateAll(elements => elements.map(el => el.getAttribute('href')))).size).toBe(12)
  await expect(page.locator('main img')).toHaveCount(0)
  await page.getByRole('button', { name: '주차·충전', exact: true }).click()
  await page.getByRole('link', { name: '2 페이지', exact: true }).click()
  await expect(page).toHaveURL(/topic=parking&page=2/)
  await page.getByRole('link', { name: /주차 가이드13/ }).click(); await hydrated(page)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('주차 가이드13')
  await page.goBack(); await hydrated(page)
  await expect(page).toHaveURL(/topic=parking&page=2/)
  await expect(page.getByRole('heading', { name: '주차 가이드13', exact: true })).toBeVisible()
  await page.getByRole('button', { name: '전체', exact: true }).click()
  await expect(page).toHaveURL(/\/guide$/)
  await expect(page.locator('link[rel="canonical"]')).toHaveCount(1)
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'index, follow')
})

test('unknown-chip categories remain accessible and empty results are distinct from failures', async ({ page, request }) => {
  await page.goto('/guide?page=3'); await hydrated(page)
  await expect(page.getByRole('link', { name: /주거 가이드25/ })).toContainText('도서관')
  await page.getByRole('button', { name: '병원·약국', exact: true }).click()
  await expect(page.getByText('해당 주제의 가이드가 아직 없습니다.', { exact: true })).toBeVisible()
  await expect(page.getByRole('alert')).toHaveCount(0)
  await control(request, { failNext: 20 })
  const response = await page.goto('/guide')
  expect(response?.status()).toBe(503)
  await hydrated(page)
  await expect(page.getByRole('alert')).toContainText('불러오지 못했습니다')
  await expect(page.getByText('전체 0건 · 최신순', { exact: true })).toHaveCount(0)
  await control(request)
  await page.getByRole('button', { name: '다시 시도', exact: true }).click()
  await expect(page.locator('main a[href^="/guide/remaining-"]')).toHaveCount(12)
})

test('rapid topic changes keep the newest request visible', async ({ page, request }) => {
  await page.goto('/article'); await hydrated(page)
  await control(request, { delayMs: 700 })
  await page.getByRole('button', { name: '주차·충전', exact: true }).click()
  await expect(page.getByRole('status')).toBeVisible()
  await expect(page.locator('main a[href^="/article/remaining-"]')).toHaveCount(0)
  await page.getByRole('navigation', { name: '주제 선택' }).getByRole('button', { name: '부동산', exact: true }).click()
  await expect(page).toHaveURL(/topic=real-estate/)
  await expect(page.getByRole('heading', { name: '주거 이슈14', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: '주차 이슈1', exact: true })).toHaveCount(0)
})

for (const kind of ['guide', 'article']) {
  test(`${kind} sanitized headings keep SSR IDs after hydration and TOC navigation`, async ({ browser, page }) => {
    const route = `/${kind}/remaining-${kind}-1`
    const context = await browser.newContext({ javaScriptEnabled: false })
    const serverPage = await context.newPage(); await serverPage.goto(`http://127.0.0.1:13000${route}`)
    const ids = await serverPage.locator('.prose h2, .prose h3').evaluateAll(elements => elements.map(el => el.id))
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toContain('existing-anchor'); await context.close()
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    page.on('console', message => { if (/hydration.*mismatch/i.test(message.text())) errors.push(message.text()) })
    await page.goto(route); await hydrated(page)
    expect(await page.locator('.prose h2, .prose h3').evaluateAll(elements => elements.map(el => el.id))).toEqual(ids)
    expect(errors).toEqual([])
    await expect(page.locator('.prose script, .prose [onerror], .prose a[href^="javascript:"]')).toHaveCount(0)
    await page.getByRole('link', { name: '기존 제목', exact: true }).filter({ visible: true }).click()
    await expect(page).toHaveURL(/#existing-anchor$/)
    expect(await page.locator('#existing-anchor').evaluate(el => el.getBoundingClientRect().top)).toBeGreaterThanOrEqual(80)
    await expect(page.locator('.prose a[href="https://www.data.go.kr"]')).toHaveCount(1)
  })
}

test('ten editorial routes fit all four widths and preserve keyboard/contact/legal navigation', async ({ page }) => {
  const routes = ['/guide', '/guide?page=2', '/article', '/guide/remaining-guide-1', '/article/remaining-article-1', '/about', '/faq', '/contact', '/privacy', '/terms']
  for (const width of [360, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    for (const route of routes) {
      expect((await page.goto(route))?.status()).toBe(200); await hydrated(page); await noOverflow(page)
      if (width === 390 || width === 1440) await page.screenshot({ path: resolve(evidence, `${route.replace(/[^a-z0-9]/gi, '-')}-${width}.png`), fullPage: true })
    }
  }
  await page.goto('/faq'); await hydrated(page)
  await page.getByRole('navigation', { name: '질문 주제' }).getByRole('radio', { name: '생활시설', exact: true }).click()
  await expect(page.getByRole('heading', { name: '부동산 실거래가', exact: true })).toBeHidden()
  await page.getByRole('radio', { name: '전체', exact: true }).click()
  await page.locator('summary').first().focus(); await page.keyboard.press('Enter')
  await expect(page.locator('details').first()).toHaveAttribute('open', '')
  await page.setViewportSize({ width: 390, height: 900 }); await page.goto('/privacy'); await hydrated(page)
  await page.getByText('문서 목차', { exact: true }).click()
  await page.getByRole('link', { name: '2. 수집하는 개인정보 항목', exact: true }).filter({ visible: true }).click()
  await expect(page).toHaveURL(/#clause-2$/)
  await page.getByRole('link', { name: '이용약관', exact: true }).first().click()
  await expect(page).toHaveURL(/\/terms$/)
  await page.goto('/contact')
  await expect(page.locator('main a[href="mailto:contact@ilsangkit.co.kr"]')).toHaveCount(1)
  await expect(page.locator('main form')).toHaveCount(0)
})
