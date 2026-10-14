import { test, expect, type Page, type Route } from '@playwright/test'
import { installFakeAdSdk } from './helpers/adSdk'

const slot = (page: Page) => page.locator('.ad-banner').first()
const pushCount = (page: Page) => page.evaluate(() => window.__fakeAds?.pushCount ?? 0)
async function metrics(page: Page) {
  return slot(page).evaluate((el) => {
    const css = getComputedStyle(el)
    return {
      height: el.getBoundingClientRect().height,
      marginTop: css.marginTop,
      marginBottom: css.marginBottom,
      padding: css.padding,
      border: css.borderWidth,
      display: css.display,
    }
  })
}
async function assertCollapsed(page: Page) {
  await expect(slot(page)).toHaveClass(/ad-banner--collapsed/)
  expect(await metrics(page)).toMatchObject({
    height: 0,
    marginTop: '0px',
    marginBottom: '0px',
    padding: '0px',
    border: '0px',
  })
  expect((await metrics(page)).display).not.toBe('none')
}

test.beforeEach(async ({ context, page }) => {
  await context.addInitScript(() => sessionStorage.setItem('ads:debug', '1'))
  page.on('pageerror', (error) => {
    throw error
  })
  page.on('console', (message) => {
    if (/hydration.*mismatch/i.test(message.text())) throw new Error(message.text())
  })
})
test.afterEach(async ({ page }, info) => {
  await info.attach('ad-state', {
    body: JSON.stringify(
      await page.evaluate(() => ({
        pushCount: window.__fakeAds?.pushCount,
        shift: window.__adShift,
        events: window.__ilsangkitAdDebug?.snapshot(),
      }))
    ),
    contentType: 'application/json',
  })
  const screenshot = info.outputPath('ad-layout.png')
  await page.screenshot({ path: screenshot })
  await info.attach('ad-layout', { path: screenshot, contentType: 'image/png' })
})

test('fixture/fake SDK: delayed SDK and late fill never collapse pending slots', async ({
  page,
  context,
}) => {
  const sdk = await installFakeAdSdk(context, { hold: true })
  await page.goto('/fixed', { waitUntil: 'domcontentloaded' })
  await expect.poll(() => sdk.pending).toBe(1)
  const originalY = (await page.locator('#after').boundingBox())!.y
  for (const delay of [1500, 3500]) {
    await page.waitForTimeout(delay)
    await expect(slot(page)).not.toHaveClass(/collapsed/)
    expect((await metrics(page)).height).toBeGreaterThanOrEqual(280)
    expect(await pushCount(page)).toBe(0)
  }
  await sdk.releaseSdk()
  await expect.poll(() => pushCount(page)).toBe(1)
  await page.waitForTimeout(10000)
  await expect(slot(page)).not.toHaveClass(/collapsed/)
  await page.evaluate(() => window.__fakeAds.fill(0, 'filled'))
  expect(Math.abs((await page.locator('#after').boundingBox())!.y - originalY)).toBeLessThan(1)
  expect(sdk.attempts).toBe(1)
  expect(await page.evaluate(() => navigator.webdriver)).toBe(true)
})

test('fixture/fake SDK: stale cache clears, script failure retries on next path only once', async ({
  page,
  context,
}) => {
  await context.addInitScript(() => {
    sessionStorage.setItem('ads:blocked', '1')
    sessionStorage.setItem('unrelated', 'keep')
  })
  const sdk = await installFakeAdSdk(context, { hold: true })
  await page.goto('/fixed', { waitUntil: 'domcontentloaded' })
  await expect.poll(() => sdk.pending).toBe(1)
  await sdk.failSdk()
  await assertCollapsed(page)
  expect(await page.evaluate(() => sessionStorage.getItem('ads:blocked'))).toBeNull()
  expect(await page.evaluate(() => sessionStorage.getItem('unrelated'))).toBe('keep')
  await page.getByRole('link', { name: 'next', exact: true }).click()
  await expect.poll(() => sdk.pending).toBe(1)
  expect(sdk.attempts).toBe(2)
  await sdk.failSdk()
  await assertCollapsed(page)
  await page.getByRole('link', { name: 'third', exact: true }).click()
  await page.waitForTimeout(200)
  expect(sdk.attempts).toBe(2)
  expect(await pushCount(page)).toBe(0)
})

test('fixture/fake SDK: retry can recover on the same pending slot', async ({ page, context }) => {
  const sdk = await installFakeAdSdk(context, { hold: true })
  await page.goto('/fixed', { waitUntil: 'domcontentloaded' })
  await expect.poll(() => sdk.pending).toBe(1)
  await sdk.failSdk()
  await assertCollapsed(page)
  await page.getByRole('link', { name: 'next', exact: true }).click()
  await expect.poll(() => sdk.pending).toBe(1)
  await sdk.releaseSdk()
  await expect.poll(() => pushCount(page)).toBe(1)
  await expect(slot(page)).not.toHaveClass(/collapsed/)
  await page.getByRole('link', { name: 'third', exact: true }).click()
  expect(sdk.attempts).toBe(2)
})

