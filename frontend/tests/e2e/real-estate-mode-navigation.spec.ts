import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

const api = 'http://127.0.0.1:18080'
const buildingKey = 'a'.repeat(64)
const otherBuildingKey = 'b'.repeat(64)
const buildingPath = `/real-estate/apt-sale/seoul/gangnam/회복아파트/${buildingKey}`
const rentPath = `/real-estate/apt-rent/seoul/gangnam/회복아파트/${buildingKey}`

type ModeRequest = {
  endpoint: 'detail' | 'detail-page'
  type: string
  mode: string | null
  buildingName: string | null
  buildingKey: string | null
  area: string | null
  deposit: string | null
}

async function resetModeLog(request: APIRequestContext) {
  const response = await request.post(`${api}/__test/real-estate-mode-navigation`)
  expect(response.ok()).toBe(true)
}

async function modeLog(request: APIRequestContext): Promise<ModeRequest[]> {
  const response = await request.get(`${api}/__test/real-estate-mode-navigation`)
  expect(response.ok()).toBe(true)
  const body = await response.json()
  return body.data.requests
}

async function hydrated(page: Page) {
  await page.waitForFunction(() => {
    const root = document.querySelector('#__nuxt') as Element & {
      __vue_app__?: { config: { globalProperties: { $nuxt?: { isHydrating: boolean } } } }
    }
    return root?.__vue_app__?.config.globalProperties.$nuxt?.isHydrating === false
  })
  await page.waitForLoadState('networkidle')
}

async function latestDetailRequest(
  request: APIRequestContext,
  mode: 'sale' | 'jeonse' | 'wolse'
) {
  return expect.poll(async () => {
    const requests = await modeLog(request)
    return requests
      .filter(item => item.endpoint === 'detail')
      .at(-1)
  }).toMatchObject({
    endpoint: 'detail',
    type: mode === 'sale' ? 'apt-sale' : 'apt-rent',
    mode,
    buildingName: '회복아파트',
    buildingKey,
  })
}

async function expectRenderedDetailState(
  page: Page,
  mode: 'sale' | 'jeonse' | 'wolse'
) {
  const url = new URL(page.url())
  if (mode === 'sale') {
    expect(url.pathname).toMatch(new RegExp(`/real-estate/apt-sale/.*/${buildingKey}$`))
    expect(url.searchParams.has('mode')).toBe(false)
    await expect(page.getByLabel('거래 유형')).toHaveValue('sale')
    await expect(page.getByText('적용 조건 · 매매 · 전용 84.90㎡ · 6개월')).toBeVisible()
    await expect(page.getByTestId('deal-point-row').first()).toContainText('8억 7,000만원')
    await expect(page.getByTestId('detail-transaction-card').first()).toContainText('8억 7,000만원')
  } else if (mode === 'jeonse') {
    expect(url.pathname).toMatch(new RegExp(`/real-estate/apt-rent/.*/${buildingKey}$`))
    expect(url.searchParams.get('mode')).toBe('jeonse')
    await expect(page.getByLabel('거래 유형')).toHaveValue('jeonse')
    await expect(page.getByText('적용 조건 · 전세 · 전용 84.90㎡ · 6개월')).toBeVisible()
    await expect(page.getByTestId('deal-point-row').first()).toContainText('6억 1,000만원')
    await expect(page.getByTestId('detail-transaction-card').first()).toContainText('6억 1,000만원')
  } else {
    expect(url.pathname).toMatch(new RegExp(`/real-estate/apt-rent/.*/${buildingKey}$`))
    expect(url.searchParams.get('mode')).toBe('wolse')
    await expect(page.getByLabel('거래 유형')).toHaveValue('wolse')
    await expect(page.getByText('적용 조건 · 월세 · 전용 84.90㎡ · 6개월 · 보증금 1억')).toBeVisible()
    await expect(page.getByTestId('deal-point-row').first()).toContainText('120만원')
    await expect(page.getByTestId('deal-point-row').first()).toContainText('보증금 1억')
    await expect(page.getByTestId('detail-transaction-card').first()).toContainText('1억 / 120만원')
  }
}

