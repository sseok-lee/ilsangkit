import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

const api = 'http://127.0.0.1:18080'
const app = 'http://127.0.0.1:13000'
const evidence = resolve('../.superpowers/remaining-pages/lifestyle/e2e')

test.setTimeout(120_000)

async function control(
  request: APIRequestContext,
  settings: { failNext?: number; delayMs?: number } = {}
) {
  expect(
    (
      await request.post(`${api}/__test/remaining-pages`, {
        data: { domain: 'lifestyle', ...settings },
      })
    ).ok()
  ).toBe(true)
}

async function hydrated(page: Page) {
  await page.waitForFunction(() => {
    const root = document.querySelector('#__nuxt') as Element & {
      __vue_app__?: { config: { globalProperties: { $nuxt?: { isHydrating: boolean } } } }
    }
    return root?.__vue_app__?.config.globalProperties.$nuxt?.isHydrating === false
  })
}

async function blockExternal(page: Page) {
  await page.route('**/*', (route) =>
    new URL(route.request().url()).hostname === '127.0.0.1'
      ? route.continue()
      : route.abort('blockedbyclient')
  )
}

async function noOverflow(page: Page, route: string) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), route).toBe(
    true
  )
}

async function waitForAppPath(page: Page, path: string | RegExp) {
  await page.waitForURL((url) =>
    typeof path === 'string' ? url.pathname === path : path.test(url.pathname + url.search)
  )
  await hydrated(page)
}

test.beforeEach(async ({ request, page }) => {
  mkdirSync(evidence, { recursive: true })
  await control(request)
  await blockExternal(page)
})

test.afterEach(async ({ request }) => {
  await request.post(`${api}/__test/remaining-pages`, { data: { domain: null } })
})

test('direct SSR keeps grouped counts, page two links, and disabled-JS rows', async ({
  request,
  browser,
}) => {
  const grouped = await request.get('/facilities?city=seoul&district=gangnam')
  expect(grouped.status()).toBe(200)
  const groupedHtml = await grouped.text()
  expect(groupedHtml).toContain('공영주차장')
  expect(groupedHtml).toContain('25 시설')
  expect(groupedHtml).toContain('2 충전소')
  expect(groupedHtml).toContain('1 역')
  expect(groupedHtml).toMatch(/name="robots" content="noindex, follow"/)
  expect(groupedHtml).not.toMatch(/rel="canonical"/)

  const context = await browser.newContext({ javaScriptEnabled: false })
  const page = await context.newPage()
  await blockExternal(page)
  expect(
    (
      await page.goto(`${app}/facilities?city=seoul&district=gangnam&category=parking&page=2`)
    )?.status()
  ).toBe(200)
  await expect(page.locator('main a[href="/parking/parking-lifestyle-21"]')).toHaveCount(1)
  await expect(page.locator('main a[href^="/parking/parking-lifestyle-"]')).toHaveCount(5)
  await context.close()
})

test('does not call browse before a full region is selected', async ({ page, request }) => {
  const browseRequests: string[] = []
  page.on('request', (request) => {
    if (request.url().includes('/api/facilities/browse')) browseRequests.push(request.url())
  })
  await page.goto('/facilities')
  await hydrated(page)
  await expect(page.getByText('시·도와 구·군을 선택해 주세요')).toBeVisible()
  expect(browseRequests).toEqual([])
  const audit = await request.get(`${api}/__test/remaining-pages`)
  expect(audit.ok()).toBe(true)
  const body = (await audit.json()) as { success: boolean; data: { browseRequests: string[] } }
  expect(body.data.browseRequests).toEqual([])
})

