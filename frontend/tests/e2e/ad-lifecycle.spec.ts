import { test, expect, type Page, type Route } from '@playwright/test'
import { assertNoFakeAdInstrumentationErrors, installFakeAdSdk } from './helpers/adSdk'
import { installAdFrameRecorder, markAdPhase, readAdFrames, type AdFrame } from './helpers/adFrames'

const slot = (page: Page) => page.locator('.ad-banner').first()
const pushCount = (page: Page) => page.evaluate(() => window.__fakeAds?.pushCount ?? 0)
const requests = (page: Page) => page.evaluate(() => window.__fakeAds?.requests ?? [])
const twoFrames = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      )
  )

function assertZeroFrames(frames: AdFrame[]) {
  expect(frames.length).toBeGreaterThanOrEqual(2)
  const firstY = frames[0].afterY
  for (const frame of frames) {
    expect(Math.abs(frame.afterY - firstY)).toBeLessThan(1)
    for (const value of frame.slots) {
      expect(value.height).toBe(0)
      expect(value.marginTop + value.marginBottom).toBe(0)
      expect(value.paddingTop + value.paddingBottom + value.borderTop + value.borderBottom).toBe(0)
    }
  }
  expect(frames.at(-1)!.shift - frames[0].shift).toBeLessThanOrEqual(0.001)
}
async function waitForZeroFrames(page: Page) {
  await expect.poll(async () => (await readAdFrames(page)).length).toBeGreaterThanOrEqual(2)
  assertZeroFrames(await readAdFrames(page))
}

test.beforeEach(async ({ context, page }) => {
  await installAdFrameRecorder(context)
  page.on('pageerror', (error) => {
    throw error
  })
  page.on('console', (message) => {
    if (/hydration.*mismatch/i.test(message.text())) throw new Error(message.text())
  })
})
test.afterEach(async ({ page }, info) => {
  if (page.isClosed()) return
  await info.attach('ad-frames', {
    body: JSON.stringify({
      viewport: page.viewportSize(),
      frames: await readAdFrames(page),
      state: await page.evaluate(() => ({
        requests: window.__fakeAds?.requests,
        pushCount: window.__fakeAds?.pushCount,
        instrumentationErrors: window.__fakeAdInstrumentationErrors,
        shifts: window.__adShifts,
        events: window.__ilsangkitAdDebug?.snapshot(),
      })),
    }),
    contentType: 'application/json',
  })
  const screenshot = info.outputPath('ad-layout.png')
  await page.screenshot({ path: screenshot, timeout: 5000 })
  await info.attach('ad-layout', { path: screenshot, contentType: 'image/png' })
  await assertNoFakeAdInstrumentationErrors(page)
})

for (const corruption of ['missing', 'invalid'] as const) {
  test(`fake instrumentation surfaces ${corruption} attribution despite the application catch`, async ({
    page,
    context,
    browser,
  }, info) => {
    await installFakeAdSdk(context)
    await page.goto('/default')
    await expect.poll(() => requests(page)).toHaveLength(1)

    // Isolate the deliberate fault so the ordinary per-case empty-channel guard
    // remains active and no instrumentation error is cleared or ignored.
    const faultContext = await browser.newContext({ viewport: page.viewportSize()! })
    try {
      const sdk = await installFakeAdSdk(faultContext, { hold: true })
      const faultPage = await faultContext.newPage()
      await faultPage.goto('http://127.0.0.1:13010/default', { waitUntil: 'domcontentloaded' })
      await expect.poll(() => sdk.pending).toBe(1)
      await faultPage.evaluate((mode) => {
        const debug = window.__ilsangkitAdDebug!
        const snapshot = debug.snapshot
        debug.snapshot = () =>
          snapshot().flatMap((event) => {
            if (event.kind !== 'push-attempt') return [event]
            return mode === 'missing' ? [] : [{ ...event, order: 999 }]
          })
      }, corruption)
      await sdk.releaseSdk()
      await expect.poll(() => pushCount(faultPage)).toBe(1)
      expect(await requests(faultPage)).toEqual([])
      expect(
        await faultPage.evaluate(() =>
          window.__ilsangkitAdDebug!.snapshot().some((event) => event.kind === 'push-error')
        )
      ).toBe(true)
      await info.attach('intentional-instrumentation-fault', {
        body: JSON.stringify(await faultPage.evaluate(() => ({
          errors: window.__fakeAdInstrumentationErrors,
          events: window.__ilsangkitAdDebug!.snapshot(),
          requests: window.__fakeAds.requests,
        }))),
        contentType: 'application/json',
      })
      await expect(assertNoFakeAdInstrumentationErrors(faultPage)).rejects.toThrow(
        'fake SDK instrumentation errors'
      )
      expect(await faultPage.evaluate(() => window.__fakeAdInstrumentationErrors)).toEqual([
        'Fake SDK cannot identify the requested slot',
      ])
    } finally {
      await faultContext.close()
    }
  })
}

