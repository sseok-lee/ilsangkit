import { expect, test, type Locator, type Page } from '@playwright/test'
import { resolve } from 'node:path'

const api = 'http://127.0.0.1:18080'
const hospital = '/hospital/hospital-seo-fixture'
const banner = {
  id: 'affiliate-fixture',
  provider: 'coupang',
  imageUrl: '/api/images/affiliate-fixture.png',
  targetUrl: 'https://example.com/affiliate',
  altText: '제휴 배너 테스트 이미지',
  disclosureText: '이 포스팅은 테스트 제휴 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.\n업체별 전체 고지문구가 이미지 위에 표시됩니다.',
  expiresAt: null,
}
const fixtureImage = '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="240"><rect width="640" height="240" fill="#e0f2fe"/><text x="320" y="130" text-anchor="middle" font-size="30" fill="#075985">AFFILIATE TEST BANNER</text></svg>'

async function hydrated(page: Page) {
  await page.waitForFunction(() => {
    const root = document.querySelector('#__nuxt') as Element & { __vue_app__?: { config: { globalProperties: { $nuxt?: { isHydrating: boolean } } } } }
    return root?.__vue_app__?.config.globalProperties.$nuxt?.isHydrating === false
  })
}

async function installBanner(page: Page, mode: 'ready' | 'empty' | 'error' | 'broken-image' = 'ready', imageUrl = banner.imageUrl) {
  let requests = 0
  await page.route('**/api/affiliate-banners/random', async route => {
    requests += 1
    await route.fulfill({
      status: mode === 'error' ? 503 : 200,
      json: {
        success: mode !== 'error',
        data: mode === 'empty' ? null : { ...banner, imageUrl },
        serverTime: '2026-10-15T14:59:59.000Z',
      },
      headers: { 'cache-control': 'no-store' },
    })
  })
  await page.route(imageUrl.startsWith('https://') ? imageUrl : `**${imageUrl}`, route => route.fulfill({
    status: mode === 'broken-image' ? 404 : 200,
    contentType: 'image/svg+xml',
    body: mode === 'broken-image' ? '' : fixtureImage,
  }))
  return () => requests
}

async function expectBanner(page: Page, expectedCount = 1) {
  const slots = page.getByTestId('affiliate-banner')
  await expect(slots).toHaveCount(expectedCount)
  for (let index = 0; index < expectedCount; index += 1) {
    const slot = slots.nth(index)
    await slot.scrollIntoViewIfNeeded()
    await expect(slot).toBeVisible()
    const image = slot.getByTestId('affiliate-image')
    await expect(image).toHaveJSProperty('naturalWidth', 640)
    const disclosure = slot.getByTestId('affiliate-disclosure')
    await expect(disclosure).toHaveText(banner.disclosureText)
    const disclosureBox = await disclosure.boundingBox()
    const imageBox = await image.boundingBox()
    expect(disclosureBox!.y + disclosureBox!.height).toBeLessThanOrEqual(imageBox!.y)
    const link = slot.getByTestId('affiliate-link')
    await expect(link).toHaveAttribute('rel', 'sponsored nofollow noopener noreferrer')
    await expect(link).toHaveAttribute('target', '_blank')
    await expect(image).toHaveAttribute('alt', banner.altText)
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
}

async function expectBetween(page: Page, before: Locator, after: Locator, slotLocator = page.getByTestId('affiliate-banner').first()) {
  const slot = await slotLocator.boundingBox()
  const previous = await before.boundingBox()
  const next = await after.boundingBox()
  expect(previous!.y + previous!.height).toBeLessThanOrEqual(slot!.y)
  expect(slot!.y + slot!.height).toBeLessThanOrEqual(next!.y)
}

async function expectImmediatelyBeforeDataSource(page: Page, slot: Locator) {
  const dataSource = sectionWithHeading(page, '데이터 출처')
  await expect(dataSource).toBeVisible()
  const slotHandle = await slot.elementHandle()
  expect(slotHandle).not.toBeNull()
  const isImmediatePreviousSibling = await dataSource.evaluate((source, banner) =>
    source.parentElement?.previousElementSibling === banner,
  slotHandle)
  await slotHandle?.dispose()
  expect(isImmediatePreviousSibling).toBe(true)
  const slotBox = await slot.boundingBox()
  const dataSourceBox = await dataSource.boundingBox()
  expect(slotBox!.y + slotBox!.height).toBeLessThanOrEqual(dataSourceBox!.y)
}

function sectionWithHeading(page: Page, name: string) {
  return page.getByRole('heading', { name, exact: true }).filter({ visible: true }).locator('xpath=ancestor::section[1]')
}

test.beforeEach(async ({ page, request }) => {
  await request.post(`${api}/__test/remaining-pages`, { data: { domain: null } })
  // Keep QA independent of external ad, map and analytics services; never click an ad.
  await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort())
})