test('keeps selected region and page after detail navigation by whitespace and keyboard', async ({
  page,
}) => {
  await page.goto('/facilities?city=seoul&district=gangnam&category=parking&page=2')
  await hydrated(page)
  const row = page.getByRole('link', { name: /검증주차장21/ })
  await expect(row).toBeVisible()
  const href = await row.getAttribute('href')
  expect(href).toBe('/parking/parking-lifestyle-21')
  const box = await row.boundingBox()
  await Promise.all([
    page.waitForURL((url) => url.pathname === href),
    row.click({ position: { x: Math.max(4, box!.width - 4), y: box!.height / 2 } }),
  ])
  await hydrated(page)
  expect(new URL(page.url()).pathname).toBe(href)
  await expect(page.locator('main p').filter({ hasText: /^평일 09:00~21:00$/ })).toBeVisible()
  await page.goBack()
  await waitForAppPath(page, /\/facilities\?.*page=2/)
  const restoredRow = page.getByRole('link', { name: /검증주차장21/ })
  await expect(restoredRow).toBeVisible()
  await restoredRow.focus()
  await Promise.all([page.waitForURL((url) => url.pathname === href), page.keyboard.press('Enter')])
  await hydrated(page)
  expect(new URL(page.url()).pathname).toBe(href)
})

test('empty category, transient failure, retry recovery, and late responses stay distinct', async ({
  page,
  request,
}) => {
  await page.goto('/facilities?city=seoul&district=gangnam&category=library')
  await hydrated(page)
  await expect(page.getByText('조건에 맞는 생활시설이 없습니다')).toBeVisible()
  await expect(page.getByText(/0 시설/)).toBeVisible()

  await control(request, { failNext: 20 })
  expect((await page.goto('/facilities?city=seoul&district=gangnam&q=검증'))?.status()).toBe(503)
  await hydrated(page)
  await expect(page.locator('main').getByText('생활시설 정보를 불러오지 못했습니다')).toBeVisible()
  await expect(page.locator('main').getByText(/전체 0건|0 시설/)).toHaveCount(0)

  await control(request)
  await page.getByRole('button', { name: '다시 시도' }).click()
  await expect(page.getByRole('link', { name: /검증주차장1/ })).toBeVisible()

  await control(request, { delayMs: 700 })
  await page.goto('/facilities?city=seoul&district=gangnam')
  await hydrated(page)
  const staleRequest = page.waitForRequest((request) => {
    const url = request.url()
    return url.includes('/api/facilities/browse') && url.includes('keyword=%EA%B2%80%EC%A6%9D')
  })
  await page.getByLabel('생활시설 검색어').fill('검증')
  await page.getByRole('button', { name: '검색' }).click()
  await page.waitForURL(/q=/)
  const stale = await staleRequest
  const staleSettled = stale.response().catch(() => null)
  await control(request)
  await page.getByLabel('시·도 선택').selectOption('gyeonggi')
  await expect(page.getByLabel('구·군 선택').locator('option[value="suwon"]')).toHaveCount(1)
  await page.getByLabel('구·군 선택').selectOption('suwon')
  await page.getByLabel('생활시설 검색어').fill('수원')
  await page.getByRole('button', { name: '검색' }).click()
  await expect(page.getByRole('link', { name: /수원검증주차장1/ })).toBeVisible()
  await staleSettled
  await page.waitForTimeout(750)
  await expect(page.getByRole('link', { name: /수원검증주차장1/ })).toBeVisible()
  await expect(page.locator('main').getByText('검증주차장21')).toHaveCount(0)
})