test('SSR first frames, hydration and SDK ready keep every empty frame at zero', async ({
  page,
  context,
}, info) => {
  const sdk = await installFakeAdSdk(context, { hold: true })
  const pending: Route[] = []
  const hold = (route: Route) => {
    pending.push(route)
  }
  await context.route('**/_nuxt/*.js', hold)
  await page.goto('/default', { waitUntil: 'commit' })
  try {
    await waitForZeroFrames(page)
    expect(await page.locator('ins.adsbygoogle').count()).toBe(0)
    expect(pending.length).toBeGreaterThan(0)
    // Playwright screenshot waits for fonts.ready, which awaits these held modules.
    // CDP captures the actual already-painted SSR frame without changing typography.
    const cdp = await context.newCDPSession(page)
    const capture = await cdp.send('Page.captureScreenshot', { format: 'png' })
    await info.attach('ssr-reference', {
      body: Buffer.from(capture.data, 'base64'),
      contentType: 'image/png',
    })
    await cdp.detach()
  } finally {
    await context.unroute('**/_nuxt/*.js', hold)
    await Promise.all(pending.map((route) => route.continue()))
  }
  await expect(page.locator('ins.adsbygoogle')).toBeAttached()
  await markAdPhase(page, 'hydrated')
  await expect.poll(() => sdk.pending).toBe(1)
  await twoFrames(page)
  await sdk.releaseSdk()
  await expect.poll(() => pushCount(page)).toBe(1)
  await markAdPhase(page, 'ready')
  await twoFrames(page)
  assertZeroFrames(await readAdFrames(page))
})
for (const failAfterMs of [0, 5000]) {
  test(`SDK failure after ${failAfterMs}ms never reserves empty space`, async ({
    page,
    context,
  }) => {
    const sdk = await installFakeAdSdk(context, { failAfterMs })
    await page.goto('/default', { waitUntil: 'domcontentloaded' })
    await expect(slot(page)).toHaveClass(/ad-banner--collapsed/, { timeout: 10000 })
    await markAdPhase(page, 'failed')
    await twoFrames(page)
    await waitForZeroFrames(page)
    expect(sdk.attempts).toBe(1)
    expect(await pushCount(page)).toBe(0)
  })
}

test('pending for ten seconds stays zero, then natural pending and late filled sizes remain visible', async ({
  page,
  context,
}, info) => {
  const sdk = await installFakeAdSdk(context, { hold: true })
  await page.goto('/default', { waitUntil: 'domcontentloaded' })
  await expect.poll(() => sdk.pending).toBe(1)
  await page.waitForTimeout(5000)
  await waitForZeroFrames(page)
  await sdk.releaseSdk()
  await expect.poll(() => pushCount(page)).toBe(1)
  await markAdPhase(page, 'ready')
  await page.waitForTimeout(10000)
  assertZeroFrames(await readAdFrames(page))
  await page.evaluate(() => window.__fakeAds.resize(0, 180))
  await markAdPhase(page, 'pending-size')
  await expect.poll(() => slot(page).evaluate((el) => el.getBoundingClientRect().height)).toBe(180)
  expect(await page.locator('ins.adsbygoogle').getAttribute('data-ad-status')).toBeNull()
  expect(await slot(page).evaluate((el) => getComputedStyle(el).overflow)).toBe('visible')
  expect(
    await page.locator('ins.adsbygoogle').evaluate((el) => getComputedStyle(el).display)
  ).not.toBe('none')
  const pendingShot = info.outputPath('pending-180.png')
  await page.screenshot({ path: pendingShot })
  await info.attach('pending-size', { path: pendingShot, contentType: 'image/png' })
  await page.evaluate(() => window.__fakeAds.fill(0, 'filled', 280))
  await markAdPhase(page, 'filled')
  await expect.poll(() => slot(page).evaluate((el) => el.getBoundingClientRect().height)).toBe(280)
  expect(sdk.attempts).toBe(1)
  expect(await page.evaluate(() => navigator.webdriver)).toBe(true)
})

