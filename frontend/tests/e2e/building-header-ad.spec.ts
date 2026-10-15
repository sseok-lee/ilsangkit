import { test, expect, type Page, type Route } from '@playwright/test'
import { installFakeAdSdk, assertNoFakeAdInstrumentationErrors } from './helpers/adSdk'
import { installAdFrameRecorder, markAdPhase, readAdFrames, type AdFrame } from './helpers/adFrames'

const header = (page: Page) => page.getByTestId('building-header-ad')
const requests = (page: Page) => page.evaluate(() => window.__fakeAds?.requests ?? [])
const afterY = (page: Page) =>
  page.locator('#after').evaluate((el) => el.getBoundingClientRect().top + scrollY)
const twoFrames = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      )
  )
let browserErrors: string[]

function zeroFrames(frames: AdFrame[]) {
  expect(frames.length).toBeGreaterThanOrEqual(2)
  for (const frame of frames) {
    expect(Math.abs(frame.afterY - frames[0].afterY)).toBeLessThan(1)
    for (const slot of frame.slots) {
      expect(slot.height).toBe(0)
      expect(slot.marginTop + slot.marginBottom).toBe(0)
      expect(slot.paddingTop + slot.paddingBottom + slot.borderTop + slot.borderBottom).toBe(0)
    }
  }
  expect(frames.at(-1)!.shift - frames[0].shift).toBeLessThanOrEqual(0.001)
}

async function fixedRequest(page: Page, index = 0) {
  await expect.poll(async () => (await requests(page)).length).toBe(index + 1)
  expect((await requests(page))[index]).toMatchObject({
    slot: '9920012184',
    format: null,
    fullWidth: null,
    width: 320,
    height: 100,
  })
}

test.beforeEach(async ({ page, context }) => {
  browserErrors = []
  await installAdFrameRecorder(context, { afterSelector: '#measurement > #after' })
  page.on('pageerror', (error) => browserErrors.push(error.message))
  page.on('console', (message) => {
    if (/hydration.*mismatch/i.test(message.text())) browserErrors.push(message.text())
  })
})

test.afterEach(async ({ page }, info) => {
  if (page.isClosed()) return
  await info.attach('building-header-evidence', {
    body: JSON.stringify({
      viewport: page.viewportSize(),
      frames: await readAdFrames(page),
      requests: await requests(page),
      browserErrors,
      state: await page.evaluate(() => ({
        instrumentationErrors: window.__fakeAdInstrumentationErrors,
        events: window.__ilsangkitAdDebug?.snapshot(),
        rects: Array.from(
          document.querySelectorAll('.ad-banner, ins.adsbygoogle, #before, #after')
        ).map((el) => ({
          testid: el.getAttribute('data-testid'),
          rect: el.getBoundingClientRect().toJSON(),
          style: el.getAttribute('style'),
          computedWidth: getComputedStyle(el).width,
        })),
      })),
    }),
    contentType: 'application/json',
  })
  const screenshot = info.outputPath('building-header.png')
  await page.screenshot({ path: screenshot, timeout: 5000 })
  await info.attach('building-header', { path: screenshot, contentType: 'image/png' })
  await assertNoFakeAdInstrumentationErrors(page)
  expect(browserErrors, 'page errors and hydration mismatches').toEqual([])
})