test('region list, subway detail, and trash canonical pages render domain-specific content', async ({
  page,
  request,
}) => {
  await page.goto('/seoul/gangnam/parking?page=2')
  await hydrated(page)
  await expect(page.getByRole('link', { name: /검증주차장21/ })).toBeVisible()
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, follow')

  await page.goto('/subway/gangnam-lifestyle')
  await hydrated(page)
  const subwayArticle = page.locator('article').first()
  await expect(
    subwayArticle.getByRole('heading', { name: '검증강남역', level: 1 }).first()
  ).toBeVisible()
  await expect(subwayArticle.getByText('2호선', { exact: true }).first()).toBeVisible()
  await expect(subwayArticle.getByText('신분당선', { exact: true }).first()).toBeVisible()

  await page.goto('/seoul/gangnam/trash')
  await hydrated(page)
  await expect(page.locator('main').getByText('검증1동').first()).toBeVisible()
  await expect(page.getByRole('link', { name: /검증1동/ })).toHaveAttribute(
    'href',
    '/trash/areas/101'
  )
  await expect(page.getByRole('link', { name: /원문 보기/ })).toBeVisible()

  const source = await request.get('/trash/901', { maxRedirects: 0 })
  expect(source.status()).toBe(200)
  expect(source.headers().location).toBeUndefined()
  const sourceHtml = await source.text()
  expect(sourceHtml).toContain('원본 배출 일정')
  expect(sourceHtml).toContain('검증1동')
  expect(sourceHtml).toMatch(/name="robots" content="noindex, follow"/)
  await page.goto('/trash/901')
  await hydrated(page)
  await expect(page).toHaveURL(/\/trash\/901$/)
  await expect(page.locator('main').getByText('원본 배출 일정').first()).toBeVisible()
  await expect(
    page.locator('main').getByText('원본 적용 조건: 일반 월+수+금').first()
  ).toBeVisible()
})

test('area list source navigation loads and restores modes on same mounted routes', async ({
  page,
  request,
}) => {
  await page.goto('/trash?city=서울특별시&district=강남구')
  await hydrated(page)
  await expect(page.getByRole('heading', { name: '동별 배출 안내' })).toBeVisible()
  await expect(page.getByRole('link', { name: /원문 보기/ })).toBeVisible()

  await page.getByRole('link', { name: /원문 보기/ }).click()
  await page.waitForURL(/coverage=unresolved/)
  await hydrated(page)
  await expect(page.getByRole('heading', { name: '배출 일정' })).toBeVisible()
  await expect(page.locator('main').getByText('문전 배출').first()).toBeVisible()

  let audit = await request.get(`${api}/__test/remaining-pages`)
  expect(audit.ok()).toBe(true)
  let body = (await audit.json()) as {
    success: boolean
    data: { wasteScheduleRequests: Array<Record<string, string>> }
  }
  expect(body.data.wasteScheduleRequests.at(-1)).toEqual(
    expect.objectContaining({
      city: '서울특별시',
      district: '강남구',
      coverage: 'unresolved',
      page: '1',
      limit: '20',
    })
  )

  await page.goBack()
  await waitForAppPath(page, /\/trash\?.*district=/)
  await expect(page.getByRole('heading', { name: '동별 배출 안내' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '배출 일정' })).toHaveCount(0)

  await page.goto('/seoul/gangnam/trash')
  await hydrated(page)
  await expect(page.getByRole('heading', { name: '동별 배출 안내' })).toBeVisible()
  await page.evaluate(() => {
    const root = document.querySelector('#__nuxt') as Element & {
      __vue_app__?: {
        config: { globalProperties: { $router?: { push: (path: string) => Promise<void> } } }
      }
    }
    return root.__vue_app__?.config.globalProperties.$router?.push(
      '/seoul/gangnam/trash?coverage=unresolved&keyword=역삼'
    )
  })
  await page.waitForURL(/keyword=/)
  await hydrated(page)
  await expect(page.getByRole('heading', { name: '배출 일정' })).toBeVisible()
  await expect(page.locator('main').getByText('역삼검증21동').first()).toBeVisible()

  audit = await request.get(`${api}/__test/remaining-pages`)
  body = (await audit.json()) as {
    success: boolean
    data: { wasteScheduleRequests: Array<Record<string, string>> }
  }
  expect(body.data.wasteScheduleRequests.at(-1)).toEqual(
    expect.objectContaining({
      city: '서울특별시',
      district: '강남구',
      keyword: '역삼',
      coverage: 'unresolved',
      page: '1',
      limit: '20',
    })
  )

  await page.goBack()
  await waitForAppPath(page, '/seoul/gangnam/trash')
  await expect(page.getByRole('heading', { name: '동별 배출 안내' })).toBeVisible()
  await expect(page.locator('main').getByText('역삼검증21동')).toHaveCount(0)

  await control(request, { delayMs: 700 })
  await page.goto('/trash?city=서울특별시&district=강남구')
  await hydrated(page)
  await expect(page.getByRole('heading', { name: '동별 배출 안내' })).toBeVisible()
  const delayedSourceRequest = page.waitForRequest(
    (req) => req.url().includes('/api/waste-schedules') && req.url().includes('coverage=unresolved')
  )
  await page.getByRole('link', { name: /원문 보기/ }).click()
  await page.waitForURL(/coverage=unresolved/)
  await delayedSourceRequest
  await page.goBack()
  await waitForAppPath(page, /\/trash\?.*district=/)
  await expect(page.getByRole('heading', { name: '동별 배출 안내' })).toBeVisible()
  await page.waitForTimeout(900)
  await expect(page.getByRole('heading', { name: '동별 배출 안내' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '배출 일정' })).toHaveCount(0)
  await control(request)
})

