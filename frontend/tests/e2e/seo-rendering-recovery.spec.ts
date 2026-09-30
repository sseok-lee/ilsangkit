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
  await page
    .getByRole('link')
    .filter({ has: page.getByRole('heading', { name: '이웃아파트', exact: true }) })
    .click()
  await documentRequest
  await hydrated(page)
  await expect(page.locator('h1').first()).toContainText('이웃아파트')
  expect(
    await page.evaluate(() => (window as Window & { documentMarker?: boolean }).documentMarker)
  ).toBeUndefined()
  await expect(page.getByRole('heading', { name: '회복아파트', exact: true })).toBeVisible()
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
  await expect(page.getByRole('heading', { name: '회복된이웃', exact: true })).toBeVisible()
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
    await expect(page.getByRole('heading', { name: '이웃아파트', exact: true })).toHaveCount(0)
    await page.getByLabel('거래 유형').selectOption('jeonse')
    await expect(page.getByRole('heading', { name: '새전세이웃', exact: true })).toBeVisible()
    releaseWolse()
    await hydrated(page)
    expect(
      await page.evaluate(() => (window as Window & { documentMarker?: boolean }).documentMarker)
    ).toBe(true)
    await expect(page.getByRole('heading', { name: /주변 아파트 전세가/ })).toBeVisible()
    await expect(page.getByRole('heading', { name: '늦은월세이웃', exact: true })).toHaveCount(0)
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
  await expect(page.getByRole('heading', { name: '이웃아파트', exact: true })).toBeVisible()
  const request = page.waitForRequest(
    (req) => req.url().includes('/api/real-estate/nearby') && req.url().includes('rentType=wolse')
  )
  await page.getByLabel('거래 유형').selectOption('wolse')
  await request
  await expect(page.getByRole('heading', { name: '이웃아파트', exact: true })).toHaveCount(0)
  const response = page.waitForResponse(
    (res) => res.url().includes('/api/real-estate/nearby') && res.url().includes('rentType=jeonse')
  )
  await page.getByLabel('거래 유형').selectOption('jeonse')
  expect((await response).status()).toBe(200)
  await expect(page.getByRole('heading', { name: '이웃아파트', exact: true })).toHaveCount(0)
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
