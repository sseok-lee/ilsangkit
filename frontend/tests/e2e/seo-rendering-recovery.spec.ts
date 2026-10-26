import { expect, test, type Page } from '@playwright/test'

const hospital = '/hospital/hospital-seo-fixture'
const sale = '/real-estate/apt-sale/seoul/gangnam/회복아파트'
const rent = '/real-estate/apt-rent/seoul/gangnam/회복아파트'

async function hydrated(page: Page) {
  await page.waitForFunction(() => {
    const root = document.querySelector('#__nuxt') as Element & {
      __vue_app__?: { config: { globalProperties: { $nuxt?: { isHydrating: boolean } } } }
    }
    return root?.__vue_app__?.config.globalProperties.$nuxt?.isHydrating === false
  })
  await page.waitForLoadState('networkidle')
}

async function snapshot(page: Page) {
  return {
    heading: await page.locator('h1').first().innerText(),
    title: await page.title(),
    canonical: await page.locator('link[rel=canonical]').getAttribute('href'),
    robots: await page.locator('meta[name=robots]').getAttribute('content'),
  }
}

async function blockBrowserApi(page: Page) {
  const blocked: string[] = []
  const payloads: string[] = []
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url())
    if (url.pathname.startsWith('/api/')) {
      blocked.push(url.pathname)
      return route.abort('blockedbyclient')
    }
    if (url.pathname.endsWith('_payload.json')) payloads.push(url.pathname + url.search)
    if (url.hostname !== '127.0.0.1') return route.abort('blockedbyclient')
    return route.continue()
  })
  return { blocked, payloads }
}

// #940: 주변 단지는 NearbyComplexList 행(단지명은 heading 아님)으로 렌더된다. 활성 패널의 행 링크로 찾는다.
function nearbyRowLink(page: Page, name: string) {
  return page
    .locator('#nearby [role="tabpanel"] [data-testid="nearby-row"] a')
    .filter({ has: page.getByText(name, { exact: true }) })
}

async function blockExternalOnly(page: Page) {
  await page.route('**/*', (route) => {
    const url = new URL(route.request().url())
    if (url.hostname !== '127.0.0.1') return route.abort('blockedbyclient')
    return route.fallback()
  })
}

for (const [path, name, text] of [
  [hospital, '렌더링회복병원', ['테헤란로 123', '내과']],
  [sale, '회복아파트', ['주소 후보 2건', '8억', '이웃아파트']],
] as const) {
  test(`SSR content survives hydration with browser API blocked: ${path}`, async ({
    browser,
    page,
  }, testInfo) => {
    const ssrContext = await browser.newContext({
      javaScriptEnabled: false,
      serviceWorkers: 'block',
      baseURL: testInfo.project.use.baseURL,
    })
    const ssrPage = await ssrContext.newPage()
    await ssrPage.goto(path)
    await expect(ssrPage.locator('h1').first()).toContainText(name)
    for (const value of text) expect(await ssrPage.locator('body').innerText()).toContain(value)
    const before = await snapshot(ssrPage)
    const dataSrc = await ssrPage.locator('#__NUXT_DATA__').getAttribute('data-src')
    expect(dataSrc).toMatch(/\/_payload\.json\?[^\s]+$/)
    const payloadUrl = new URL(dataSrc!, ssrPage.url()).href
    const table =
      path === hospital
        ? null
        : await ssrPage.locator('table').filter({ hasText: '거래일' }).first().innerText()
    await ssrContext.close()

    const warnings: string[] = []
    page.on('console', (msg) => {
      if (/hydration/i.test(msg.text())) warnings.push(msg.text())
    })
    const requests = await blockBrowserApi(page)
    const payloadResponse = page.waitForResponse((response) => response.url() === payloadUrl)
    expect((await page.goto(path))?.status()).toBe(200)
    expect((await payloadResponse).status()).toBe(200)
    await hydrated(page)
    expect(await snapshot(page)).toEqual(before)
    for (const value of text) expect(await page.locator('body').innerText()).toContain(value)
    if (table)
      expect(await page.locator('table').filter({ hasText: '거래일' }).first().innerText()).toBe(
        table
      )
    expect(requests.payloads.length).toBeGreaterThan(0)
    expect(requests.blocked.length).toBeGreaterThan(0)
    // Hydration must consume SSR nearby; no duplicate browser nearby call.
    expect(requests.blocked).not.toContain('/api/real-estate/nearby')
    await testInfo.attach('hydration-warnings', {
      body: JSON.stringify(warnings),
      contentType: 'application/json',
    })
    await testInfo.attach('rendering-evidence', {
      body: JSON.stringify({ before, dataSrc, payloadUrl, payloadStatus: 200, requests }),
      contentType: 'application/json',
    })
  })
}

