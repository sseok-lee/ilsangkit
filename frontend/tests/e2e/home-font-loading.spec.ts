import { expect, test, type Page } from '@playwright/test'

const FONT_TEST_BASE_URL = process.env.ILSK_FONT_TEST_BASE_URL
const BOX_TOLERANCE_PX = 4

type BoxName = 'hero' | 'search' | 'market'
type BoxSnapshot = Record<BoxName, { x: number; y: number; width: number; height: number }>

function homeUrl(): string {
  return FONT_TEST_BASE_URL ? new URL('/', FONT_TEST_BASE_URL).href : '/'
}

function createDeferred() {
  let resolve!: () => void
  const promise = new Promise<void>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

async function withTimeout<T>(promise: Promise<T>, message: string, timeoutMs = 10000): Promise<T> {
  let timeout: NodeJS.Timeout | undefined
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => reject(new Error(message)), timeoutMs)
  })

  try {
    return await Promise.race([promise, timeoutPromise])
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}

async function waitForHomeLayout(page: Page): Promise<void> {
  await expect(page.locator('.housing-redesign')).toBeVisible({ timeout: 15000 })
  await expect(page.locator('.housing-redesign .housing-title')).toBeVisible()
  await expect(page.getByRole('heading', { name: '지금, 우리 동네 거래는' })).toBeVisible()
  await page.waitForFunction(() => {
    const title = document.querySelector<HTMLElement>('.housing-redesign .housing-title')
    return title && getComputedStyle(title).fontSize !== ''
  })
}

async function snapshotBoxes(page: Page): Promise<BoxSnapshot> {
  const selectors: Record<BoxName, string> = {
    hero: '.home-hero-shell',
    search: 'label:has(input[aria-label="단지명·동네·시설 검색"])',
    market: '.home-market-section',
  }
  const entries = await Promise.all(
    (Object.entries(selectors) as Array<[BoxName, string]>).map(async ([name, selector]) => {
      const box = await page.locator(selector).first().boundingBox()
      if (!box) throw new Error(`${name} box was not measurable`)
      return [name, box] as const
    })
  )
  return Object.fromEntries(entries) as BoxSnapshot
}

function assertStableBoxes(before: BoxSnapshot, after: BoxSnapshot): void {
  for (const key of Object.keys(before) as BoxName[]) {
    for (const prop of ['x', 'y', 'width', 'height'] as const) {
      expect(Math.abs(after[key][prop] - before[key][prop]), `${key}.${prop}`).toBeLessThanOrEqual(
        BOX_TOLERANCE_PX
      )
    }
  }
}

async function expectNoHorizontalScroll(page: Page): Promise<void> {
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      )
    )
    .toBeLessThanOrEqual(1)
}

async function waitForAnimationFrames(page: Page, count = 2): Promise<void> {
  for (let index = 0; index < count; index += 1) {
    await page.evaluate(
      () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    )
  }
}

async function waitForGoogleStylesheet(page: Page, href: string): Promise<void> {
  await page.waitForFunction(
    (stylesheetHref) => {
      const links = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'))
      const link = links.find(
        (candidate) =>
          candidate.href === stylesheetHref ||
          candidate.href.startsWith('https://fonts.googleapis.com/css2')
      )

      if (!link) return false

      try {
        return Boolean(link.sheet)
      } catch {
        return false
      }
    },
    href,
    { timeout: 10000 }
  )
}

async function waitForMaterialSymbolsFont(page: Page): Promise<void> {
  await page.evaluate(async () => {
    if (!document.fonts) return

    await document.fonts.load('24px "Material Symbols Outlined"', 'calendar_month')
    await document.fonts.ready
  })
}

async function runGoogleFontDelayCheck(page: Page, viewport: { width: number; height: number }) {
  await page.setViewportSize(viewport)

  const releaseGoogleCss = createDeferred()
  const googleCssRequested = createDeferred()
  let requestCount = 0
  let googleCssUrl: string | undefined

  await page.route('https://fonts.googleapis.com/css2**', async (route) => {
    requestCount += 1
    googleCssUrl = route.request().url()
    googleCssRequested.resolve()
    await releaseGoogleCss.promise
    await route.continue()
  })

  await page.goto(homeUrl(), { waitUntil: 'domcontentloaded' })
  await withTimeout(googleCssRequested.promise, 'Google font CSS was not requested')
  await waitForHomeLayout(page)
  await page.evaluate(() => document.fonts?.ready ?? Promise.resolve())
  await waitForAnimationFrames(page)

  const before = await snapshotBoxes(page)
  await expectNoHorizontalScroll(page)

  const googleCssResponse = page.waitForResponse((response) =>
    googleCssUrl
      ? response.url() === googleCssUrl
      : response.url().startsWith('https://fonts.googleapis.com/css2')
  )
  releaseGoogleCss.resolve()
  await googleCssResponse
  if (!googleCssUrl) throw new Error('Google font CSS URL was not captured')
  await waitForGoogleStylesheet(page, googleCssUrl)
  await waitForMaterialSymbolsFont(page)
  await waitForAnimationFrames(page)

  const after = await snapshotBoxes(page)
  assertStableBoxes(before, after)
  await expectNoHorizontalScroll(page)
  expect(requestCount).toBeGreaterThan(0)
}

test.describe('home font loading stability', () => {
  test('desktop home layout stays stable when Google font CSS is delayed', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'font loading layout regression is measured in Chromium')
    await runGoogleFontDelayCheck(page, { width: 1350, height: 900 })
  })

  test('mobile home layout stays stable when Google font CSS is delayed', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'font loading layout regression is measured in Chromium')
    await runGoogleFontDelayCheck(page, { width: 390, height: 900 })
  })
})
