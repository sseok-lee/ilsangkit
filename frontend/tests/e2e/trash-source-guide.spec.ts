import { expect, test, type APIRequestContext, type Page, type Route } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

const api = 'http://127.0.0.1:18080'
const evidence = resolve('test-results/trash-source-guide')

test.setTimeout(120_000)

async function control(request: APIRequestContext, settings: Record<string, unknown> = {}) {
  const response = await request.post(`${api}/__test/waste-area`, { data: { active: true, ...settings } })
  expect(response.ok()).toBe(true)
}

async function reset(request: APIRequestContext) {
  const response = await request.post(`${api}/__test/waste-area`, { data: { reset: true, active: true } })
  expect(response.ok()).toBe(true)
}

async function fixtureState(request: APIRequestContext) {
  const response = await request.get(`${api}/__test/waste-area`)
  expect(response.ok()).toBe(true)
  return (await response.json()).data as { requests: string[] }
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

async function expectNoOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
}

async function clientNavigate(page: Page, path: string) {
  await page.evaluate((target) => {
    const root = document.querySelector('#__nuxt') as Element & {
      __vue_app__?: {
        config: { globalProperties: { $router?: { push: (path: string) => Promise<void> } } }
      }
    }
    void root.__vue_app__?.config.globalProperties.$router?.push(target)
  }, path)
}

async function expectIndexableCanonical(page: Page, href: string) {
  await expect(page.locator('head meta[name="robots"][content*="noindex"]')).toHaveCount(0)
  await expect(page.locator('head link[rel="canonical"]')).toHaveAttribute('href', href)
}

async function expectNoindexWithoutCanonical(page: Page) {
  await expect(page.locator('head meta[name="robots"]')).toHaveAttribute('content', 'noindex, follow')
  await expect(page.locator('head link[rel="canonical"]')).toHaveCount(0)
  await expect(page.locator('head link[rel="prev"], head link[rel="next"]')).toHaveCount(0)
}

test.beforeEach(async ({ request, page }) => {
  mkdirSync(evidence, { recursive: true })
  await reset(request)
  await blockExternal(page)
})

test.afterEach(async ({ request }) => {
  await request.post(`${api}/__test/waste-area`, { data: { reset: true, active: false } })
})

test('renders Uiwang source cards before JavaScript', async ({ browser, request }) => {
  await reset(request)
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL: 'http://127.0.0.1:13000' })
  const page = await context.newPage()
  await blockExternal(page)
  const response = await page.goto('/gyeonggi/uiwang/trash')
  expect(response?.status()).toBe(200)
  await expect(page.locator('main a[href^="/trash/"]').filter({ hasText: '가나무로' })).toBeVisible()
  await expect(page.locator('main a[aria-label$="상세 정보 보기"]')).toHaveCount(20)
  await expect(page.getByText('348건', { exact: true })).toBeVisible()
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://ilsangkit.co.kr/gyeonggi/uiwang/trash')
  const robots = page.locator('meta[name="robots"]')
  const robotsContent = await robots.count() ? await robots.first().getAttribute('content') : ''
  expect(robotsContent || '').not.toContain('noindex')
  await context.close()
})

test('renders nationwide and city-only source-first lists with source cards', async ({ page, request }) => {
  const nationwide = await page.goto('/trash')
  expect(nationwide?.status()).toBe(200)
  await hydrated(page)
  await expect(page.locator('main a[href="/trash/1001"]')).toHaveCount(1)
  await expect(page.locator('main a[href="/trash/1004"]')).toHaveCount(1)
  await expect(page.locator('main a[aria-label$="상세 정보 보기"]').first()).toBeVisible()
  let state = await fixtureState(request)
  expect(state.requests.some(item => item.startsWith('/api/waste-schedules?'))).toBe(true)
  expect(state.requests.some(item => item.startsWith('/api/waste-areas'))).toBe(false)

  await reset(request)
  const cityOnly = await page.goto('/trash?city=서울특별시')
  expect(cityOnly?.status()).toBe(200)
  await hydrated(page)
  await expect(page.locator('main a[href="/trash/1001"]')).toHaveCount(1)
  await expect(page.locator('main a[href="/trash/1005"]')).toHaveCount(1)
  await expect(page.locator('main a[aria-label$="상세 정보 보기"]').first()).toBeVisible()
  state = await fixtureState(request)
  expect(state.requests.some(item => item.startsWith('/api/waste-schedules?') && item.includes('city=%EC%84%9C%EC%9A%B8%ED%8A%B9%EB%B3%84%EC%8B%9C'))).toBe(true)
  expect(state.requests.some(item => item.startsWith('/api/waste-areas'))).toBe(false)
})