test('HardLink nearby card starts a new document and hydrates with API blocked', async ({
  page,
}) => {
  await blockBrowserApi(page)
  await page.goto(sale)
  await hydrated(page)
  await page.evaluate(() => {
    ;(window as Window & { documentMarker?: boolean }).documentMarker = true
  })
  const documentRequest = page.waitForRequest(
    (req) =>
      req.isNavigationRequest() &&
      req.resourceType() === 'document' &&
      decodeURI(req.url()).includes('이웃아파트')
  )
  await nearbyRowLink(page, '이웃아파트').click()
  await documentRequest
  await hydrated(page)
  await expect(page.locator('h1').first()).toContainText('이웃아파트')
  expect(
    await page.evaluate(() => (window as Window & { documentMarker?: boolean }).documentMarker)
  ).toBeUndefined()
  await expect(nearbyRowLink(page, '회복아파트')).toBeVisible()
})

test('시설 상세 주변 시설: SSR HTML 링크, 1440 2열 목록, 360 접기·가로 넘침 없음', async ({
  browser,
  page,
}, testInfo) => {
  // JS 끔 = 크롤러가 받는 SSR HTML. 4·5번째 행 링크도 있고 모바일 숨김은 CSS 클래스로만.
  const ssrContext = await browser.newContext({
    javaScriptEnabled: false,
    serviceWorkers: 'block',
    baseURL: testInfo.project.use.baseURL,
  })
  const ssrPage = await ssrContext.newPage()
  await ssrPage.goto(hospital)
  const ssrBlock = ssrPage.getByTestId('facility-nearby')
  await expect(ssrBlock.locator('h2')).toHaveText('주변 시설')
  await expect(ssrBlock.locator('a[href="/hospital/fixture-hospital-5"]')).toHaveCount(1)
  await expect(ssrBlock.locator('a[href="/pharmacy/fixture-pharmacy-1"]')).toHaveCount(1)
  await expect(ssrBlock.locator('#nearby-facility-list-hospital > li').nth(3)).toHaveClass(/max-md:hidden/)
  await ssrContext.close()

  const requests = await blockBrowserApi(page)
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(hospital)
  await hydrated(page)
  // SSR payload 를 그대로 쓰고 브라우저에서 다시 부르지 않는다
  expect(requests.blocked).not.toContain('/api/facilities/hospital/hospital-seo-fixture/nearby-grouped')
  const block = page.getByTestId('facility-nearby')
  await block.scrollIntoViewIfNeeded()
  await expect(page.getByText('렌더링회복병원에서 반경 1km 안의 시설입니다. 거리는 직선거리, 도보 시간은 추정입니다.')).toBeVisible()
  await expect(block.locator('h3')).toHaveText(['주변 병원', '주변 약국'])
  await expect(block.getByTestId('nearby-facility-count')).toHaveText(['1km 안 1,942곳 이상', '1km 안 2곳'])
  const first = block.getByRole('link', { name: /강남연세내과의원/ })
  await expect(first).toContainText('테헤란로 100 · 의원 · 의사 2명')
  await expect(first).toContainText('12m')
  await expect(first).toContainText('도보 약 1분')
  await expect(block.getByRole('link', { name: /역삼온누리약국/ })).toContainText('평일 09:00~18:30')
  await expect(block.getByRole('link', { name: /역삼아산치과의원/ })).toBeVisible()
  const [hospitalBox, pharmacyBox] = await Promise.all(
    ['nearby-facility-hospital', 'nearby-facility-pharmacy'].map((id) => page.locator(`#${id}`).boundingBox())
  )
  expect(Math.abs(hospitalBox!.y - pharmacyBox!.y)).toBeLessThan(2) // 2열
  const region = block.getByTestId('nearby-facilities-region-link')
  await expect(region).toHaveAttribute('href', '/seoul/gangnam/hospital')
  await expect(region).toHaveText('강남구 병원 전체 보기 →')

  await page.setViewportSize({ width: 360, height: 900 })
  await page.goto(hospital)
  await hydrated(page)
  await block.scrollIntoViewIfNeeded()
  await expect(block.getByRole('link', { name: /역삼아산치과의원/ })).toBeHidden()
  const rowHeight = (await first.boundingBox())!.height
  expect(rowHeight).toBeGreaterThanOrEqual(64)
  const overflow = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewport: window.innerWidth,
  }))
  expect(overflow.documentWidth, JSON.stringify(overflow)).toBe(overflow.viewport)
  await page.screenshot({ path: `test-results/housing-redesign/${testInfo.project.name}-360-facility-nearby.png` })
  const more = block.getByRole('button', { name: '5곳 모두 보기' })
  await expect(more).toHaveAttribute('aria-expanded', 'false')
  await more.click()
  await expect(block.getByRole('button', { name: '접기' })).toHaveAttribute('aria-expanded', 'true')
  await expect(block.getByRole('link', { name: /역삼아산치과의원/ })).toBeVisible()
})

