import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

const api = 'http://127.0.0.1:18080'
const app = 'http://127.0.0.1:13000'
const evidence = resolve('../.superpowers/waste-area-discovery/screenshots/w10')

test.setTimeout(120_000)

async function control(request: APIRequestContext, settings: Record<string, unknown> = {}) {
  const response = await request.post(`${api}/__test/waste-area`, { data: { active: true, ...settings } })
  expect(response.ok()).toBe(true)
}

async function fixtureState(request: APIRequestContext) {
  const response = await request.get(`${api}/__test/waste-area`)
  expect(response.ok()).toBe(true)
  return (await response.json()).data as { requests: string[] }
}

async function reset(request: APIRequestContext) {
  const response = await request.post(`${api}/__test/waste-area`, { data: { reset: true, active: true } })
  expect(response.ok()).toBe(true)
}

async function hydrated(page: Page) {
  await page.waitForFunction(() => {
    const root = document.querySelector('#__nuxt') as Element & { __vue_app__?: { config: { globalProperties: { $nuxt?: { isHydrating: boolean } } } } }
    return root?.__vue_app__?.config.globalProperties.$nuxt?.isHydrating === false
  })
}

async function blockExternal(page: Page) {
  await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort('blockedbyclient'))
}

async function noOverflow(page: Page, route: string) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), route).toBe(true)
}

async function waitForAppPath(page: Page, path: string | RegExp) {
  await page.waitForURL((url) => typeof path === 'string' ? url.pathname === path : path.test(url.pathname + url.search))
  await hydrated(page)
}

test.beforeEach(async ({ request, page }) => {
  mkdirSync(evidence, { recursive: true })
  await reset(request)
  await blockExternal(page)
})

test.afterEach(async ({ request }) => {
  await request.post(`${api}/__test/waste-area`, { data: { reset: true, active: false } })
})

test('shows area choices on the server and follows the selected area', async ({ browser, request }) => {
  await reset(request)
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL: app })
  const page = await context.newPage()
  await blockExternal(page)
  expect((await page.goto('/trash?city=서울특별시&district=강남구&keyword=역삼'))?.status()).toBe(200)
  await expect(page.getByRole('link', { name: /역삼1동/ }).first()).toHaveAttribute('href', '/trash/areas/1')
  await expect(page.getByRole('link', { name: /역삼2동/ }).first()).toBeVisible()
  await page.getByRole('link', { name: /역삼1동/ }).first().click()
  await expect(page.getByRole('heading', { name: /역삼1동/, level: 1 })).toBeVisible()
  await expect(page.getByText('공통 원본 전체 적용')).toBeVisible()
  await page.goto('/trash/areas/210')
  await expect(page.getByText(/21조건/)).toHaveCount(21)
  await context.close()
})

test('preserves facilities and unified-search navigation through area, source, and back links', async ({ page }) => {
  await page.goto('/facilities?city=seoul&district=gangnam&category=trash')
  await hydrated(page)
  await expect(page.getByRole('link', { name: /역삼1동 배출 안내/ })).toHaveAttribute('href', '/trash/areas/1')
  await page.getByRole('link', { name: /역삼1동 배출 안내/ }).click()
  await waitForAppPath(page, '/trash/areas/1')
  await expect(page.getByRole('heading', { name: /역삼1동/, level: 1 })).toBeVisible()
  await page.getByRole('link', { name: /원문 보기/ }).first().click()
  await waitForAppPath(page, '/trash/1001')
  await expect(page.locator('main').getByText('원본 배출 일정').first()).toBeVisible()
  await page.getByRole('link', { name: '동별 안내로 돌아가기' }).click()
  await waitForAppPath(page, '/trash/areas/1')
  await page.getByRole('link', { name: '목록으로 돌아가기' }).click()
  await waitForAppPath(page, '/facilities')

  await page.goto('/search?q=역삼%20쓰레기&tab=facilities')
  await hydrated(page)
  await expect(page.getByRole('link', { name: /역삼1동 배출 안내/ }).first()).toHaveAttribute('href', '/trash/areas/1')
})

