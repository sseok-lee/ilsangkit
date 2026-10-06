import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test, type APIRequestContext, type Page, type TestInfo } from '@playwright/test'

const fixtureApi = 'http://127.0.0.1:18080'
const evidenceDir = resolve(
  process.cwd(),
  '../.superpowers/sdd/2026-09-22-exploration-search-redesign/task8-evidence'
)
const realEstateTypes = [
  'apt-sale',
  'apt-rent',
  'villa-sale',
  'villa-rent',
  'offitel-sale',
  'offitel-rent',
] as const

type ExplorationDomain = 'buildings' | 'facilities' | 'property' | 'complexes' | 'map'

type FixtureRule = {
  domain: ExplorationDomain
  keyword?: string
  type?: string
  city?: string
  district?: string
  page?: number
  level?: number
  count?: number
  ms?: number
}

type FixtureControlBody = {
  failures?: FixtureRule[]
  zeros?: FixtureRule[]
  delays?: FixtureRule[]
}

test.setTimeout(120_000)

function ensureEvidenceDir() {
  mkdirSync(evidenceDir, { recursive: true })
}

async function resetFixture(request: APIRequestContext) {
  const response = await request.post(`${fixtureApi}/__test/exploration/reset`)
  expect(response.ok()).toBe(true)
}

async function controlFixture(request: APIRequestContext, body: FixtureControlBody = {}) {
  const response = await request.post(`${fixtureApi}/__test/exploration/control`, { data: body })
  expect(response.ok()).toBe(true)
  return response.json() as Promise<{
    success: true
    data: {
      failures: FixtureRule[]
      zeros: FixtureRule[]
      delays: FixtureRule[]
      requests: Array<Record<string, unknown>>
    }
  }>
}

async function hydrated(page: Page) {
  await page.waitForFunction(() => {
    const root = document.querySelector('#__nuxt') as Element & {
      __vue_app__?: { config: { globalProperties: { $nuxt?: { isHydrating: boolean } } } }
    }
    return root?.__vue_app__?.config.globalProperties.$nuxt?.isHydrating === false
  })
}

async function blockExternalNetwork(page: Page) {
  await page.route('**/*', (route) =>
    new URL(route.request().url()).hostname === '127.0.0.1'
      ? route.continue()
      : route.abort('blockedbyclient')
  )
}

async function expectNoOverflow(page: Page) {
  await expect.poll(() => page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }))).toEqual(await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.clientWidth,
  })))
}

async function expectMinimumHeight(page: Page, selector: string, minimum = 44) {
  const heights = await page.locator(selector).evaluateAll((elements) =>
    elements
      .filter((element) => {
        const style = getComputedStyle(element)
        const rect = element.getBoundingClientRect()
        return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0
      })
      .map((element) => element.getBoundingClientRect().height)
  )
  expect(heights.length, `${selector} should have visible targets`).toBeGreaterThan(0)
  expect(Math.min(...heights), `${selector}: ${JSON.stringify(heights)}`).toBeGreaterThanOrEqual(minimum)
}

async function waitForSearch(page: Page, text: string) {
  await expect(page.locator('.search-summary')).toContainText(text)
  await expect(page.locator('.result-skeleton')).toHaveCount(0)
}

async function screenshot(page: Page, testInfo: TestInfo, name: string, fullPage = true) {
  ensureEvidenceDir()
  await page.screenshot({
    path: resolve(evidenceDir, `${testInfo.project.name}-${name}.png`),
    fullPage,
  })
}

test.beforeEach(async ({ request }) => {
  ensureEvidenceDir()
  await resetFixture(request)
})