for (const width of [320, 360, 393, 767, 768, 1024, 1440]) {
  test(`viewport ${width}px has exact fixed request eligibility and geometry`, async ({
    page,
    context,
  }) => {
    await page.setViewportSize({ width, height: 852 })
    const sdk = await installFakeAdSdk(context, { hold: true })
    await page.goto('/fixed-mobile', { waitUntil: 'domcontentloaded' })
    await expect.poll(() => sdk.pending).toBe(1)
    const before = await afterY(page)
    if (width < 768) await expect(header(page)).toHaveCSS('height', '0px')
    else await expect(header(page)).toHaveCount(0)
    await sdk.releaseSdk()
    if (width >= 360 && width < 768) {
      await fixedRequest(page)
      await expect.poll(() => afterY(page)).toBe(before + 116)
      const geometry = await header(page).evaluate((el) => {
        const rect = el.getBoundingClientRect()
        const ins = el.querySelector('ins')!.getBoundingClientRect()
        const before = document.querySelector('#before')!.getBoundingClientRect()
        const after = document.querySelector('#after')!.getBoundingClientRect()
        return {
          width: ins.width,
          height: ins.height,
          center: ins.left + ins.width / 2 - (rect.left + rect.width / 2),
          above: rect.top - before.bottom,
          below: after.top - rect.bottom,
        }
      })
      expect(geometry).toEqual({ width: 320, height: 100, center: 0, above: 16, below: 22 })
      await page.evaluate(() => window.__fakeAds.fill(0, 'filled', 100))
    } else {
      await twoFrames(page)
      expect(await requests(page)).toEqual([])
      await expect(page.locator('ins.adsbygoogle')).toHaveCount(0)
      expect(await afterY(page)).toBe(before)
    }
  })
}

test('fractional content width 319.75→320→319→320 keeps host and replaces ins once', async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 393, height: 852 })
  const sdk = await installFakeAdSdk(context, { hold: true })
  await page.goto('/fixed-mobile', { waitUntil: 'domcontentloaded' })
  await expect.poll(() => sdk.pending).toBe(1)
  await page.locator('[id="width-319.75"]').click()
  await expect(header(page)).toHaveCSS('width', '319.75px')
  const host = await header(page).elementHandle()
  await expect(header(page).locator('ins')).toHaveCount(0)
  await sdk.releaseSdk()
  await twoFrames(page)
  expect(await requests(page)).toEqual([])
  await page.locator('#width-320').click()
  await fixedRequest(page)
  const first = await header(page).locator('ins').elementHandle()
  await page.locator('#width-319').click()
  await expect(header(page).locator('ins')).toHaveCount(0)
  expect(await first!.evaluate((el) => el.isConnected)).toBe(false)
  expect(
    await host!.evaluate(
      (el) => el === document.querySelector('[data-testid="building-header-ad"]')
    )
  ).toBe(true)
  await page.locator('#width-320').click()
  await fixedRequest(page, 1)
  await twoFrames(page)
  expect(await first!.evaluate((el) => el.isConnected)).toBe(false)
  expect((await requests(page)).map((r) => r.order)).toEqual([1, 1])
})

for (const failure of ['unresponsive', 'immediate', 'delayed'] as const) {
  test(`zero-slot SSR first frame → hydration → SDK ${failure} has no space`, async ({
    page,
    context,
  }, info) => {
    await page.setViewportSize({ width: 393, height: 852 })
    const sdk = await installFakeAdSdk(
      context,
      failure === 'unresponsive'
        ? { hold: true }
        : { failAfterMs: failure === 'immediate' ? 0 : 600 }
    )
    const pending: Route[] = []
    const hold = (route: Route) => {
      pending.push(route)
    }
    await context.route('**/_nuxt/*.js', hold)
    await page.goto('/fixed-mobile', { waitUntil: 'commit' })
    try {
      await expect.poll(async () => (await readAdFrames(page)).length).toBeGreaterThanOrEqual(2)
      const frames = await readAdFrames(page)
      expect(frames[0].phase).toBe('initial')
      expect(frames.every((frame) => frame.slots.length === 0)).toBe(true)
      zeroFrames(frames)
      expect(pending.length).toBeGreaterThan(0)
      await expect(header(page)).toHaveCount(0)
      const cdp = await context.newCDPSession(page)
      const capture = await cdp.send('Page.captureScreenshot', { format: 'png' })
      await info.attach('zero-slot-ssr-first-frame', {
        body: Buffer.from(capture.data, 'base64'),
        contentType: 'image/png',
      })
      await cdp.detach()
    } finally {
      await context.unroute('**/_nuxt/*.js', hold)
      await Promise.all(pending.map((route) => route.continue()))
    }
    await expect(header(page)).toBeAttached()
    await markAdPhase(page, 'hydrated')
    await twoFrames(page)
    expect(
      (await readAdFrames(page)).some(
        (frame) => frame.phase === 'hydrated' && frame.slots.length === 1
      )
    ).toBe(true)
    if (failure === 'unresponsive') {
      await expect.poll(() => sdk.pending).toBe(1)
      await page.waitForTimeout(10100)
    } else {
      await expect(header(page)).toHaveClass(/collapsed/)
      await markAdPhase(page, 'failed')
    }
    await twoFrames(page)
    zeroFrames(await readAdFrames(page))
    expect(await requests(page)).toEqual([])
  })
}