test('fixture/fake SDK: zero width waits and push exception is not retried', async ({
  page,
  context,
}) => {
  const sdk = await installFakeAdSdk(context, { hold: true })
  await page.goto('/fixed', { waitUntil: 'domcontentloaded' })
  await expect.poll(() => sdk.pending).toBe(1)
  await slot(page).evaluate((el) => {
    ;(el as HTMLElement).style.width = '0px'
  })
  await sdk.releaseSdk()
  await page.waitForTimeout(100)
  expect(await pushCount(page)).toBe(0)
  await page.evaluate(() => {
    window.__fakeAds.throwNext = true
  })
  await slot(page).evaluate((el) => {
    ;(el as HTMLElement).style.width = '100%'
  })
  await expect.poll(() => pushCount(page)).toBe(1)
  await page.setViewportSize({ width: 800, height: 900 })
  await page.waitForTimeout(100)
  expect(await pushCount(page)).toBe(1)
  await expect(slot(page)).not.toHaveClass(/collapsed/)
  const events = await page.evaluate(() => window.__ilsangkitAdDebug!.snapshot())
  expect(
    events.some((event) => event.kind === 'push-error' && event.errorKind === 'type-error')
  ).toBe(true)
})

test('fixture/fake SDK: unfilled, optimized and unknown statuses retain correct geometry', async ({
  page,
  context,
}) => {
  await installFakeAdSdk(context)
  await page.goto('/fixed')
  await expect.poll(() => pushCount(page)).toBe(1)
  await page.evaluate(() => window.__fakeAds.fill(0, 'unfilled'))
  await assertCollapsed(page)
  for (const status of ['filled', 'unfill-optimized', 'future-status']) {
    await page.evaluate((value) => window.__fakeAds.fill(0, value), status)
    await expect(slot(page)).not.toHaveClass(/collapsed/)
    expect((await metrics(page)).height).toBeGreaterThanOrEqual(280)
  }
  expect(await pushCount(page)).toBe(1)
})

for (const initiallyHidden of [true, false]) {
  test(`fixture/fake SDK: cosmetic hiding restores slot (initial=${initiallyHidden})`, async ({
    page,
    context,
  }) => {
    const sdk = await installFakeAdSdk(context, { hold: initiallyHidden })
    if (initiallyHidden)
      await context.route('http://127.0.0.1:13010/fixed', async (route) => {
        const response = await route.fetch()
        await route.fulfill({
          response,
          body: (await response.text()).replace(
            '<head>',
            '<head><style id="cosmetic">.adsbygoogle { display:none!important }</style>'
          ),
        })
      })
    await page.goto('/fixed', { waitUntil: 'domcontentloaded' })
    if (initiallyHidden) {
      await expect.poll(() => sdk.pending).toBe(1)
      await sdk.releaseSdk()
    } else {
      await expect.poll(() => pushCount(page)).toBe(1)
      await page
        .addStyleTag({ content: '.adsbygoogle { display:none!important }' })
        .then((handle) => handle.evaluate((el) => ((el as HTMLElement).id = 'cosmetic')))
    }
    await assertCollapsed(page)
    expect(await pushCount(page)).toBe(initiallyHidden ? 0 : 1)
    await page.locator('#cosmetic').evaluate((el) => el.remove())
    await expect(slot(page)).not.toHaveClass(/collapsed/)
    await expect.poll(() => pushCount(page)).toBe(1)
    expect((await metrics(page)).height).toBeGreaterThanOrEqual(280)
  })
}

test('fixture/fake SDK: fixed SSR, hydration and fill preserve content coordinates', async ({
  page,
  context,
}, info) => {
  const sdk = await installFakeAdSdk(context, { hold: true })
  const pending: Route[] = []
  const pattern = '**/_nuxt/*.js'
  const hold = (route: Route) => {
    pending.push(route)
  }
  await context.route(pattern, hold)
  await page.goto('/fixed', { waitUntil: 'commit' })
  await expect.poll(async () => (await metrics(page)).height).toBeGreaterThanOrEqual(280)
  expect(await page.locator('ins.adsbygoogle').count()).toBe(0)
  const ssrY = (await page.locator('#after').boundingBox())!.y
  await context.unroute(pattern, hold)
  await Promise.all(pending.map((route) => route.continue()))
  await expect(page.locator('ins.adsbygoogle')).toBeAttached()
  await expect.poll(() => sdk.pending).toBe(1)
  const hydratedY = (await page.locator('#after').boundingBox())!.y
  await sdk.releaseSdk()
  await expect.poll(() => pushCount(page)).toBe(1)
  await page.screenshot({ path: info.outputPath('reserved-reference.png') })
  await page.evaluate(() => window.__fakeAds.fill(0, 'filled', 280))
  expect(Math.abs(hydratedY - ssrY)).toBeLessThan(1)
  expect(Math.abs((await page.locator('#after').boundingBox())!.y - hydratedY)).toBeLessThan(1)
})

test('fixture/fake SDK: one fixed + three auto placements, policy cleanup and frozen unit', async ({
  page,
  context,
}) => {
  const sdk = await installFakeAdSdk(context)
  await page.goto('/density')
  await expect.poll(() => pushCount(page)).toBe(4)
  expect(await page.locator('ins[style*="height: 280px"]').count()).toBe(1)
  const unit = await page.locator('ins.adsbygoogle').first().getAttribute('data-ad-slot')
  await page.setViewportSize({ width: page.viewportSize()!.width < 768 ? 1440 : 393, height: 900 })
  expect(await page.locator('ins.adsbygoogle').first().getAttribute('data-ad-slot')).toBe(unit)
  expect(await pushCount(page)).toBe(4)
  await page.locator('#suppress').click()
  await expect(page.locator('ins.adsbygoogle')).toHaveCount(0)
  await page.locator('#suppress').click()
  await expect.poll(() => pushCount(page)).toBe(8)
  expect(sdk.attempts).toBe(1)
})