test('fixture exposes the real exploration envelopes for six types and four map granularities', async ({
  request,
}) => {
  const regions = await request.get(`${fixtureApi}/api/meta/regions`)
  expect(regions.status()).toBe(200)
  expect((await regions.json()).data).toEqual(expect.arrayContaining([
    expect.objectContaining({ city: '서울특별시', district: '강남구', lat: 37.5172, lng: 127.0473 }),
  ]))

  for (const type of realEstateTypes) {
    const complexes = await request.get(
      `${fixtureApi}/api/real-estate/${type}/complexes?page=1&limit=15`
    )
    expect(complexes.status(), type).toBe(200)
    const complexBody = await complexes.json()
    expect(complexBody).toMatchObject({
      success: true,
      data: { page: 1, total: 52, totalPages: 4 },
    })
    expect(complexBody.data.items).toHaveLength(15)
    expect(complexBody.data.items[0].latestDeals).toEqual(expect.objectContaining({
      sale: expect.anything(),
      jeonse: expect.anything(),
      wolse: expect.anything(),
    }))

    const map = await request.get(
      `${fixtureApi}/api/real-estate/${type}/map?level=13&swLat=33&swLng=124&neLat=39&neLng=132`
    )
    expect(map.status(), type).toBe(200)
    expect(await map.json()).toMatchObject({
      success: true,
      data: { granularity: 'city', exact: true },
    })
  }

  for (const [level, granularity] of [[9, 'district'], [7, 'dong'], [5, 'building']] as const) {
    const response = await request.get(
      `${fixtureApi}/api/real-estate/apt-rent/map?level=${level}&swLat=37.4&swLng=126.8&neLat=37.7&neLng=127.2`
    )
    expect(response.status()).toBe(200)
    const body = await response.json()
    expect(body).toMatchObject({
      success: true,
      data: { granularity, exact: true },
    })
    if (granularity === 'building') {
      expect(body.data.items[0]).toEqual(expect.objectContaining({ bjdCode: expect.any(String) }))
    }
  }

  const buildings = await request.get(`${fixtureApi}/api/real-estate/search?keyword=검증`)
  expect(await buildings.json()).toMatchObject({
    success: true,
    data: {
      buildingCounts: { apt: 23, villa: 17, offitel: 11 },
      categories: expect.any(Array),
    },
  })

  const facilities = await request.post(`${fixtureApi}/api/facilities/search`, {
    data: { keyword: '검증', grouped: true, limit: 3 },
  })
  expect(await facilities.json()).toMatchObject({
    success: true,
    data: { totalCount: 42, categories: expect.any(Array), recovery: null },
  })
})

test('SSR list pages keep counts, crawl links, page-two content, and isolated empty/503 outcomes', async ({
  request,
}) => {
  const national = await request.get('/real-estate/apt-sale')
  expect(national.status()).toBe(200)
  const nationalHtml = await national.text()
  expect((nationalHtml.match(/class="exploration-building-row"/g) ?? [])).toHaveLength(15)
  expect(nationalHtml).toContain('검증 아파트 매매 전국 01')
  expect(nationalHtml).toMatch(/href="\/real-estate\/apt-sale\/seoul"/)
  expect(nationalHtml).toMatch(/rel="canonical"[^>]+\/real-estate\/apt-sale/)

  const city = await request.get('/real-estate/apt-sale/seoul')
  expect(city.status()).toBe(200)
  const cityHtml = await city.text()
  expect((cityHtml.match(/class="exploration-building-row"/g) ?? [])).toHaveLength(6)
  expect(cityHtml).toContain('검증 아파트 매매 서울 01')
  expect(cityHtml).toMatch(/href="\/real-estate\/apt-sale\/seoul\/gangnam"/)

  const district = await request.get('/real-estate/apt-rent/seoul/gangnam')
  expect(district.status()).toBe(200)
  const districtHtml = await district.text()
  expect((districtHtml.match(/class="exploration-building-row"/g) ?? [])).toHaveLength(24)
  expect(districtHtml).toContain('검증 아파트 전월세 강남구 01')
  expect(districtHtml).toContain('2026.09.18')
  expect(districtHtml).toContain('2026.09.12')

  const pageTwo = await request.get('/real-estate/apt-rent/seoul/gangnam?page=2')
  expect(pageTwo.status()).toBe(200)
  const pageTwoHtml = await pageTwo.text()
  expect((pageTwoHtml.match(/class="exploration-building-row"/g) ?? [])).toHaveLength(24)
  expect(pageTwoHtml).toContain('검증 아파트 전월세 강남구 2페이지 01')
  expect(pageTwoHtml).not.toContain('검증 아파트 전월세 강남구 01')
  expect(pageTwoHtml).toMatch(/name="robots" content="noindex, follow"/)
  expect(pageTwoHtml).not.toMatch(/rel="canonical"/)

  await controlFixture(request, {
    zeros: [{ domain: 'complexes', type: 'offitel-sale', city: '세종', count: 1 }],
  })
  const empty = await request.get('/real-estate/offitel-sale/sejong')
  expect(empty.status()).toBe(200)
  expect(await empty.text()).toContain('이 지역에는 공개된 주요 건물이 없습니다')

  await controlFixture(request, {
    failures: [{ domain: 'complexes', type: 'villa-sale', city: '제주', count: 2 }],
  })
  const failed = await request.get('/real-estate/villa-sale/jeju')
  expect(failed.status()).toBe(503)
  expect(failed.headers()['cache-control']).toContain('no-store')
  expect(await failed.text()).toContain('주요 건물을 불러오지 못했습니다')

  const state = await controlFixture(request)
  const failedAttempts = state.data.requests.filter((entry) =>
    entry.domain === 'complexes' && entry.type === 'villa-sale' && entry.city === '제주'
  )
  expect(failedAttempts.length).toBeGreaterThanOrEqual(2)

  const unaffected = await request.get('/real-estate/apt-sale/seoul')
  expect(unaffected.status()).toBe(200)
  expect(await unaffected.text()).toContain('검증 아파트 매매 서울 01')
})