for (const gate of ['far', 'hidden', 'width'] as const) {
  test(`SDK ready with ${gate} gate cannot size or request before actual eligibility`, async ({
    page,
    context,
  }) => {
    await page.setViewportSize({ width: gate === 'width' ? 320 : 393, height: 852 })
    if (gate === 'hidden')
      await context.addInitScript(() => {
        Object.defineProperty(document, 'visibilityState', {
          configurable: true,
          get: () => 'hidden',
        })
      })
    await installFakeAdSdk(context)
    await page.goto(gate === 'far' ? '/fixed-mobile-far' : '/fixed-mobile')
    await expect.poll(() => page.evaluate(() => !!window.__fakeAds)).toBe(true)
    await twoFrames(page)
    expect(await requests(page)).toEqual([])
    await expect(header(page)).toHaveCSS('height', '0px')
    if (gate === 'width') {
      await expect(header(page).locator('ins')).toHaveCount(0)
      await page.setViewportSize({ width: 360, height: 852 })
    } else {
      await expect(header(page).locator('ins')).toHaveCSS('height', '0px')
      if (gate === 'far') {
        expect((await header(page).boundingBox())!.y).toBeGreaterThan(1152)
        await header(page).scrollIntoViewIfNeeded()
      } else
        await page.evaluate(() => {
          Object.defineProperty(document, 'visibilityState', {
            configurable: true,
            get: () => 'visible',
          })
          document.dispatchEvent(new Event('visibilitychange'))
        })
    }
    await fixedRequest(page)
  })
}

for (const status of [
  'pending',
  'filled',
  'unfilled',
  'unfill-optimized',
  'future-status',
  'throw',
]) {
  test(`post-request ${status} preserves one attempt and status geometry`, async ({
    page,
    context,
  }) => {
    await page.setViewportSize({ width: 393, height: 852 })
    const sdk = await installFakeAdSdk(context, { hold: true })
    await page.goto('/fixed-mobile', { waitUntil: 'domcontentloaded' })
    await expect.poll(() => sdk.pending).toBe(1)
    const before = await afterY(page)
    if (status === 'throw') {
      // Install SDK while hidden, then arm the one real request to throw.
      await page.evaluate(() =>
        Object.defineProperty(document, 'visibilityState', {
          configurable: true,
          get: () => 'hidden',
        })
      )
    }
    await sdk.releaseSdk()
    if (status === 'throw') {
      await expect.poll(() => page.evaluate(() => !!window.__fakeAds)).toBe(true)
      await page.evaluate(() => {
        window.__fakeAds.throwNext = true
        Object.defineProperty(document, 'visibilityState', {
          configurable: true,
          get: () => 'visible',
        })
        document.dispatchEvent(new Event('visibilitychange'))
      })
    }
    await fixedRequest(page)
    await expect.poll(() => afterY(page)).toBe(before + 116)
    if (!['pending', 'throw'].includes(status))
      await page.evaluate((value) => window.__fakeAds.fill(0, value, 100), status)
    if (status === 'unfilled') {
      await expect(header(page)).toHaveCSS('height', '0px')
      await expect.poll(() => afterY(page)).toBe(before)
    } else {
      if (status === 'pending') await page.waitForTimeout(10100)
      await expect(header(page)).toHaveCSS('height', '100px')
      await expect.poll(() => afterY(page)).toBe(before + 116)
    }
    await page.setViewportSize({ width: 767, height: 852 })
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
    await twoFrames(page)
    expect(await requests(page)).toHaveLength(1)
    if (status === 'throw')
      expect(
        await page.evaluate(() =>
          window
            .__ilsangkitAdDebug!.snapshot()
            .some((e) => e.kind === 'push-error' && e.errorKind === 'type-error')
        )
      ).toBe(true)
  })
}