test('negative control: blocking both external payload and API loses the SSR hospital body', async ({
  page,
}) => {
  await blockBrowserApi(page)
  const blockedPayloads: string[] = []
  await page.route('**/*_payload.json?**', (route) => {
    blockedPayloads.push(route.request().url())
    return route.abort('blockedbyclient')
  })
  const response = await page.goto(hospital)
  const html = await response!.text()
  expect(html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')).toContain('렌더링회복병원')
  const dataSrc = await page.locator('#__NUXT_DATA__').getAttribute('data-src')
  expect(dataSrc).toMatch(/\/_payload\.json\?[^\s]+$/)
  await hydrated(page)
  expect(blockedPayloads).toContain(new URL(dataSrc!, page.url()).href)
  await expect(page.locator('h1').filter({ hasText: '렌더링회복병원' })).toHaveCount(0)
  expect(await page.locator('body').innerText()).not.toContain('내과')
})

const retrySale = '/real-estate/apt-sale/seoul/gangnam/재시도아파트'
const recoveredNearby = (name: string) => ({
  success: true,
  data: {
    apt: [
      {
        buildingName: name,
        bjdCode: '1168010100',
        city: '서울특별시',
        district: '강남구',
        dongName: '역삼동',
        latestPrice: 85000,
        monthlyRent: 0,
        buildYear: 2000,
        transactionCount: 12,
        latestDealYear: 2026,
        latestDealMonth: 8,
        lat: 37.5,
        lng: 127.03,
      },
    ],
    villa: [],
    offitel: [],
  },
})

test('failed SSR nearby retries once and recovers on the unchanged query', async ({ page }) => {
  await blockBrowserApi(page)
  let retries = 0
  await page.route('**/api/real-estate/nearby?**', (route) => {
    retries++
    return route.fulfill({ json: recoveredNearby('회복된이웃') })
  })
  const response = await page.goto(retrySale)
  expect((await response!.text()).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')).not.toContain(
    '회복된이웃'
  )
  await hydrated(page)
  await expect(nearbyRowLink(page, '회복된이웃')).toBeVisible()
  expect(retries).toBe(1)
})

test('rent filter keeps the document and rejects a late prior-mode nearby response', async ({
  page,
}) => {
  await blockExternalOnly(page)
  let releaseWolse!: () => void
  const delayedWolse = new Promise<void>((resolve) => {
    releaseWolse = resolve
  })
  await page.route('**/api/real-estate/nearby?**', async (route) => {
    const rentType = new URL(route.request().url()).searchParams.get('rentType')
    if (rentType === 'wolse') await delayedWolse
    await route.fulfill({
      json: recoveredNearby(rentType === 'wolse' ? '늦은월세이웃' : '새전세이웃'),
    })
  })
  await page.goto(rent)
  await hydrated(page)
  await page.evaluate(() => {
    ;(window as Window & { documentMarker?: boolean }).documentMarker = true
  })
  try {
    await page.getByLabel('거래 유형').selectOption('wolse')
    await expect(nearbyRowLink(page, '이웃아파트')).toHaveCount(0)
    await page.getByLabel('거래 유형').selectOption('jeonse')
    await expect(nearbyRowLink(page, '새전세이웃')).toBeVisible()
    releaseWolse()
    await hydrated(page)
    expect(
      await page.evaluate(() => (window as Window & { documentMarker?: boolean }).documentMarker)
    ).toBe(true)
    await expect(page.getByRole('heading', { name: /주변 아파트 전세가/ })).toBeVisible()
    await expect(nearbyRowLink(page, '늦은월세이웃')).toHaveCount(0)
  } finally {
    releaseWolse()
  }
})

test('rent filter failure clears the prior query, then a genuine empty response remains empty', async ({
  page,
}) => {
  await blockExternalOnly(page)
  let failNextNearby = true
  await page.route('**/api/real-estate/nearby?**', (route) => {
    if (failNextNearby) {
      failNextNearby = false
      return route.abort('failed')
    }
    return route.fulfill({ json: { success: true, data: { apt: [], villa: [], offitel: [] } } })
  })
  await page.goto(rent)
  await hydrated(page)
  await expect(nearbyRowLink(page, '이웃아파트')).toBeVisible()
  const request = page.waitForRequest(
    (req) => req.url().includes('/api/real-estate/nearby') && req.url().includes('rentType=wolse')
  )
  await page.getByLabel('거래 유형').selectOption('wolse')
  await request
  await expect(nearbyRowLink(page, '이웃아파트')).toHaveCount(0)
  const response = page.waitForResponse(
    (res) => res.url().includes('/api/real-estate/nearby') && res.url().includes('rentType=jeonse')
  )
  await page.getByLabel('거래 유형').selectOption('jeonse')
  expect((await response).status()).toBe(200)
  await expect(nearbyRowLink(page, '이웃아파트')).toHaveCount(0)
})

test('normal hydration records the warning baseline without claiming all warnings fixed', async ({
  page,
}, testInfo) => {
  const warnings: string[] = []
  page.on('console', (msg) => {
    if (/hydration/i.test(msg.text())) warnings.push(msg.text())
  })
  await page.route('**/*', (route) =>
    new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort()
  )
  await page.goto(sale)
  await hydrated(page)
  await expect(page.locator('h1').first()).toContainText('회복아파트')
  await testInfo.attach('normal-hydration-warnings', {
    body: JSON.stringify(warnings),
    contentType: 'application/json',
  })
})
