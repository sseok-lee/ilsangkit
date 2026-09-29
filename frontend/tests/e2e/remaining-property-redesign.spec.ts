import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

const api = 'http://127.0.0.1:18080'
const evidence = resolve('../.superpowers/remaining-pages/property/e2e')
const landPath = '/real-estate/land/seoul/gangnam/역삼동'
test.setTimeout(120_000)
async function control(request: APIRequestContext, settings: { failNext?: number; delayMs?: number } = {}) {
  expect((await request.post(`${api}/__test/remaining-pages`, { data: { domain: 'property', ...settings } })).ok()).toBe(true)
}
async function hydrated(page: Page) {
  await page.waitForFunction(() => {
    const root = document.querySelector('#__nuxt') as Element & { __vue_app__?: { config: { globalProperties: { $nuxt?: { isHydrating: boolean } } } } }
    return root?.__vue_app__?.config.globalProperties.$nuxt?.isHydrating === false
  })
}
test.beforeEach(async ({ request, page }) => {
  mkdirSync(evidence, { recursive: true }); await control(request)
  await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort())
})
test.afterEach(async ({ request }) => { await request.post(`${api}/__test/remaining-pages`, { data: { domain: null } }) })

test('filters and page two are present in SSR without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false })
  const page = await context.newPage()
  expect((await page.goto('http://127.0.0.1:13000/auction/list?page=2'))?.status()).toBe(200)
  await expect(page.locator('main a[href^="/auction/item/remaining-"]')).toHaveCount(12)
  await page.goto(`http://127.0.0.1:13000${landPath}?jimok=대&landUse=제2종일반주거지역&page=2`)
  await expect(page.locator('#land-tx-jimok option:checked')).toHaveText('대')
  await expect(page.locator('#land-tx-land-use option:checked')).toHaveText('제2종일반주거지역')
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, follow')
  await expect(page.locator('link[rel="canonical"]')).toHaveCount(0)
  await expect(page.getByText(/최대 20건 표본/)).toBeVisible()
  const transactions = page.locator('section').filter({ has: page.locator('#land-tx-keyword') })
  await expect(transactions.getByRole('columnheader', { name: '거래금액', exact: true })).toBeVisible()
  await expect(transactions.getByRole('cell', { name: '검증-3', exact: true })).toBeVisible()
  await expect(transactions.getByRole('cell', { name: '2026.09', exact: true })).toBeVisible()
  await expect(transactions.getByText('.??', { exact: false })).toHaveCount(0)
  await context.close()
})

test('legacy ongoing includes scheduled while exact scheduled is isolated', async ({ page }) => {
  await page.goto('/auction/list?status=scheduled&statusMode=exact'); await hydrated(page)
  const rows = page.locator('main a[href^="/auction/item/remaining-"]')
  await expect(rows).toHaveCount(5)
  await expect(rows.first()).toContainText('입찰예정')
  await page.goto('/auction/list?status=ongoing'); await hydrated(page)
  await expect(rows).toHaveCount(10)
  await expect(rows.first()).toContainText('진행중')
  await expect(page.getByLabel('상태')).toHaveValue('ongoing')
})

test('row whitespace and keyboard open separate detail URLs; back keeps page two', async ({ page }) => {
  await page.goto('/auction/list?q=검증물건&page=2'); await hydrated(page)
  const first = page.locator('main a[href^="/auction/item/remaining-"]').first()
  const href = await first.getAttribute('href')
  const box = await first.boundingBox()
  await first.click({ position: { x: box!.width - 3, y: 5 } }); await hydrated(page)
  expect(new URL(page.url()).pathname).toBe(href)
  await expect(page.locator('main a[href^="https://www.onbid.co.kr/"]')).toHaveCount(1)
  await expect(page.getByText('위치 좌표가 제공되지 않아 지도를 표시할 수 없습니다.', { exact: true })).toBeVisible()
  await page.goBack(); await hydrated(page)
  await expect(page).toHaveURL(/page=2/)
  await first.focus(); await page.keyboard.press('Enter'); await hydrated(page)
  expect(new URL(page.url()).pathname).toBe(href)
})