test('district page-two direct entry preserves SSR rows after hydration', async ({
  page,
}) => {
  await blockExternalNetwork(page)
  // A client API recovery must not conceal a wrong or missing SSR hydration payload.
  await page.route(`${fixtureApi}/**`, (route) => route.abort('blockedbyclient'))
  await page.goto('/real-estate/apt-rent/seoul/gangnam?page=2')
  await hydrated(page)
  await expect(page.locator('.exploration-building-row')).toHaveCount(24)
  await expect(page.locator('.exploration-building-row').first()).toContainText('2페이지 01')
  await expect(page.getByRole('link', { name: '2 페이지' })).toHaveAttribute('aria-current', 'page')
})

test('district client pagination, history, and transaction tabs restore URL-derived state', async ({
  page,
}) => {
  await blockExternalNetwork(page)
  await page.goto('/real-estate/apt-rent/seoul/gangnam')
  await hydrated(page)
  await expect(page.locator('.exploration-building-row')).toHaveCount(24)
  await page.getByRole('link', { name: '2 페이지' }).click()
  await expect(page).toHaveURL(/page=2/)
  await expect(page.locator('.exploration-building-row').first()).toContainText('2페이지 01')
  await page.goBack()
  await expect(page).not.toHaveURL(/page=2/)
  await expect(page.locator('.exploration-building-row').first()).toContainText('강남구 01')
  await page.goForward()
  await expect(page).toHaveURL(/page=2/)
  await expect(page.locator('.exploration-building-row').first()).toContainText('2페이지 01')

  await page.getByRole('link', { name: '매매', exact: true }).click()
  await expect(page).toHaveURL('/real-estate/apt-sale/seoul/gangnam')
  await expect(page.locator('.exploration-building-row')).toHaveCount(24)
  await page.getByRole('link', { name: '전월세', exact: true }).click()
  await expect(page).toHaveURL('/real-estate/apt-rent/seoul/gangnam')
  await expect(page.locator('.exploration-building-row').first()).toContainText('전세')
  await expect(page.locator('.exploration-building-row').first()).toContainText('월세')
  await page.goBack()
  await expect(page).toHaveURL('/real-estate/apt-sale/seoul/gangnam')
})