test('stale cache clears and SDK failure retries only on a new eligible path, at most twice', async ({
  page,
  context,
}) => {
  await context.addInitScript(() => {
    sessionStorage.setItem('ads:blocked', '1')
    sessionStorage.setItem('unrelated', 'keep')
  })
  const sdk = await installFakeAdSdk(context, { hold: true })
  await page.goto('/default', { waitUntil: 'domcontentloaded' })
  await expect.poll(() => sdk.pending).toBe(1)
  await sdk.failSdk()
  await expect(slot(page)).toHaveClass(/collapsed/)
  await waitForZeroFrames(page)
  expect(await page.evaluate(() => sessionStorage.getItem('ads:blocked'))).toBeNull()
  expect(await page.evaluate(() => sessionStorage.getItem('unrelated'))).toBe('keep')
  await page.setViewportSize({ width: 850, height: 900 })
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
  await page.waitForTimeout(100)
  expect(sdk.attempts).toBe(1)
  await page.getByRole('link', { name: 'next', exact: true }).click()
  await expect.poll(() => sdk.pending).toBe(1)
  expect(sdk.attempts).toBe(2)
  await sdk.failSdk()
  await expect(slot(page)).toHaveClass(/collapsed/)
  await page.getByRole('link', { name: 'third', exact: true }).click()
  await page.waitForTimeout(100)
  expect(sdk.attempts).toBe(2)
  expect(await pushCount(page)).toBe(0)
})

test('SDK retry recovers the pending slot on the next path', async ({ page, context }) => {
  const sdk = await installFakeAdSdk(context, { hold: true })
  await page.goto('/default', { waitUntil: 'domcontentloaded' })
  await expect.poll(() => sdk.pending).toBe(1)
  await sdk.failSdk()
  await expect(slot(page)).toHaveClass(/collapsed/)
  await page.getByRole('link', { name: 'next', exact: true }).click()
  await expect.poll(() => sdk.pending).toBe(1)
  await sdk.releaseSdk()
  await expect.poll(() => pushCount(page)).toBe(1)
  await expect(slot(page)).not.toHaveClass(/collapsed/)
  expect(sdk.attempts).toBe(2)
})

test('width zero waits, recovery attempts once even if push throws', async ({ page, context }) => {
  const sdk = await installFakeAdSdk(context, { hold: true })
  await page.goto('/default', { waitUntil: 'domcontentloaded' })
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
  await twoFrames(page)
  expect(await pushCount(page)).toBe(1)
  expect((await requests(page)).length).toBe(1)
  expect(
    await page.evaluate(() =>
      window
        .__ilsangkitAdDebug!.snapshot()
        .some((event) => event.kind === 'push-error' && event.errorKind === 'type-error')
    )
  ).toBe(true)
})