test('noindexes root trash area and unresolved filters without stale client head state', async ({ page }) => {
  for (const path of ['/trash?areaId=210', '/trash?coverage=unresolved']) {
    const response = await page.goto(path)
    expect(response?.status(), path).toBe(200)
    const html = await response?.text()
    expect(html, path).toContain('<meta name="robots" content="noindex, follow">')
    expect(html, path).not.toMatch(/<link\b[^>]*rel="canonical"/)
    expect(html, path).not.toMatch(/<link\b[^>]*rel="(?:prev|next)"/)

    await hydrated(page)
    await expectNoindexWithoutCanonical(page)

    await clientNavigate(page, '/trash')
    await page.waitForURL('/trash')
    await hydrated(page)
    await expectIndexableCanonical(page, 'https://ilsangkit.co.kr/trash')
  }

  await clientNavigate(page, '/trash?city=seoul&district=강남구')
  await page.waitForURL(/city=seoul/)
  await hydrated(page)
  await expectIndexableCanonical(page, 'https://ilsangkit.co.kr/seoul/gangnam/trash')
})

test('redirects legacy area URLs with no-store for single, multiple, empty, and error lifecycles', async ({ request }) => {
  const multiple = await request.get('/trash/areas/210', { maxRedirects: 0 })
  expect(multiple.status()).toBe(302)
  expect(multiple.headers().location).toBe('/trash?areaId=210')
  expect(multiple.headers()['cache-control']).toContain('no-store')

  const single = await request.get('/trash/areas/2', { maxRedirects: 0 })
  expect(single.status()).toBe(302)
  expect(single.headers().location).toBe('/trash/1001#from=%2Ftrash%3FareaId%3D2')
  expect(single.headers()['cache-control']).toContain('no-store')

  const empty = await request.get('/trash/areas/230', { maxRedirects: 0 })
  expect(empty.status()).toBe(302)
  expect(empty.headers().location).toBe('/trash?areaId=230')
  expect(empty.headers()['cache-control']).toContain('no-store')

  for (const [path, status] of [['/trash/areas/bad', 400], ['/trash/areas/999999', 404], ['/trash/areas/302', 404], ['/trash/areas/410', 410]] as const) {
    const response = await request.get(path, { maxRedirects: 0 })
    expect(response.status(), path).toBe(status)
    expect(response.headers()['cache-control'] || '', path).toContain('no-store')
  }

  await control(request, { sourceStatus: 503 })
  const sourceFailure = await request.get('/gyeonggi/uiwang/trash', { maxRedirects: 0 })
  expect(sourceFailure.status()).toBe(503)
  expect(sourceFailure.headers()['cache-control']).toContain('no-store')
})