test('legacy schedule redirects to a validated source and source return context stays bounded', async ({
  page,
  request,
}) => {
  const legacy = await request.get('/trash?city=서울특별시&district=강남구&schedule=901&bad=x', {
    maxRedirects: 0,
  })
  expect(legacy.status()).toBe(302)
  expect(legacy.headers().location).toBe(
    '/trash/901#from=/trash?city=%25EC%2584%259C%25EC%259A%25B8%25ED%258A%25B9%25EB%25B3%2584%25EC%258B%259C&district=%25EA%25B0%2595%25EB%2582%25A8%25EA%25B5%25AC'
  )

  await page.goto('/trash?city=서울특별시&district=강남구')
  await hydrated(page)
  await page.evaluate(() => window.scrollTo(0, 520))
  await page.getByRole('link', { name: /검증1동/ }).scrollIntoViewIfNeeded()
  const listScrollY = await page.evaluate(() => window.scrollY)
  expect(listScrollY).toBeGreaterThan(100)
  await page.getByRole('link', { name: /검증1동/ }).click()
  await waitForAppPath(page, '/trash/areas/101')
  await expect(
    page.getByRole('heading', { name: '서울특별시 강남구 검증1동', level: 1 })
  ).toBeVisible()
  await page.getByRole('link', { name: '목록으로 돌아가기' }).click()
  await waitForAppPath(page, /\/trash\?.*district=/)
  await expect
    .poll(() => page.evaluate((saved) => Math.abs(window.scrollY - saved), listScrollY))
    .toBeLessThanOrEqual(40)

  await page.getByRole('link', { name: /검증1동/ }).click()
  await waitForAppPath(page, '/trash/areas/101')
  await expect(
    page.getByRole('heading', { name: '서울특별시 강남구 검증1동', level: 1 })
  ).toBeVisible()
  await page.evaluate(() => window.scrollTo(0, 900))
  const sourceLink = page.getByRole('link', { name: /원문 보기/ }).first()
  await sourceLink.scrollIntoViewIfNeeded()
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(100)
  const areaScrollYAtClick = page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        const source = Array.from(document.querySelectorAll<HTMLAnchorElement>('a')).find((link) =>
          link.textContent?.includes('원문 보기')
        )
        source?.addEventListener('click', () => resolve(window.scrollY), {
          once: true,
          capture: true,
        })
      })
  )
  await sourceLink.click()
  const areaScrollY = await areaScrollYAtClick
  await waitForAppPath(page, '/trash/901')
  await expect(
    page.locator('main').getByText('원본 적용 조건: 일반 월+수+금').first()
  ).toBeVisible()
  await page.getByRole('link', { name: '동별 안내로 돌아가기' }).click()
  await waitForAppPath(page, '/trash/areas/101')
  await expect
    .poll(() => page.evaluate((saved) => Math.abs(window.scrollY - saved), areaScrollY))
    .toBeLessThanOrEqual(40)

  await page.mouse.wheel(0, -1000)
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(areaScrollY - 100)
  const userScrollY = await page.evaluate(() => window.scrollY)
  await page.waitForTimeout(180)
  await expect
    .poll(() => page.evaluate((saved) => Math.abs(window.scrollY - saved), userScrollY))
    .toBeLessThanOrEqual(40)

  await page.goto('/trash/901#from=https%3A%2F%2Fevil.test%2Ftrash')
  await hydrated(page)
  await expect(page.getByRole('link', { name: /서울특별시 강남구 목록으로/ })).toBeVisible()
  await expect(page.getByRole('link', { name: '동별 안내로 돌아가기' })).toHaveCount(0)
  expect(new URL(page.url()).hash).toBe('')
})