async function expectSsrPayloadContains(page: Page, expected: string) {
  const payloadText = await page.locator('script').evaluateAll((scripts, text) =>
    scripts.map(script => script.textContent ?? '').join('\n').includes(text), expected)
  expect(payloadText).toBe(true)
}

test.beforeEach(async ({ page, request }) => {
  await resetModeLog(request)
  await page.route('**/*', route => {
    const url = new URL(route.request().url())
    return url.hostname === '127.0.0.1'
      ? route.continue()
      : route.abort('blockedbyclient')
  })
})

test('initial mobile detail hydration does not emit Vue hydration mismatch while preserving keyed sale state', async ({
  page,
}) => {
  const hydrationMessages: string[] = []
  page.on('console', (message) => {
    const text = message.text()
    if (/hydration/i.test(text)) hydrationMessages.push(text)
  })

  await page.setViewportSize({ width: 360, height: 900 })
  await page.goto(buildingPath)
  await hydrated(page)

  expect(hydrationMessages).toEqual([])
  await expectRenderedDetailState(page, 'sale')
  await expectSsrPayloadContains(page, '8억 7,000만원')
})

test('sale to wolse preserves the same buildingKey, URL mode, browser state, and API mode across reload and back', async ({
  page,
  request,
}) => {
  await page.goto(buildingPath)
  await hydrated(page)
  await expectRenderedDetailState(page, 'sale')
  await expectSsrPayloadContains(page, '8억 7,000만원')

  await page.getByLabel('전용면적').selectOption('84.91')
  await page.getByLabel('조회 기간').selectOption('12')
  await page.getByLabel('거래 유형').selectOption('wolse')
  await expect(page).toHaveURL(new RegExp(`/real-estate/apt-rent/.*/${buildingKey}\\?mode=wolse$`))
  await hydrated(page)
  await expect(page.getByLabel('거래 유형')).toHaveValue('wolse')
  await expect(page.getByLabel('전용면적')).toHaveValue('84.90')
  await expect(page.getByLabel('조회 기간')).toHaveValue('6')
  await latestDetailRequest(request, 'wolse')
  await expect(page.getByText('적용 조건 · 월세 · 전용 84.90㎡ · 6개월 · 보증금 1억')).toBeVisible()
  await expect(page.getByTestId('deal-point-row').first()).toContainText('120만원')
  await expect(page.getByTestId('deal-point-row').first()).toContainText('보증금 1억')
  await expect(page.getByTestId('detail-transaction-card').first()).toContainText('1억 / 120만원')

  await page.reload()
  await hydrated(page)
  await expectRenderedDetailState(page, 'wolse')

  await page.goBack()
  await hydrated(page)
  await expectRenderedDetailState(page, 'sale')

  const keys = (await modeLog(request)).map(item => item.buildingKey).filter(Boolean)
  expect(keys).toContain(buildingKey)
  expect(keys).not.toContain(otherBuildingKey)
})

test('jeonse to sale removes rent mode query while keeping the exact buildingKey', async ({
  page,
  request,
}) => {
  await page.goto(`${rentPath}?mode=jeonse`)
  await hydrated(page)
  await expectRenderedDetailState(page, 'jeonse')

  await page.getByLabel('거래 유형').selectOption('sale')
  await expect(page).toHaveURL(new RegExp(`/real-estate/apt-sale/.*/${buildingKey}$`))
  await hydrated(page)

  const url = new URL(page.url())
  expect(url.pathname).toMatch(new RegExp(`/real-estate/apt-sale/.*/${buildingKey}$`))
  expect(url.searchParams.has('mode')).toBe(false)
  await expectRenderedDetailState(page, 'sale')
  await latestDetailRequest(request, 'sale')
})