test('facility category and legacy keyword survive refresh while a new search clears the category', async ({
  page,
}) => {
  await blockExternalNetwork(page)
  await page.goto('/search?keyword=검증&tab=facilities&facilityCategory=parking')
  await hydrated(page)
  await waitForSearch(page, '생활시설 42곳')
  await expect(page.getByRole('link', { name: /공영주차장 7/ })).toHaveAttribute('aria-current', 'page')
  await expect(page.locator('a[href="/parking?keyword=%EA%B2%80%EC%A6%9D"]')).toHaveText(/전체 보기/)
  await expect(page.locator('.facility-search-row')).toHaveCount(3)

  await page.reload()
  await hydrated(page)
  await waitForSearch(page, '생활시설 42곳')
  await expect(page.getByRole('link', { name: /공영주차장 7/ })).toHaveAttribute('aria-current', 'page')

  await page.getByRole('searchbox', { name: '통합 검색' }).fill('새검색')
  await page.getByRole('button', { name: '검색', exact: true }).click()
  await expect(page).toHaveURL(/q=%EC%83%88%EA%B2%80%EC%83%89/)
  await expect(page).toHaveURL(/tab=facilities/)
  await expect(page).not.toHaveURL(/facilityCategory=/)
  await waitForSearch(page, '생활시설 42곳')
  await expect(page.getByRole('link', { name: '전체 카테고리' })).toHaveAttribute('aria-current', 'page')
  await expect(page.getByText('검증 공영주차장 01')).toHaveCount(0)
  await expect(page.getByText('새검색 병원 01')).toBeVisible()
})

test('late A responses cannot replace B results', async ({ page, request }) => {
  await controlFixture(request, {
    delays: [
      { domain: 'buildings', keyword: '지연A', ms: 700 },
      { domain: 'facilities', keyword: '지연A', ms: 700 },
      { domain: 'buildings', keyword: '최신B', ms: 20 },
      { domain: 'facilities', keyword: '최신B', ms: 20 },
    ],
  })
  await blockExternalNetwork(page)
  await page.goto('/search?q=지연A')
  await hydrated(page)
  await expect.poll(async () => {
    const state = await controlFixture(request)
    return state.data.requests.filter((entry) => entry.keyword === '지연A').length
  }).toBeGreaterThanOrEqual(2)

  await page.getByRole('searchbox', { name: '통합 검색' }).fill('최신B')
  await page.getByRole('button', { name: '검색', exact: true }).click()
  await waitForSearch(page, '최신B')
  await expect(page.getByText('최신B 아파트 공통 01')).toBeVisible()
  await expect(page.getByText('최신B 병원 01')).toBeVisible()
  await page.waitForTimeout(850)
  await expect(page.getByText('지연A 아파트 공통 01')).toHaveCount(0)
  await expect(page.getByText('지연A 병원 01')).toHaveCount(0)
  await expect(page.getByRole('searchbox', { name: '통합 검색' })).toHaveValue('최신B')
})

