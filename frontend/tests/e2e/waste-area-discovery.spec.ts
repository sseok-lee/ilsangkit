import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

const api = 'http://127.0.0.1:18080'

async function control(request: APIRequestContext, settings: Record<string, unknown> = {}) {
  const response = await request.post(`${api}/__test/waste-area`, { data: { active: true, ...settings } })
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

test.beforeEach(async ({ request, page }) => {
  await control(request, { reset: true })
  await blockExternal(page)
})

test.afterEach(async ({ request }) => {
  await request.post(`${api}/__test/waste-area`, { data: { reset: true, active: false } })
})

test('facility and search trash dong links land on the verified source-list filter', async ({ page }) => {
  await page.goto('/facilities?city=seoul&district=gangnam&category=trash')
  await hydrated(page)
  await expect(page.getByRole('link', { name: /역삼1동 배출 안내/ }).first()).toHaveAttribute('href', '/trash?areaId=1')
  await page.getByRole('link', { name: /역삼1동 배출 안내/ }).first().click()
  await page.waitForURL('/trash?areaId=1')
  await hydrated(page)
  await expect(page.locator('main a[href="/trash/1001"]')).toHaveCount(1)
  await expect(page.locator('main a[href="/trash/1002"]')).toHaveCount(1)

  await page.goto('/search?q=역삼%20쓰레기&tab=facilities')
  await hydrated(page)
  await expect(page.getByRole('link', { name: /역삼1동 배출 안내/ }).first()).toHaveAttribute('href', '/trash?areaId=1')
})

test('old area URL compatibility uses full source cardinality and never renders the old area detail UI', async ({ page, request }) => {
  const multi = await request.get('/trash/areas/210', { maxRedirects: 0 })
  expect(multi.status()).toBe(302)
  expect(multi.headers().location).toBe('/trash?areaId=210')
  expect(multi.headers()['cache-control']).toContain('no-store')

  await page.goto('/trash/areas/210')
  await page.waitForURL('/trash?areaId=210')
  await hydrated(page)
  await expect(page.locator('main a[href^="/trash/21"]')).toHaveCount(20)
  await expect(page.getByRole('heading', { name: /조건검증동/, level: 1 })).toHaveCount(0)

  const single = await request.get('/trash/areas/2', { maxRedirects: 0 })
  expect(single.status()).toBe(302)
  expect(single.headers().location).toBe('/trash/1001#from=%2Ftrash%3FareaId%3D2')
})