test('synchronous SDK 120px height survives Vue updates without clipping or restoring 100px', async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 393, height: 852 })
  await installFakeAdSdk(context, { resizeOnPush: 120 })
  await page.goto('/fixed-mobile')
  await fixedRequest(page)
  await expect(header(page)).toHaveCSS('height', '120px')
  await expect(header(page)).toHaveCSS('overflow', 'visible')
  const attrs = await header(page)
    .locator('ins')
    .evaluate((el) => [
      el.getAttribute('data-ad-slot'),
      el.getAttribute('data-ad-format'),
      el.getAttribute('data-full-width-responsive'),
    ])
  await page.evaluate(() => window.__fakeAds.fill(0, 'filled', 120))
  await page.setViewportSize({ width: 767, height: 852 })
  await twoFrames(page)
  await expect(header(page).locator('ins')).toHaveCSS('height', '120px')
  expect(
    await header(page)
      .locator('ins')
      .evaluate((el) => [
        el.getAttribute('data-ad-slot'),
        el.getAttribute('data-ad-format'),
        el.getAttribute('data-full-width-responsive'),
      ])
  ).toEqual(attrs)
  expect(await requests(page)).toHaveLength(1)
})

for (const initiallyHidden of [true, false]) {
  test(`external CSS hiding and recovery preserve request generation (initial=${initiallyHidden})`, async ({
    page,
    context,
  }) => {
    await page.setViewportSize({ width: 393, height: 852 })
    await installFakeAdSdk(context)
    if (initiallyHidden)
      await context.route('http://127.0.0.1:13010/fixed-mobile', async (route) => {
        const response = await route.fetch()
        await route.fulfill({
          response,
          body: (await response.text()).replace(
            '<head>',
            '<head><style id="cosmetic">.adsbygoogle{display:none!important}</style>'
          ),
        })
      })
    await page.goto('/fixed-mobile')
    if (!initiallyHidden) {
      await fixedRequest(page)
      await page.addStyleTag({ content: '.adsbygoogle{display:none!important}' }).then((handle) =>
        handle.evaluate((el) => {
          if (el instanceof HTMLStyleElement) el.id = 'cosmetic'
        })
      )
    }
    await expect(header(page)).toHaveClass(/collapsed/)
    await expect(header(page)).toHaveCSS('height', '0px')
    expect(await requests(page)).toHaveLength(initiallyHidden ? 0 : 1)
    await page.locator('#cosmetic').evaluate((el) => el.remove())
    await fixedRequest(page)
    await expect(header(page)).toHaveCSS('height', '100px')
    await twoFrames(page)
    expect(await requests(page)).toHaveLength(1)
  })
}