test('restores page two, removes SEO query state, and avoids legacy back-loop redirects', async ({ page, request }) => {
  await page.goto('/trash?city=서울특별시&district=강남구&page=2')
  await hydrated(page)
  await expect(page).toHaveURL(/page=2/)
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, follow')
  await expect(page.locator('link[rel="canonical"]')).toHaveCount(0)
  await expect(page.locator('main a[href="/trash/areas/220"]').first()).toBeVisible()

  await page.evaluate(() => window.scrollTo(0, Math.min(480, Math.max(0, document.documentElement.scrollHeight - innerHeight))))
  const pageTwoScroll = await page.evaluate(() => window.scrollY)
  expect(pageTwoScroll).toBeGreaterThan(0)
  await page.locator('main a[href="/trash/areas/220"]').first().click()
  await waitForAppPath(page, '/trash/areas/220')
  await expect(page.getByRole('heading', { name: /페이지2검증동/, level: 1 })).toBeVisible()
  await page.getByRole('link', { name: /원문 보기/ }).first().click()
  await waitForAppPath(page, '/trash/2201')
  await expect(page.locator('main').getByText('원본 배출 일정').first()).toBeVisible()
  await page.getByRole('link', { name: '동별 안내로 돌아가기' }).click()
  await waitForAppPath(page, '/trash/areas/220')
  await page.getByRole('link', { name: '목록으로 돌아가기' }).click()
  await waitForAppPath(page, /\/trash\?.*page=2/)
  const restored = new URL(page.url())
  expect(restored.pathname).toBe('/trash')
  expect(restored.searchParams.get('city')).toBe('서울특별시')
  expect(restored.searchParams.get('district')).toBe('강남구')
  expect(restored.searchParams.get('page')).toBe('2')
  await page.waitForFunction(() => window.scrollY > 0, undefined, { timeout: 2500 })

  await page.getByLabel('동 이름 검색').fill('역삼')
  await page.getByRole('button', { name: '검색' }).click()
  await page.waitForURL(/keyword=/)
  await hydrated(page)
  expect(new URL(page.url()).searchParams.get('page')).toBeNull()
  await expect(page.locator('main a[href="/trash/areas/1"]').first()).toBeVisible()

  await page.getByRole('link', { name: /검색 해제/ }).click()
  await page.waitForURL((url) => url.pathname === '/trash' && !url.searchParams.has('keyword'))
  await hydrated(page)
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://ilsangkit.co.kr/trash')

  const legacy = await request.get('/trash?city=서울특별시&district=강남구&schedule=1001&bad=x', { maxRedirects: 0 })
  expect(legacy.status()).toBe(302)
  expect(legacy.headers().location).toContain('/trash/1001#from=')

  await page.goto('/trash?city=서울특별시&district=강남구&keyword=역삼')
  await hydrated(page)
  await page.goto('/trash?city=서울특별시&district=강남구&schedule=1001&bad=x')
  await waitForAppPath(page, '/trash/1001')
  await page.goBack()
  await waitForAppPath(page, /\/trash\?/)
  expect(new URL(page.url()).searchParams.get('schedule')).toBeNull()

  await page.goto('/trash/1001#from=https%3A%2F%2Fevil.test%2Ftrash')
  await hydrated(page)
  expect(new URL(page.url()).hash).toBe('')
  await expect(page.getByRole('link', { name: '동별 안내로 돌아가기' })).toHaveCount(0)
})