test('filters source lists exactly and keeps source identity, detail fields, and safe return flow', async ({ page }) => {
  await page.goto('/trash?city=서울특별시&district=강남구&areaId=1&keyword=역삼')
  await hydrated(page)
  await expect(page.getByText('2건', { exact: true })).toBeVisible()
  await expect(page.locator('main a[href="/trash/1001"]')).toHaveCount(1)
  await expect(page.locator('main a[href="/trash/1002"]')).toHaveCount(1)
  await expect(page.locator('main a[href="/trash/1003"]')).toHaveCount(0)
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, follow')
  await expect(page.locator('link[rel="canonical"]')).toHaveCount(0)

  await page.goto('/trash?city=서울특별시&district=강남구&areaId=2&keyword=역삼')
  await hydrated(page)
  await expect(page.getByText('1건', { exact: true })).toBeVisible()
  await expect(page.locator('main a[href="/trash/1001"]')).toHaveCount(1)
  await expect(page.locator('main a[href="/trash/1002"]')).toHaveCount(0)

  await page.goto('/trash?areaId=210&page=2')
  await hydrated(page)
  await expect(page.getByText('21건', { exact: true })).toBeVisible()
  await expect(page.locator('main a[href="/trash/2121"]')).toHaveCount(1)

  await page.goto('/trash/1006#from=%2Ftrash%3FareaId%3D210%26keyword%3D%EA%B2%80%EC%A6%9D%26page%3D2')
  await hydrated(page)
  await expect(page.getByRole('heading', { name: /요양원·칠량면소재지 등/, level: 1 })).toBeVisible()
  await expect(page.getByRole('definition').filter({ hasText: /요양원,칠량면소재지,초등학교\.칠량시장/ })).toBeVisible()
  await expect(page.getByRole('heading', { name: '일시적 다량폐기물' })).toBeVisible()
  await expect(page.getByText('미운영')).toBeVisible()
  await expect(page.getByRole('link', { name: /목록으로$/ })).toHaveAttribute('href', '/trash?areaId=210&keyword=%EA%B2%80%EC%A6%9D&page=2')

  await page.goto('/trash?city=서울특별시&district=강남구&keyword=%3Cscript%3E')
  await hydrated(page)
  await expect(page.getByText(/검증검색 안전문구/)).toBeVisible()
  expect(await page.locator('script').count()).toBeGreaterThan(0)
  await expectNoOverflow(page)
})

test('keeps hydration stable without duplicate source calls and ignores delayed stale navigation', async ({ page, request }) => {
  let blockedPostSsrSourceCalls = 0
  const postSsrSourceBlocker = async (route: Route) => {
    blockedPostSsrSourceCalls += 1
    await route.abort('blockedbyclient')
  }
  await page.route('**/api/waste-schedules**', postSsrSourceBlocker)
  await page.goto('/gyeonggi/gapyeong/trash')
  await hydrated(page)
  await page.waitForTimeout(300)
  await expect(page.locator('main a[href="/trash/4001"]').first()).toBeVisible()
  expect(blockedPostSsrSourceCalls).toBe(0)
  await page.unroute('**/api/waste-schedules**', postSsrSourceBlocker)
  const state = await fixtureState(request)
  expect(state.requests.filter(item => item.startsWith('/api/waste-schedules?') && item.includes('district=%EA%B0%80%ED%8F%89%EA%B5%B0'))).toHaveLength(1)

  await control(request, { sourceDelayMs: 700 })
  const slowRequest = page.waitForRequest(req => req.url().includes('/api/waste-schedules?') && req.url().includes('keyword=%EC%97%AD%EC%82%BC'))
  await clientNavigate(page, '/trash?city=서울특별시&district=강남구&keyword=역삼')
  await slowRequest
  await control(request, { sourceDelayMs: 0 })
  const freshResponse = page.waitForResponse(res => res.url().includes('/api/waste-schedules?') && res.url().includes('keyword=%EC%A1%B0%EA%B1%B4'))
  await clientNavigate(page, '/trash?city=서울특별시&district=강남구&keyword=조건')
  await freshResponse
  await page.waitForURL(/keyword=%EC%A1%B0%EA%B1%B4/)
  await hydrated(page)
  await expect(page.getByText('21건', { exact: true })).toBeVisible()
  await expect(page.getByText('역삼1동+역삼2동')).toHaveCount(0)
  await page.waitForTimeout(800)
  await expect(page.getByText('21건', { exact: true })).toBeVisible()
  await expect(page.getByText('역삼1동+역삼2동')).toHaveCount(0)
  expect(await page.title()).toContain('쓰레기')
})