test('suppression, toggle, desktop resize and detached writes cannot revive stale generations', async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 393, height: 852 })
  await installFakeAdSdk(context)
  await page.goto('/fixed-mobile')
  await fixedRequest(page)
  const old = await header(page).locator('ins').elementHandle()
  for (const control of ['suppress', 'toggle']) {
    const count = (await requests(page)).length
    await page.locator(`#${control}`).click()
    await expect(header(page)).toHaveCount(0)
    await page.locator(`#${control}`).click()
    await fixedRequest(page, count)
  }
  await page.setViewportSize({ width: 768, height: 852 })
  await expect(header(page)).toHaveCount(0)
  const eventsBeforeDetachedWrite = await page.evaluate(
    () => window.__ilsangkitAdDebug!.snapshot().length
  )
  await old!.evaluate((el) => {
    el.setAttribute('data-ad-status', 'filled')
    ;(el as HTMLElement).style.height = '999px'
  })
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
  await twoFrames(page)
  expect(await requests(page)).toHaveLength(3)
  expect(await page.evaluate(() => window.__ilsangkitAdDebug!.snapshot().length)).toBe(
    eventsBeforeDetachedWrite
  )
  await page.setViewportSize({ width: 393, height: 852 })
  await fixedRequest(page, 3)
  await expect(header(page)).toHaveCSS('height', '100px')
  const disposed = await page.evaluate(
    () => window.__ilsangkitAdDebug!.snapshot().filter((e) => e.kind === 'slot-disposed').length
  )
  expect(disposed).toBeGreaterThanOrEqual(3)
})

test('SPA navigation observes 1500ms rate limit and disposes prior request generation', async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 393, height: 852 })
  const sdk = await installFakeAdSdk(context)
  await page.goto('/fixed-mobile')
  await fixedRequest(page)
  await page.waitForTimeout(1550)
  const old = await header(page).locator('ins').elementHandle()
  await page.getByRole('link', { name: 'next', exact: true }).click()
  await fixedRequest(page, 1)
  expect(await old!.evaluate((el) => el.isConnected)).toBe(false)
  const current = await header(page).locator('ins').elementHandle()
  await page.getByRole('link', { name: 'third', exact: true }).click()
  await expect(page).toHaveURL(/fixed-mobile-third$/)
  await twoFrames(page)
  expect(await current!.evaluate((el) => el === document.querySelector('ins.adsbygoogle'))).toBe(
    true
  )
  expect(await requests(page)).toHaveLength(2)
  expect(sdk.attempts).toBe(1)
})

for (const width of [393, 1440]) {
  test(`new plus four existing siblings at ${width}px attribute each exact request target`, async ({
    page,
    context,
  }) => {
    await page.setViewportSize({ width, height: 852 })
    await installFakeAdSdk(context)
    await page.goto('/fixed-mobile-siblings')
    const mobile = width < 768
    await expect(header(page)).toHaveCount(mobile ? 1 : 0)
    await expect(page.locator('.ad-banner')).toHaveCount(mobile ? 5 : 4)
    for (const target of await page.locator('.ad-banner').all()) {
      await target.scrollIntoViewIfNeeded()
      await twoFrames(page)
    }
    await expect.poll(async () => (await requests(page)).length).toBe(mobile ? 5 : 4)
    const recorded = (await requests(page)).sort((a, b) => a.order - b.order)
    expect(recorded.map((r) => r.order)).toEqual(mobile ? [1, 2, 3, 4, 5] : [1, 2, 3, 4])
    if (mobile)
      expect(recorded.shift()).toMatchObject({
        order: 1,
        slot: '9920012184',
        format: null,
        fullWidth: null,
        width: 320,
        height: 100,
      })
    for (const [index, record] of recorded.entries())
      expect(record).toMatchObject({
        slot: mobile ? '9920012184' : '8606930518',
        format: mobile ? 'auto' : 'horizontal',
        fullWidth: index === 0 ? 'false' : 'true',
        height: 0,
      })
    expect(await page.evaluate(() => navigator.webdriver)).toBe(true)
  })
}