test.afterEach(async ({ request }) => {
  await request.post(`${api}/__test/remaining-pages`, { data: { domain: null } })
})

for (const width of [320, 390, 767]) {
  test(`mobile ${width}px renders one banner with full disclosure above its image`, async ({ page }) => {
    const requests = await installBanner(page)
    await page.setViewportSize({ width, height: 900 })
    const errors: string[] = []
    page.on('console', message => { if (/hydration.*mismatch/i.test(message.text())) errors.push(message.text()) })
    await page.goto(hospital)
    await hydrated(page)
    await expectBanner(page)
    expect(requests()).toBe(1)
    expect(errors).toEqual([])
    await page.screenshot({ path: resolve(`test-results/mobile-affiliate/facility-${width}.png`) })
    await page.setViewportSize({ width: 768, height: 900 })
    await expect(page.getByTestId('affiliate-banner')).toHaveCount(0)
    expect(requests()).toBe(1)
  })
}

test('SSR and desktop leave no affiliate markup, image or request', async ({ page, request }) => {
  const response = await request.get(hospital)
  expect(await response.text()).not.toContain('data-testid="affiliate-banner"')
  const requests = await installBanner(page)
  for (const width of [768, 1280]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto(hospital)
    await hydrated(page)
    await expect(page.getByTestId('affiliate-banner')).toHaveCount(0)
    await expect(page.getByTestId('affiliate-image')).toHaveCount(0)
    expect(requests()).toBe(0)
  }
})

test('registered external HTTPS images load under the public CSP', async ({ page }) => {
  const imageUrl = 'https://affiliate-fixture.example/banner.png'
  await installBanner(page, 'ready', imageUrl)
  await page.setViewportSize({ width: 390, height: 900 })
  const response = await page.goto(hospital)
  const csp = response!.headers()['content-security-policy']
  expect(csp.match(/img-src[^;]*/)?.[0].split(/\s+/)).toContain('https:')
  for (const directive of ['script-src', 'connect-src', 'frame-src']) {
    expect(csp.match(new RegExp(`${directive}[^;]*`))?.[0].split(/\s+/)).not.toContain('https:')
  }
  await hydrated(page)
  await expectBanner(page)
  await expect(page.getByTestId('affiliate-image')).toHaveAttribute('src', imageUrl)
})

for (const mode of ['empty', 'error', 'broken-image'] as const) {
  test(`${mode} leaves no empty affiliate slot`, async ({ page }) => {
    const requests = await installBanner(page, mode)
    const failedImage = mode === 'broken-image'
      ? page.waitForResponse(response => response.url().endsWith('/api/images/affiliate-fixture.png'))
      : null
    await page.setViewportSize({ width: 390, height: 900 })
    await page.goto(hospital)
    await hydrated(page)
    await expect.poll(requests).toBeGreaterThan(0)
    if (failedImage) {
      await page.evaluate(() => document.querySelector('[data-testid="affiliate-image"]')?.setAttribute('loading', 'eager'))
      expect((await failedImage).status()).toBe(404)
    }
    await expect(page.getByTestId('affiliate-banner')).toHaveCount(0)
  })
}