test('unfilled collapses while filled, optimized and unknown statuses retain natural size', async ({
  page,
  context,
}) => {
  await installFakeAdSdk(context)
  await page.goto('/default')
  await expect.poll(() => pushCount(page)).toBe(1)
  await page.evaluate(() => window.__fakeAds.fill(0, 'unfilled'))
  await expect(slot(page)).toHaveClass(/collapsed/)
  await waitForZeroFrames(page)
  for (const status of ['filled', 'unfill-optimized', 'future-status']) {
    await page.evaluate((value) => window.__fakeAds.fill(0, value, 280), status)
    await expect(slot(page)).not.toHaveClass(/collapsed/)
    await expect
      .poll(() => slot(page).evaluate((el) => el.getBoundingClientRect().height))
      .toBe(280)
  }
  expect(await pushCount(page)).toBe(1)
})
for (const initiallyHidden of [true, false]) {
  test(`cosmetic hiding recovers exactly once (initial=${initiallyHidden})`, async ({
    page,
    context,
  }) => {
    await installFakeAdSdk(context)
    if (initiallyHidden)
      await context.route('http://127.0.0.1:13010/default', async (route) => {
        const response = await route.fetch()
        await route.fulfill({
          response,
          body: (await response.text()).replace(
            '<head>',
            '<head><style id="cosmetic">.adsbygoogle { display:none!important }</style>'
          ),
        })
      })
    await page.goto('/default')
    if (!initiallyHidden) {
      await expect.poll(() => pushCount(page)).toBe(1)
      await page
        .addStyleTag({ content: '.adsbygoogle { display:none!important }' })
        .then((handle) =>
          handle.evaluate((el) => {
            (el as HTMLStyleElement).id = 'cosmetic'
          })
        )
    }
    await expect(slot(page)).toHaveClass(/collapsed/)
    await waitForZeroFrames(page)
    expect(await pushCount(page)).toBe(initiallyHidden ? 0 : 1)
    await page.locator('#cosmetic').evaluate((el) => el.remove())
    await expect(slot(page)).not.toHaveClass(/collapsed/)
    await expect.poll(() => pushCount(page)).toBe(1)
    await twoFrames(page)
    assertZeroFrames(await readAdFrames(page))
  })
}

test('real IO qualifies a zero-height far slot only on approach', async ({ page, context }) => {
  await installFakeAdSdk(context)
  await page.goto('/lazy')
  await expect.poll(async () => (await requests(page)).length).toBe(1)
  const far = page.locator('.ad-banner').nth(1)
  expect((await far.boundingBox())!.y).toBeGreaterThan(page.viewportSize()!.height + 350)
  expect((await far.boundingBox())!.height).toBe(0)
  await far.scrollIntoViewIfNeeded()
  await expect.poll(async () => (await requests(page)).length).toBe(2)
  expect((await requests(page)).map((request) => request.order)).toEqual([1, 2])
})

test('real IO notices spacer reduction without scrolling', async ({ page, context }) => {
  await installFakeAdSdk(context)
  await page.goto('/lazy')
  await expect.poll(() => pushCount(page)).toBe(1)
  expect(await page.evaluate(() => window.scrollY)).toBe(0)
  await page.locator('#spacer').evaluate((el) => {
    ;(el as HTMLElement).style.height = '0px'
  })
  await expect.poll(() => pushCount(page)).toBe(2)
  expect(await page.evaluate(() => window.scrollY)).toBe(0)
})

test('real IO can request DOM order two before one through CSS order', async ({
  page,
  context,
}) => {
  const sdk = await installFakeAdSdk(context, { hold: true })
  await page.goto('/lazy', { waitUntil: 'domcontentloaded' })
  await expect.poll(() => sdk.pending).toBe(1)
  await page.addStyleTag({
    content:
      '#before{order:0} #secondary{order:1} #spacer{order:2} #primary{order:3} #after{order:4}',
  })
  // Replace first ins: its earlier earned sticky eligibility must not leak to the replacement.
  await page.locator('#toggle').click()
  await page.locator('#toggle').click()
  await twoFrames(page)
  expect((await slot(page).boundingBox())!.y).toBeGreaterThan(page.viewportSize()!.height + 350)
  await sdk.releaseSdk()
  await expect.poll(() => pushCount(page)).toBe(1)
  expect((await requests(page)).map((request) => request.order)).toEqual([2])
  await slot(page).scrollIntoViewIfNeeded()
  await expect.poll(() => pushCount(page)).toBe(2)
  expect((await requests(page)).map((request) => request.order)).toEqual([2, 1])
  await page.evaluate(() => window.__fakeAds.resize(0, 100))
  expect(
    await page
      .locator('.ad-banner')
      .nth(1)
      .evaluate((el) => el.getBoundingClientRect().height)
  ).toBe(100)
  expect(await slot(page).evaluate((el) => el.getBoundingClientRect().height)).toBe(0)
})