test('separates option failures from source failures and generation redirects', async ({ page, request }) => {
  await control(request, { optionsStatus: 503 })
  const regional = await page.goto('/gyeonggi/uiwang/trash')
  expect(regional?.status()).toBe(200)
  await hydrated(page)
  await expect(page.getByText('348건', { exact: true })).toBeVisible()
  await expect(page.getByText('동 목록을 불러오지 못했습니다')).toBeVisible()

  await control(request, { sourcePayload: 'failure' })
  const failurePayload = await page.goto('/gyeonggi/uiwang/trash')
  expect(failurePayload?.status()).toBe(503)
  expect(failurePayload?.headers()['cache-control']).toContain('no-store')

  await control(request, { sourcePayload: 'malformed' })
  const malformed = await page.goto('/gyeonggi/uiwang/trash')
  expect(malformed?.status()).toBe(503)
  expect(malformed?.headers()['cache-control']).toContain('no-store')

  await control(request, { sourcePayload: 'valid', generation: 'before' })
  const before = await request.get('/trash/areas/1', { maxRedirects: 0 })
  expect(before.status()).toBe(302)
  expect(before.headers().location).toBe('/trash?areaId=1')
  await control(request, { generation: 'after' })
  const after = await request.get('/trash/areas/1', { maxRedirects: 0 })
  expect(after.status()).toBe(302)
  expect(after.headers().location).toBe('/trash/1001#from=%2Ftrash%3FareaId%3D1')
  expect(after.headers()['cache-control']).toContain('no-store')
})

test('maps source timeout and discovery-disabled area requests to no-store SSR failures', async ({ page, request }) => {
  await control(request, { sourceDelayMs: 9000 })
  const timeout = await page.goto('/gyeonggi/uiwang/trash')
  expect(timeout?.status()).toBe(503)
  expect(timeout?.headers()['cache-control']).toContain('no-store')

  await reset(request)
  await control(request, { discoveryEnabled: false })
  const unfiltered = await page.goto('/trash')
  expect(unfiltered?.status()).toBe(200)
  await hydrated(page)
  await expect(page.locator('main a[href="/trash/1001"]').first()).toBeVisible()
  let state = await fixtureState(request)
  expect(state.requests.some(item => item.startsWith('/api/waste-schedules?'))).toBe(true)
  expect(state.requests.some(item => item.startsWith('/api/waste-areas'))).toBe(false)

  const explicitArea = await page.goto('/trash?areaId=1')
  expect(explicitArea?.status()).toBe(503)
  expect(explicitArea?.headers()['cache-control']).toContain('no-store')
  state = await fixtureState(request)
  expect(state.requests.some(item => item.startsWith('/api/waste-schedules?') && item.includes('areaId=1'))).toBe(true)

  const legacy = await request.get('/trash/areas/1', { maxRedirects: 0 })
  expect(legacy.status()).toBe(503)
  expect(legacy.headers()['cache-control']).toContain('no-store')
  state = await fixtureState(request)
  expect(state.requests.some(item => item.startsWith('/api/waste-areas/1?'))).toBe(true)
})

test('captures required visual states at mobile and desktop widths', async ({ page, request }) => {
  const cases = [
    ['list', '/gyeonggi/uiwang/trash'],
    ['detail', '/trash/1006'],
    ['filter', '/trash?city=서울특별시&district=강남구&areaId=210&page=2'],
    ['empty', '/trash?areaId=230'],
    ['search', '/trash?city=서울특별시&district=강남구&keyword=%3Cscript%3E'],
  ] as const

  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 920 })
    for (const [name, path] of cases) {
      const response = await page.goto(path)
      expect(response?.status(), path).toBe(200)
      await hydrated(page)
      await expectNoOverflow(page)
      await page.screenshot({ path: resolve(evidence, `${name}-${width}.png`), fullPage: true })
    }
  }

  await control(request, { sourceStatus: 503 })
  await page.setViewportSize({ width: 390, height: 920 })
  const errorResponse = await page.goto('/gyeonggi/uiwang/trash')
  expect(errorResponse?.status()).toBe(503)
  await hydrated(page)
  await expect(page.getByText('배출 일정 목록을 불러오지 못했습니다')).toBeVisible()
  await page.screenshot({ path: resolve(evidence, 'error-390.png'), fullPage: true })
})