test('approved detail, list and region placements render across content families', async ({ page, request }) => {
  test.setTimeout(120000)
  await installBanner(page)
  await page.setViewportSize({ width: 390, height: 900 })
  const groups = [
    { domain: null, routes: ['/', '/real-estate/apt-sale/seoul/gangnam/회복아파트', '/subscription/90001', '/subscription/90002'] },
    { domain: 'property', routes: ['/real-estate/land/seoul/gangnam/역삼동', '/auction/item/remaining-003', '/auction/list', '/auction/seoul/gangnam'] },
    { domain: 'lifestyle', routes: ['/subway/gangnam-lifestyle', '/seoul/gangnam/parking', '/trash/901', '/trash/areas/101'] },
    { domain: 'editorial', routes: ['/guide', '/article', '/guide/remaining-guide-1', '/article/remaining-article-1'] },
  ]
  for (const { domain, routes } of groups) {
    await request.post(`${api}/__test/remaining-pages`, { data: { domain } })
    for (const path of routes) {
      await test.step(path, async () => {
        expect((await page.goto(path))?.status()).toBe(200)
        await hydrated(page)
        const expectedBannerCount = path.includes('회복아파트') || path.includes('역삼동') ? 2 : 1
        await expectBanner(page, expectedBannerCount)
        const slot = page.getByTestId('affiliate-banner')
        if (path.includes('회복아파트')) {
          const firstSlot = slot.first()
          const dataSourceSlot = slot.nth(1)
          await expect(firstSlot).toHaveCSS('order', '10')
          await expectBetween(page, page.locator('#location'), page.locator('#nearby'), firstSlot)
          await expect(dataSourceSlot).toHaveCSS('order', '12')
          await expectImmediatelyBeforeDataSource(page, dataSourceSlot)
        }
        if (path.includes('역삼동')) {
          const firstSlot = slot.first()
          const dataSourceSlot = slot.nth(1)
          await expect(firstSlot).toHaveCSS('order', '6')
          await expectBetween(page, sectionWithHeading(page, '지목별 시세'), sectionWithHeading(page, '대지 거래 사례'), firstSlot)
          await expect(dataSourceSlot).toHaveCSS('order', '12')
          await expectImmediatelyBeforeDataSource(page, dataSourceSlot)
        }
        if (path.startsWith('/subscription/')) {
          await expect(slot).toHaveCSS('order', '8')
          const before = path.endsWith('90002')
            ? page.getByText('위치 정보가 제공되지 않아 지도를 표시할 수 없습니다.', { exact: true }).locator('..')
            : sectionWithHeading(page, '위치·로드뷰')
          await expectBetween(page, before, sectionWithHeading(page, '기본정보'))
        }
        if (path === '/' || path.includes('회복아파트') || path.includes('역삼동') || path === '/subscription/90002') {
          await page.screenshot({ path: resolve(`test-results/mobile-affiliate/${encodeURIComponent(path)}-390.png`) })
        }
        if (expectedBannerCount === 2) {
          await page.setViewportSize({ width: 768, height: 900 })
          await expect(page.getByTestId('affiliate-banner')).toHaveCount(0)
          await page.setViewportSize({ width: 390, height: 900 })
        }
      })
    }
  }
})

test('excluded and failed pages make no affiliate request', async ({ page }) => {
  const requests = await installBanner(page)
  await page.setViewportSize({ width: 390, height: 900 })
  for (const path of ['/real-estate', '/faq', '/privacy', '/terms', '/contact', '/subscription/999404', '/subscription/999503']) {
    await page.goto(path)
    await hydrated(page)
    await expect(page.getByTestId('affiliate-banner')).toHaveCount(0)
    expect(requests(), path).toBe(0)
  }
})