test('near eligibility survives leaving the viewport before SDK becomes ready', async ({
  page,
  context,
}) => {
  const sdk = await installFakeAdSdk(context, { hold: true })
  await page.goto('/lazy', { waitUntil: 'domcontentloaded' })
  await expect.poll(() => sdk.pending).toBe(1)
  const far = page.locator('.ad-banner').nth(1)
  await far.scrollIntoViewIfNeeded()
  await twoFrames(page)
  await page.evaluate(() => window.scrollTo(0, 0))
  await twoFrames(page)
  expect((await far.boundingBox())!.y).toBeGreaterThan(page.viewportSize()!.height + 350)
  await sdk.releaseSdk()
  await expect.poll(() => pushCount(page)).toBe(2)
  expect((await requests(page)).map((request) => request.order).sort()).toEqual([1, 2])
})

test('controlled visibility getter and visibilitychange gate SDK-ready requests', async ({
  page,
  context,
}) => {
  await context.addInitScript(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' })
  })
  await installFakeAdSdk(context)
  await page.goto('/default')
  await expect.poll(() => page.evaluate(() => !!window.__fakeAds)).toBe(true)
  await twoFrames(page)
  expect(await pushCount(page)).toBe(0)
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await expect.poll(() => pushCount(page)).toBe(1)
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
  await twoFrames(page)
  expect(await pushCount(page)).toBe(1)
})

test('native tab foreground observation is recorded separately from controlled visibility', async ({
  page,
  context,
}, info) => {
  await installFakeAdSdk(context)
  await page.goto('/default')
  await expect.poll(() => pushCount(page)).toBe(1)
  const before = await page.evaluate(() => document.visibilityState)
  const other = await context.newPage()
  await other.goto('about:blank')
  await other.bringToFront()
  const away = await page.evaluate(() => document.visibilityState)
  await page.bringToFront()
  const returned = await page.evaluate(() => document.visibilityState)
  await other.close()
  await info.attach('native-tab-observation', {
    body: JSON.stringify({
      before,
      away,
      returned,
      hiddenObserved: away === 'hidden',
      limitation:
        'Headless Chromium tab selection may keep documents visible; this observation does not prove OS background behavior.',
    }),
    contentType: 'application/json',
  })
  expect(await pushCount(page)).toBe(1)
})