test('ranking search is submitted to API and server order survives history', async ({ page }) => {
  const requests: string[] = []
  page.on('request', request => { if (request.url().includes('/api/auction/ranking')) requests.push(request.url()) })
  await page.goto('/auction/ranking'); await hydrated(page)
  await expect(page.locator('link[rel="canonical"]')).toHaveCount(1)
  await page.getByLabel('지역명 검색').fill('강남')
  await expect(page).toHaveURL(/\/auction\/ranking$/)
  await page.getByRole('button', { name: '검색', exact: true }).click()
  await expect(page).toHaveURL(/q=/)
  await expect(page.locator('tbody tr')).toHaveCount(2)
  expect(requests.some(url => new URL(url).searchParams.get('keyword') === '강남')).toBe(true)
  await expect(page.locator('link[rel="canonical"]')).toHaveCount(0)
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, follow')
  await page.getByLabel('정렬 기준').selectOption('count')
  await expect(page.locator('tbody tr').first()).toContainText('12건')
  await page.goBack(); await page.goBack()
  await expect(page).toHaveURL(/\/auction\/ranking$/)
  await expect(page.locator('link[rel="canonical"]')).toHaveCount(1)
})

test('empty, failure, retry and newest ranking request stay distinct', async ({ page, request }) => {
  await page.goto('/auction/ranking?q=없는지역'); await hydrated(page)
  await expect(page.getByText('낙찰 데이터가 없습니다', { exact: true })).toBeVisible()
  await control(request, { failNext: 20 })
  expect((await page.goto('/auction/ranking'))?.status()).toBe(503); await hydrated(page)
  await expect(page.getByRole('alert')).toContainText('불러오지 못했습니다')
  await control(request)
  await page.getByRole('button', { name: '다시 시도' }).click()
  await expect(page.locator('tbody tr')).toHaveCount(3)
  await control(request, { delayMs: 700 })
  await page.getByLabel('지역명 검색').fill('강남'); await page.getByRole('button', { name: '검색', exact: true }).click()
  await expect(page.getByRole('status')).toBeVisible()
  await page.getByLabel('지역명 검색').fill('송파'); await page.getByRole('button', { name: '검색', exact: true }).click()
  await expect(page.locator('tbody tr')).toHaveCount(1)
  await expect(page.locator('tbody')).toContainText('송파구')
})

test('all ten property routes fit four widths without hydration errors', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (/hydration.*mismatch/i.test(message.text())) errors.push(message.text()) })
  const routes = ['/real-estate/land', '/real-estate/land/seoul', '/real-estate/land/seoul/gangnam', landPath,
    '/auction', '/auction/seoul', '/auction/seoul/gangnam', '/auction/list', '/auction/ranking', '/auction/item/remaining-003']
  for (const width of [360, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    for (const route of routes) {
      expect((await page.goto(route))?.status(), route).toBe(200); await hydrated(page)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), route).toBe(true)
      if (width === 390 || width === 1440) await page.screenshot({ path: resolve(evidence, `${route.replace(/[^a-z0-9]/gi, '-')}-${width}.png`), fullPage: true })
    }
  }
  expect(errors).toEqual([])
})


test('land and auction list retry recover from 503 without presenting a false zero', async ({ page, request }) => {
  for (const path of [landPath, '/auction/list']) {
    await control(request, { failNext: 20 })
    expect((await page.goto(path))?.status()).toBe(503); await hydrated(page)
    await expect(page.getByRole('alert')).toContainText('불러오지 못했습니다')
    await control(request)
    await page.getByRole('button', { name: '다시 시도', exact: true }).click()
    await expect(page.getByRole('alert')).toHaveCount(0)
    if (path === landPath) await expect(page.locator('#land-tx-jimok')).toBeVisible()
    else await expect(page.locator('main a[href^="/auction/item/remaining-"]')).toHaveCount(20)
  }
})