test('keeps rapid searches and two tabs isolated', async ({ browser, page, request }) => {
  await control(request, { delayMs: 700 })
  await page.goto('/trash?city=서울특별시&district=강남구')
  await hydrated(page)
  const delayed = page.waitForRequest(req => req.url().includes('/api/waste-areas') && req.url().includes('keyword=%EC%97%AD%EC%82%BC'))
  await page.getByLabel('동 이름 검색').fill('역삼')
  await page.getByRole('button', { name: '검색' }).click()
  await delayed
  await control(request, { delayMs: 0 })
  await page.getByLabel('동 이름 검색').fill('조건')
  await page.getByRole('button', { name: '검색' }).click()
  await expect(page.getByRole('link', { name: /조건검증동/ })).toBeVisible()
  await page.waitForTimeout(800)
  await expect(page.getByRole('link', { name: /조건검증동/ })).toBeVisible()

  const context = await browser.newContext({ baseURL: app })
  const first = await context.newPage()
  const second = await context.newPage()
  await blockExternal(first)
  await blockExternal(second)
  await first.goto('/trash?city=서울특별시&district=강남구&keyword=역삼')
  await second.goto('/trash?city=서울특별시&district=강남구&keyword=조건')
  await hydrated(first)
  await hydrated(second)
  await expect(first.locator('main a[href="/trash/areas/1"]').first()).toBeVisible()
  await expect(second.getByRole('link', { name: /조건검증동/ })).toBeVisible()
  await expect(first.getByRole('link', { name: /조건검증동/ })).toHaveCount(0)
  await first.locator('main a[href="/trash/areas/1"]').first().click()
  await second.getByRole('link', { name: /조건검증동/ }).first().click()
  await waitForAppPath(first, '/trash/areas/1')
  await waitForAppPath(second, '/trash/areas/210')
  await expect(first.getByRole('link', { name: '목록으로 돌아가기' })).toHaveAttribute('href', /keyword=%EC%97%AD%EC%82%BC/)
  await expect(second.getByRole('link', { name: '목록으로 돌아가기' })).toHaveAttribute('href', /keyword=%EC%A1%B0%EA%B1%B4/)
  await context.close()
})

test('returns real statuses and fresh production-rule SSR after a transient failure', async ({ page, request }) => {
  expect((await page.goto('/trash/areas/2'))?.status()).toBe(200)
  await hydrated(page)
  await expect(page.getByRole('heading', { name: '서울특별시 강남구 역삼2동', level: 1 })).toBeVisible()

  await control(request, { failNext: 2 })
  const failed = await page.goto('/trash?city=서울특별시&district=강남구&keyword=최신')
  const failedState = await fixtureState(request)
  expect(failedState.requests.filter(item => item.startsWith('/api/waste-areas?') && item.includes('keyword=%EC%B5%9C%EC%8B%A0'))).toHaveLength(2)
  expect(failed?.status()).toBe(503)
  expect(failed?.headers()['cache-control'] || '').toContain('no-store')
  await hydrated(page)
  await expect(page.locator('main').getByText('동별 배출 안내를 불러오지 못했습니다')).toBeVisible()

  await control(request, { generation: 'after' })
  const fresh = await page.goto('/trash?city=서울특별시&district=강남구&keyword=최신')
  expect(fresh?.status()).toBe(200)
  expect(fresh?.headers()['cache-control'] || '').toContain('no-store')
  await hydrated(page)
  await expect(page.getByRole('link', { name: /역삼1동 최신/ })).toBeVisible()
  await expect(page.getByText('w10-generation-before')).toHaveCount(0)

  expect((await page.goto('/trash/areas/bad'))?.status()).toBe(400)
  expect((await page.goto('/trash/areas/999'))?.status()).toBe(404)
  expect((await page.goto('/trash/areas/410'))?.status()).toBe(410)
  expect((await page.goto('/trash/9999'))?.status()).toBe(404)
  expect((await page.goto('/trash/1410'))?.status()).toBe(410)
})

test('waste and core regression routes fit four widths without hydration errors', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => {
    if (/hydration.*mismatch/i.test(message.text())) errors.push(message.text())
  })
  const routes = [
    '/',
    '/real-estate/apt-sale/seoul/gangnam/회복아파트',
    '/subscription',
    '/subscription/rent',
    '/facilities?city=seoul&district=gangnam&category=trash',
    '/search?q=역삼%20쓰레기&tab=facilities',
    '/trash?city=서울특별시&district=강남구&keyword=역삼',
    '/trash/areas/1',
    '/trash/areas/210',
    '/trash/1001',
  ]
  for (const width of [360, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    for (const route of routes) {
      expect((await page.goto(route))?.status(), route).toBe(200)
      await hydrated(page)
      await noOverflow(page, route)
      if (route.startsWith('/trash') || route.startsWith('/facilities') || route.startsWith('/search')) {
        await page.screenshot({ path: resolve(evidence, `${route.replace(/[^a-z0-9]/gi, '-')}-${width}.png`), fullPage: true })
      }
    }
  }
  expect(errors).toEqual([])
})