test('without IO width and document visibility guards still apply', async ({ page, context }) => {
  await context.addInitScript(() => {
    Object.defineProperty(window, 'IntersectionObserver', { configurable: true, value: undefined })
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' })
  })
  const sdk = await installFakeAdSdk(context, { hold: true })
  await page.goto('/lazy', { waitUntil: 'domcontentloaded' })
  await expect.poll(() => sdk.pending).toBe(1)
  await page.locator('.ad-banner').evaluateAll((els) =>
    els.forEach((el) => {
      ;(el as HTMLElement).style.width = '0px'
    })
  )
  await sdk.releaseSdk()
  await twoFrames(page)
  expect(await pushCount(page)).toBe(0)
  await page.locator('.ad-banner').evaluateAll((els) =>
    els.forEach((el) => {
      ;(el as HTMLElement).style.width = '100%'
    })
  )
  await twoFrames(page)
  expect(await pushCount(page)).toBe(0)
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await expect.poll(() => pushCount(page)).toBe(2)
})
for (const width of [767, 768]) {
  test(`default format boundary ${width}px locks the same requested ins attributes`, async ({
    page,
    context,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    const sdk = await installFakeAdSdk(context, { hold: true })
    await page.goto('/default', { waitUntil: 'domcontentloaded' })
    await expect.poll(() => sdk.pending).toBe(1)
    const ins = page.locator('ins.adsbygoogle').first()
    await expect(ins).toHaveAttribute('data-ad-format', width < 768 ? 'auto' : 'horizontal')
    const handle = await ins.elementHandle()
    const attributes = await ins.evaluate((el) => [
      el.getAttribute('data-ad-slot'),
      el.getAttribute('data-ad-format'),
      el.getAttribute('data-full-width-responsive'),
    ])
    await sdk.releaseSdk()
    await expect.poll(() => pushCount(page)).toBe(1)
    await page.setViewportSize({ width: width < 768 ? 1440 : 393, height: 900 })
    await twoFrames(page)
    expect(await handle!.evaluate((el) => el === document.querySelector('ins.adsbygoogle'))).toBe(
      true
    )
    expect(
      await ins.evaluate((el) => [
        el.getAttribute('data-ad-slot'),
        el.getAttribute('data-ad-format'),
        el.getAttribute('data-full-width-responsive'),
      ])
    ).toEqual(attributes)
    expect(await pushCount(page)).toBe(1)
  })
}
for (const scenario of ['auto', 'horizontal', 'rectangle', 'compact', 'first']) {
  test(`explicit ${scenario} attributes and natural initial geometry`, async ({
    page,
    context,
  }) => {
    await installFakeAdSdk(context)
    await page.goto(`/${scenario}`)
    await expect.poll(() => pushCount(page)).toBe(1)
    const mobile = page.viewportSize()!.width < 768
    const format = ['auto', 'horizontal', 'rectangle'].includes(scenario)
      ? scenario
      : scenario === 'compact'
        ? 'horizontal'
        : mobile
          ? 'auto'
          : 'horizontal'
    const ins = page.locator('ins.adsbygoogle')
    await expect(ins).toHaveAttribute('data-ad-format', format)
    await expect(ins).toHaveAttribute(
      'data-full-width-responsive',
      scenario === 'first' || (scenario === 'compact' && mobile) ? 'false' : 'true'
    )
    await waitForZeroFrames(page)
  })
}

test('density keeps four placements and requests each approached element once', async ({
  page,
  context,
}) => {
  const sdk = await installFakeAdSdk(context)
  await page.goto('/density')
  await expect(page.locator('.ad-banner')).toHaveCount(4)
  for (const target of await page.locator('.ad-banner').all()) {
    await target.scrollIntoViewIfNeeded()
    await twoFrames(page)
  }
  await expect.poll(() => pushCount(page)).toBe(4)
  expect((await requests(page)).map((request) => request.order)).toEqual([1, 2, 3, 4])
  await page.locator('#suppress').click()
  await expect(page.locator('ins.adsbygoogle')).toHaveCount(0)
  await page.locator('#suppress').click()
  for (const target of await page.locator('.ad-banner').all()) {
    await target.scrollIntoViewIfNeeded()
    await twoFrames(page)
  }
  await expect.poll(() => pushCount(page)).toBe(8)
  expect(sdk.attempts).toBe(1)
})

test('empty flow and estate margins reset while grid and flex gaps remain', async ({
  page,
  context,
}, info) => {
  await installFakeAdSdk(context)
  await page.goto('/spacing')
  await waitForZeroFrames(page)
  const gaps = await page.evaluate(() =>
    ['grid-spacing', 'flex-spacing'].map((id) => {
      const parent = document.getElementById(id)!
      const ad = parent.querySelector('.ad-banner')!
      const content = parent.lastElementChild!
      return {
        id,
        gap: parseFloat(getComputedStyle(parent).rowGap),
        distance: content.getBoundingClientRect().top - ad.getBoundingClientRect().bottom,
      }
    })
  )
  expect(gaps).toEqual([
    { id: 'grid-spacing', gap: 30, distance: 30 },
    { id: 'flex-spacing', gap: 26, distance: 26 },
  ])
  await info.attach('spacing-fixture-limit', {
    body: 'Fixture uses scoped estate margin and utility/gap cases; Task 4 must confirm actual product page selectors and placement.',
    contentType: 'text/plain',
  })
})