test('facility retries exhaust both ofetch attempts, expose a UI error, then recover', async ({
  page,
  request,
}, testInfo) => {
  await controlFixture(request, {
    failures: [{ domain: 'facilities', keyword: '부분실패', count: 2 }],
  })
  await blockExternalNetwork(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/search?q=부분실패')
  await hydrated(page)
  await expect(page.getByText('부분실패 아파트 공통 01')).toBeVisible()
  const alert = page.locator('#facility-results-title').locator('..').locator('..').getByRole('alert')
  await expect(alert).toBeVisible()
  await expect(alert).toContainText('생활시설을 불러오지 못했습니다')
  await screenshot(page, testInfo, 'partial-failure-390')

  let state = await controlFixture(request)
  const attempts = state.data.requests.filter((entry) =>
    entry.domain === 'facilities' && entry.keyword === '부분실패'
  )
  expect(attempts).toHaveLength(2)

  await alert.getByRole('button', { name: '다시 시도' }).click()
  await expect(page.getByText('부분실패 병원 01')).toBeVisible()
  await expect(alert).toHaveCount(0)
  state = await controlFixture(request)
  expect(state.data.requests.filter((entry) =>
    entry.domain === 'facilities' && entry.keyword === '부분실패'
  )).toHaveLength(3)
})

test('property page two supports direct entry, refresh, and browser history', async ({ page }) => {
  await blockExternalNetwork(page)
  const path = '/search?q=검증&tab=buildings&property=apt&page=2'
  await page.goto(path)
  await hydrated(page)
  await expect(page.locator('.exploration-building-row')).toHaveCount(20)
  await expect(page.locator('.exploration-building-row').first()).toContainText('검증 아파트 검색 2페이지 01')
  await expect(page.getByRole('link', { name: '2 페이지' })).toHaveAttribute('aria-current', 'page')

  await page.reload()
  await hydrated(page)
  await expect(page.locator('.exploration-building-row').first()).toContainText('2페이지 01')
  await page.getByRole('link', { name: '1 페이지' }).click()
  await expect(page).not.toHaveURL(/page=2/)
  await expect(page.locator('.exploration-building-row').first()).toContainText('검증 아파트 검색 01')
  await page.goBack()
  await expect(page).toHaveURL(/page=2/)
  await expect(page.locator('.exploration-building-row').first()).toContainText('2페이지 01')
})

for (const width of [360, 390, 768, 1440]) {
  test(`map, list, unified search, and facility search are usable at ${width}px`, async ({
    page,
  }, testInfo) => {
    const pageErrors: string[] = []
    page.on('pageerror', (error) => pageErrors.push(error.message))
    await blockExternalNetwork(page)
    await page.setViewportSize({ width, height: width < 768 ? 844 : 960 })

    await page.goto('/real-estate/apt-rent/seoul/gangnam')
    await hydrated(page)
    await expect(page.locator('.exploration-building-row')).toHaveCount(24)
    await expectNoOverflow(page)
    await expectMinimumHeight(page, '.ui-segmented__item', 38)
    await expect(page.locator('h1')).toHaveCSS('font-size', width < 768 ? '27px' : '36px')
    await screenshot(page, testInfo, `list-${width}`)

    await page.goto('/search?q=검증')
    await hydrated(page)
    await waitForSearch(page, '부동산 51곳, 생활시설 42곳')
    await expectNoOverflow(page)
    await expectMinimumHeight(page, '.search-tab')
    await expectMinimumHeight(page, '.search-result-group__more')
    await screenshot(page, testInfo, `search-${width}`)

    await page.goto('/search?q=검증&tab=facilities&facilityCategory=parking')
    await hydrated(page)
    await waitForSearch(page, '생활시설 42곳')
    await expect(page.locator('.facility-search-row')).toHaveCount(3)
    await expectNoOverflow(page)
    await expectMinimumHeight(page, '.facility-filter')
    await expectMinimumHeight(page, '.facility-search-row')
    await screenshot(page, testInfo, `facilities-${width}`)

    await page.goto('/real-estate#type=apt-rent&level=13&lat=36.5&lng=127.8')
    await hydrated(page)
    await expect(page.locator('[data-testid="map-sidebar-item"]')).toHaveCount(32)
    await expect(page.locator('[data-testid="map-sidebar-error"]')).not.toHaveCount(0)
    await expect(page.locator('[data-testid="map-sidebar-error"] a[href="/real-estate/apt-rent"]')).not.toHaveCount(0)
    await expectNoOverflow(page)
    await expectMinimumHeight(page, '[data-testid="map-canvas-error"] button')
    await expectMinimumHeight(page, '[data-testid="map-sidebar-error"] button')
    await expectMinimumHeight(page, '[data-testid="map-sidebar-error"] a')
    await screenshot(page, testInfo, `map-sdk-error-${width}`, false)

    expect(pageErrors).toEqual([])
  })
}

test('normal empty search is distinct from transient failures', async ({ page, request }, testInfo) => {
  await controlFixture(request, {
    zeros: [
      { domain: 'buildings', keyword: '정상빈결과', count: 1 },
      { domain: 'facilities', keyword: '정상빈결과', count: 1 },
    ],
  })
  await blockExternalNetwork(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/search?q=정상빈결과')
  await hydrated(page)
  await expect(page.getByText('검색 결과가 없어요')).toBeVisible()
  await expect(page.getByRole('alert')).toHaveCount(0)
  await screenshot(page, testInfo, 'empty-search-390')

  await page.goto('/search?q=검증')
  await waitForSearch(page, '부동산 51곳, 생활시설 42곳')
  await expect(page.getByText('검증 아파트 공통 01')).toBeVisible()
})