for (const throwFirst of [false, true]) {
  test(`SDK selector consumes recorded body-before-header [2,1] order (throw=${throwFirst})`, async ({
    page,
    context,
  }) => {
    await page.setViewportSize({ width: 393, height: 852 })
    // Deterministic observer delivery reproduces the saved real-page [2,1] trace.
    // The SDK still selects from the real DOM without using diagnostic intent.
    await context.addInitScript(() => {
      const observers = new Set<{ callback: IntersectionObserverCallback; targets: Set<Element> }>()
      window.IntersectionObserver = class {
        record: { callback: IntersectionObserverCallback; targets: Set<Element> }
        constructor(callback: IntersectionObserverCallback) {
          this.record = { callback, targets: new Set() }
          observers.add(this.record)
        }
        observe(el: Element) {
          this.record.targets.add(el)
        }
        unobserve(el: Element) {
          this.record.targets.delete(el)
        }
        disconnect() {
          this.record.targets.clear()
        }
        takeRecords() {
          return []
        }
        root = null
        rootMargin = '0px 0px 300px 0px'
        thresholds = [0]
      }
      addEventListener('test-ad-near', (event) => {
        const target = document.querySelector((event as CustomEvent<string>).detail)
        for (const record of observers) {
          if (target && record.targets.has(target))
            record.callback(
              [{ target, isIntersecting: true, intersectionRatio: 0 } as IntersectionObserverEntry],
              {} as IntersectionObserver
            )
        }
      })
    })
    await installFakeAdSdk(context)
    await page.goto('/fixed-mobile-siblings')
    await expect(page.locator('.ad-banner ins')).toHaveCount(5)
    await expect.poll(() => page.evaluate(() => !!window.__fakeAds)).toBe(true)
    await twoFrames(page)
    expect(await requests(page)).toEqual([])
    await expect(header(page)).toHaveCSS('height', '0px')
    const near = async (selector: string) => {
      await page.evaluate(
        (detail) => dispatchEvent(new CustomEvent('test-ad-near', { detail })),
        selector
      )
      await twoFrames(page)
    }
    if (throwFirst)
      await page.evaluate(() => {
        window.__fakeAds.throwNext = true
      })
    await near('[data-testid="legacy-first"]')
    await expect.poll(async () => (await requests(page)).length).toBe(1)
    expect((await requests(page))[0]).toMatchObject({ order: 2, intendedOrder: 2, height: 0 })
    await expect(header(page)).toHaveCSS('height', '0px')
    await expect(header(page).locator('ins')).not.toHaveAttribute('data-adsbygoogle-status')
    await near('[data-testid="building-header-ad"]')
    await expect.poll(async () => (await requests(page)).length).toBe(2)
    expect((await requests(page))[1]).toMatchObject({
      order: 1,
      intendedOrder: 1,
      width: 320,
      height: 100,
      format: null,
      fullWidth: null,
    })
    // Later requests must not consume the failed body, even though SDK never marked it done.
    for (let index = 2; index < 5; index++) {
      await page
        .locator('.ad-banner')
        .nth(index)
        .evaluate((el) => el.setAttribute('data-next-ad', ''))
      await near('[data-next-ad]')
      await page.locator('[data-next-ad]').evaluate((el) => el.removeAttribute('data-next-ad'))
    }
    await expect.poll(async () => (await requests(page)).length).toBe(5)
    expect((await requests(page)).map((r) => [r.intendedOrder, r.order])).toEqual([
      [2, 2],
      [1, 1],
      [3, 3],
      [4, 4],
      [5, 5],
    ])
    const events = await page.evaluate(() => window.__ilsangkitAdDebug!.snapshot())
    expect(events.filter((e) => e.kind === 'push-attempt').map((e) => e.order)).toEqual([
      2, 1, 3, 4, 5,
    ])
    expect(events.filter((e) => e.kind === 'push-error').map((e) => e.order)).toEqual(
      throwFirst ? [2] : []
    )
    if (throwFirst)
      await expect(page.getByTestId('legacy-first').locator('ins')).not.toHaveAttribute(
        'data-adsbygoogle-status'
      )
    await near('[data-testid="legacy-first"]')
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
    await twoFrames(page)
    expect(await requests(page)).toHaveLength(5)
  })
}