test('waste source unresolved requests keep filters on first load and CSR transitions', async ({
  page,
  request,
}) => {
  expect(
    (await page.goto('/trash?coverage=unresolved&city=서울특별시&district=강남구'))?.status()
  ).toBe(200)
  await hydrated(page)
  await expect(page.locator('main').getByText('검증1동').first()).toBeVisible()

  let audit = await request.get(`${api}/__test/remaining-pages`)
  expect(audit.ok()).toBe(true)
  let body = (await audit.json()) as {
    success: boolean
    data: { wasteScheduleRequests: Array<Record<string, string>> }
  }
  expect(body.data.wasteScheduleRequests[0]).toEqual(
    expect.objectContaining({
      city: '서울특별시',
      district: '강남구',
      coverage: 'unresolved',
      page: '1',
      limit: '20',
    })
  )

  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes('/api/waste-schedules') && response.url().includes('page=2')
    ),
    page.getByRole('link', { name: '2 페이지' }).click(),
  ])
  await page.waitForURL(/page=2/)
  await hydrated(page)

  audit = await request.get(`${api}/__test/remaining-pages`)
  body = (await audit.json()) as {
    success: boolean
    data: { wasteScheduleRequests: Array<Record<string, string>> }
  }
  expect(body.data.wasteScheduleRequests.at(-1)).toEqual(
    expect.objectContaining({
      city: '서울특별시',
      district: '강남구',
      coverage: 'unresolved',
      page: '2',
      limit: '20',
    })
  )

  await page.goto('/seoul/gangnam/trash?coverage=unresolved&keyword=역삼')
  await hydrated(page)
  await expect(page.locator('main').getByText('역삼검증21동').first()).toBeVisible()

  audit = await request.get(`${api}/__test/remaining-pages`)
  body = (await audit.json()) as {
    success: boolean
    data: { wasteScheduleRequests: Array<Record<string, string>> }
  }
  expect(body.data.wasteScheduleRequests.at(-1)).toEqual(
    expect.objectContaining({
      city: '서울특별시',
      district: '강남구',
      keyword: '역삼',
      coverage: 'unresolved',
      page: '1',
      limit: '20',
    })
  )
})

test('six lifestyle views fit four widths without hydration errors', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (/hydration.*mismatch/i.test(message.text())) errors.push(message.text())
  })
  const routes = [
    '/facilities?city=seoul&district=gangnam',
    '/facilities?city=seoul&district=gangnam&category=parking&page=2',
    '/facilities?city=seoul&district=gangnam&category=library',
    '/parking/parking-lifestyle-21',
    '/subway/gangnam-lifestyle',
    '/seoul/gangnam/trash',
    '/trash/areas/101',
    '/trash/901',
  ]
  for (const width of [360, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    for (const route of routes) {
      expect((await page.goto(route))?.status(), route).toBe(200)
      await hydrated(page)
      await noOverflow(page, route)
      if (width === 390 || width === 1440 || route.startsWith('/trash')) {
        await page.screenshot({
          path: resolve(evidence, `${route.replace(/[^a-z0-9]/gi, '-')}-${width}.png`),
          fullPage: true,
        })
      }
    }
  }
  expect(errors).toEqual([])
})
