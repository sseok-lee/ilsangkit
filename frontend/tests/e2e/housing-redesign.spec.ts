import { expect, test, type Page, type TestInfo } from '@playwright/test'

const salePath = '/real-estate/apt-sale/seoul/gangnam/회복아파트'
const rentPath = '/real-estate/apt-rent/seoul/gangnam/회복아파트'
const ambiguousPath = '/real-estate/apt-sale/seoul/gangnam/모호아파트'
const subscriptionPath = '/subscription/90001'
const uncachedRentPath = '/real-estate/apt-rent/seoul/gangnam/회복아파트SSR'
const publicRentSubscriptionPath = '/subscription/90002'
const screenshotDir = 'test-results/housing-redesign'

function kstDateLabel(daysOffset: number) {
  const formatter = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const now = new Date()
  const date = new Date(now.getTime() + daysOffset * 86_400_000)
  return formatter.format(date).replaceAll('-', '.')
}

type Capture = {
  pageErrors: string[]
  consoleErrors: string[]
  hydrationWarnings: string[]
}

async function hydrated(page: Page) {
  await page.waitForFunction(() => {
    const root = document.querySelector('#__nuxt') as Element & {
      __vue_app__?: { config: { globalProperties: { $nuxt?: { isHydrating: boolean } } } }
    }
    return root?.__vue_app__?.config.globalProperties.$nuxt?.isHydrating === false
  })
  await page.waitForLoadState('networkidle')
  await page.evaluate(() => document.fonts?.ready ?? Promise.resolve())
}

function captureRuntime(page: Page): Capture {
  const capture: Capture = { pageErrors: [], consoleErrors: [], hydrationWarnings: [] }
  page.on('pageerror', (error) => capture.pageErrors.push(error.message))
  page.on('console', (msg) => {
    const text = msg.text()
    if (msg.type() === 'error') capture.consoleErrors.push(text)
    if (/hydration/i.test(text)) capture.hydrationWarnings.push(text)
  })
  return capture
}

async function stubKakaoMaps(page: Page) {
  await page.addInitScript(() => {
    const stubCalls: string[] = []
    class LatLng {
      constructor(
        private lat: number,
        private lng: number
      ) {}
      getLat() {
        return this.lat
      }
      getLng() {
        return this.lng
      }
    }
    class Bounds {
      constructor(private center: LatLng) {}
      getSouthWest() {
        return new LatLng(this.center.getLat() - 0.01, this.center.getLng() - 0.01)
      }
      getNorthEast() {
        return new LatLng(this.center.getLat() + 0.01, this.center.getLng() + 0.01)
      }
    }
    class MapStub {
      private center: LatLng
      constructor(container: HTMLElement, options: { center: LatLng; level: number }) {
        this.center = options.center
        container.setAttribute('data-fixture-kakao-map', 'true')
        stubCalls.push('Map')
      }
      getCenter() {
        return this.center
      }
      getBounds() {
        return new Bounds(this.center)
      }
      setCenter(next: LatLng) {
        this.center = next
      }
      panTo(next: LatLng) {
        this.center = next
      }
      setLevel() {}
    }
    class MarkerStub {
      setMap() {}
    }
    class InfoWindowStub {
      open() {}
      close() {}
    }
    class CustomOverlayStub {
      setMap() {}
    }
    class RoadviewStub {
      setPanoId() {
        stubCalls.push('Roadview')
      }
    }
    class RoadviewClientStub {
      getNearestPanoId(_position: LatLng, _radius: number, callback: (id: number) => void) {
        callback(1)
      }
    }
    class GeocoderStub {
      coord2RegionCode(
        _lng: number,
        _lat: number,
        callback: (result: unknown[], status: string) => void
      ) {
        callback(
          [
            {
              region_type: 'H',
              region_1depth_name: '서울특별시',
              region_2depth_name: '강남구',
              region_3depth_name: '역삼동',
            },
          ],
          'OK'
        )
      }
    }
    ;(
      window as typeof window & { __seoKakaoStubCalls?: string[]; kakao?: unknown }
    ).__seoKakaoStubCalls = stubCalls
    ;(window as typeof window & { kakao?: unknown }).kakao = {
      maps: {
        load: (callback: () => void) => callback(),
        LatLng,
        Map: MapStub,
        Marker: MarkerStub,
        InfoWindow: InfoWindowStub,
        CustomOverlay: CustomOverlayStub,
        Roadview: RoadviewStub,
        RoadviewClient: RoadviewClientStub,
        event: { addListener: () => {}, removeListener: () => {} },
        services: {
          Geocoder: GeocoderStub,
          Status: { OK: 'OK', ZERO_RESULT: 'ZERO_RESULT', ERROR: 'ERROR' },
        },
      },
    }
  })
}

async function allowOnlyExpectedConsoleErrors(
  testInfo: TestInfo,
  capture: Capture,
  startIndex: number,
  patterns: RegExp[]
) {
  const allowed = capture.consoleErrors.slice(startIndex)
  await testInfo.attach('expected-negative-console-errors', {
    body: JSON.stringify(allowed, null, 2),
    contentType: 'application/json',
  })
  for (const error of allowed) {
    expect(
      patterns.some((pattern) => pattern.test(error)),
      error
    ).toBe(true)
  }
  capture.consoleErrors.splice(startIndex)
}

async function attachCapture(testInfo: TestInfo, capture: Capture) {
  await testInfo.attach('runtime-capture', {
    body: JSON.stringify(capture, null, 2),
    contentType: 'application/json',
  })
  expect(capture.pageErrors).toEqual([])
  expect(capture.consoleErrors).toEqual([])
  expect(capture.hydrationWarnings).toEqual([])
}

async function viewportOverflowEvidence(page: Page) {
  return page.evaluate(() => {
    const viewport = window.innerWidth
    const documentWidth = document.documentElement.scrollWidth
    const offenders = [...document.querySelectorAll<HTMLElement>('body *')]
      .map((element) => {
        const rect = element.getBoundingClientRect()
        return {
          tag: element.tagName.toLowerCase(),
          className: typeof element.className === 'string' ? element.className : '',
          text: (element.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 80),
          left: Math.floor(rect.left),
          right: Math.ceil(rect.right),
          width: Math.ceil(rect.width),
        }
      })
      .filter((item) => item.right > viewport || item.left < 0)
      .sort((a, b) => Math.max(b.right - viewport, -b.left) - Math.max(a.right - viewport, -a.left))
      .slice(0, 8)
    return { url: location.pathname, viewport, documentWidth, offenders }
  })
}

async function configureFixtureApi(page: Page, body: unknown) {
  const response = await page.request.post('http://127.0.0.1:18080/__fixture/control', {
    data: body,
  })
  expect(response.ok()).toBe(true)
  return response.json() as Promise<{ data: { nearbyRequests?: Array<{ mode: string | null; rentType: string | null; excludeBuildingName: string | null }> } }>
}

async function blockExternalNetwork(page: Page) {
  await page.route('**/*', (route) =>
    new URL(route.request().url()).hostname === '127.0.0.1'
      ? route.continue()
      : route.abort('blockedbyclient')
  )
}

test('지역 쿠키별 SSR HTML은 섞이지 않는다', async ({ request }) => {
  const cookie = (district: string) =>
    `ilsangkit-market-region-v1=${encodeURIComponent(JSON.stringify({ city: 'seoul', district }))}`
  const a = await request.get('/', { headers: { cookie: cookie('gangnam') } })
  const b = await request.get('/', { headers: { cookie: cookie('gangbuk') } })
  expect(a.headers()['cache-control']).toContain('private')
  expect(a.headers()['cache-control']).toContain('no-store')
  const aHtml = await a.text()
  const bHtml = await b.text()
  expect(aHtml).toContain('강남구 최근 30일')
  expect(bHtml).toContain('강북구 최근 30일')
  expect(aHtml).not.toBe(bHtml)
})

for (const width of [360, 390, 768, 1440]) {
  test(`세 화면 가로 넘침 없음 ${width}`, async ({ page }, testInfo) => {
    const capture = captureRuntime(page)
    await stubKakaoMaps(page)
    await blockExternalNetwork(page)
    await page.setViewportSize({ width, height: 900 })
    for (const url of ['/', salePath, subscriptionPath]) {
      await page.goto(url)
      await hydrated(page)
      const overflow = await viewportOverflowEvidence(page)
      expect(overflow, JSON.stringify(overflow, null, 2)).toMatchObject({
        documentWidth: overflow.viewport,
      })
      const screenshotName = `${testInfo.project.name}-${width}-${url.replace(/[/?]/g, '_') || 'home'}`
      await page.screenshot({
        path: `${screenshotDir}/${screenshotName}.png`,
        fullPage: false,
      })
      await page.screenshot({
        path: `${screenshotDir}/${screenshotName}-full.png`,
        fullPage: true,
      })
    }
    await attachCapture(testInfo, capture)
  })
}

test('1024px header remains within viewport on home and detail with search navigation', async ({
  page,
}, testInfo) => {
  const capture = captureRuntime(page)
  await stubKakaoMaps(page)
  await blockExternalNetwork(page)
  await page.setViewportSize({ width: 1024, height: 900 })
  for (const url of ['/', salePath]) {
    await page.goto(url)
    await hydrated(page)
    const header = page.locator('header').first()
    const box = await header.boundingBox()
    expect(box?.x ?? 0).toBeGreaterThanOrEqual(0)
    expect(Math.ceil((box?.x ?? 0) + (box?.width ?? 0))).toBeLessThanOrEqual(1024)
  }
  await page.screenshot({
    path: `${screenshotDir}/${testInfo.project.name}-1024-header.png`,
    fullPage: false,
  })
  await attachCapture(testInfo, capture)
})

test('홈 지역 선택은 저장·불량 쿠키·지연 응답·쿠키 쓰기 차단을 안정적으로 처리한다', async ({
  browser,
}, testInfo) => {
  const context = await browser.newContext({
    baseURL: 'http://127.0.0.1:13000',
    serviceWorkers: 'block',
  })
  await context.addCookies([
    {
      name: 'ilsangkit-market-region-v1',
      value: encodeURIComponent(JSON.stringify({ city: 'seoul', district: 'gangnam' })),
      domain: '127.0.0.1',
      path: '/',
    },
  ])
  const page = await context.newPage()
  const capture = captureRuntime(page)
  await stubKakaoMaps(page)
  await blockExternalNetwork(page)
  await page.goto('/')
  await hydrated(page)
  await expect(page.getByText('강남구 · 아파트')).toBeVisible()
  await page.getByLabel('시군구 선택').selectOption('gangbuk')
  await expect(page.getByText('강북구 · 아파트')).toBeVisible()
  await page.reload()
  await hydrated(page)
  await expect(page.getByText('강북구 · 아파트')).toBeVisible()

  let releaseGangnam!: () => void
  const delayedGangnam = new Promise<void>((resolve) => {
    releaseGangnam = resolve
  })
  const racedRequests: string[] = []
  await page.route('**/api/real-estate/home-market?**', async (route) => {
    const url = new URL(route.request().url())
    const district = url.searchParams.get('district')
    racedRequests.push(district ?? 'all')
    if (district === 'gangnam') await delayedGangnam
    await route.continue()
  })
  await page.getByLabel('시군구 선택').selectOption('gangnam')
  await page.getByLabel('시군구 선택').selectOption('gangbuk')
  await expect(page.getByText('강북구 · 아파트')).toBeVisible()
  releaseGangnam()
  await page.waitForLoadState('networkidle')
  await expect(page.getByText('강북구 · 아파트')).toBeVisible()
  expect(racedRequests).toEqual(expect.arrayContaining(['gangnam', 'gangbuk']))
  await attachCapture(testInfo, capture)
  await context.close()

  const blockedStorageContext = await browser.newContext({
    baseURL: 'http://127.0.0.1:13000',
    serviceWorkers: 'block',
  })
  const blockedStorage = await blockedStorageContext.newPage()
  const blockedCapture = captureRuntime(blockedStorage)
  await stubKakaoMaps(blockedStorage)
  await blockExternalNetwork(blockedStorage)
  await blockedStorage.goto('/')
  await hydrated(blockedStorage)
  await blockedStorage.evaluate(() => {
    const descriptor = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie')
    Object.defineProperty(document, 'cookie', {
      configurable: true,
      get: () => descriptor?.get?.call(document) ?? '',
      set: () => {
        // Simulate browsers that accept the assignment call but drop the write.
      },
    })
  })
  await blockedStorage.getByLabel('시도 선택').selectOption('seoul')
  await blockedStorage.getByLabel('시군구 선택').selectOption('gangnam')
  await expect(blockedStorage.getByText('강남구 · 아파트')).toBeVisible()
  await attachCapture(testInfo, blockedCapture)
  await blockedStorageContext.close()

  const badCookieContext = await browser.newContext({
    baseURL: 'http://127.0.0.1:13000',
    serviceWorkers: 'block',
  })
  await badCookieContext.addCookies([
    {
      name: 'ilsangkit-market-region-v1',
      value: encodeURIComponent(JSON.stringify({ city: 'seoul', district: 'not-real' })),
      domain: '127.0.0.1',
      path: '/',
    },
  ])
  const badCookie = await badCookieContext.newPage()
  const badCookieCapture = captureRuntime(badCookie)
  await stubKakaoMaps(badCookie)
  await blockExternalNetwork(badCookie)
  await badCookie.goto('/')
  await hydrated(badCookie)
  await expect(badCookie.getByText('전국 · 아파트')).toBeVisible()
  await attachCapture(testInfo, badCookieCapture)
  await badCookieContext.close()
})

test('상세 필터·표·차트는 같은 eligible 거래 집합을 사용하고 page2는 표만 요청한다', async ({
  page,
}, testInfo) => {
  const capture = captureRuntime(page)
  await stubKakaoMaps(page)
  await blockExternalNetwork(page)
  const detailRequests: string[] = []
  const pageRequests: string[] = []
  page.on('request', (request) => {
    const url = request.url()
    if (url.includes('/api/real-estate/') && url.includes('/detail?')) detailRequests.push(url)
    if (url.includes('/api/real-estate/') && url.includes('/detail-page?')) pageRequests.push(url)
  })
  await page.goto(salePath)
  await hydrated(page)
  await expect(page.locator('h1').first()).toContainText('회복아파트')
  await expect(page.getByLabel('실거래 요약').getByText('2000년')).toBeVisible()
  await expect(page.getByTestId('deal-point-row')).toHaveCount(20)
  await page.getByTestId('show-more-deals').click()
  await expect(page.getByTestId('deal-point-row')).toHaveCount(21)
  await expect(page.getByTestId('detail-transaction-card')).toHaveCount(20)
  await expect(page.getByLabel('전용면적')).toHaveValue('84.90')
  await expect(page.getByLabel('조회 기간')).toHaveValue('0')
  const selectedSameDay = `${kstDateLabel(-2)} · 21건`
  await expect(page.getByText(selectedSameDay)).toBeVisible()
  await expect(page.getByTestId('deal-point-row').nth(0)).toContainText('8억 7,000만원')
  await expect(page.getByTestId('deal-point-row').nth(0)).toContainText('전용 84.90㎡')
  await expect(page.getByTestId('deal-point-row').nth(1)).toContainText('8억 7,000만원')
  await expect(page.getByTestId('deal-point-row').nth(1)).toContainText('전용 84.90㎡')
  await expect(page.getByTestId('deal-point-row')).toHaveText([
    ...Array.from({ length: 21 }, () => /전용 84\.90㎡/),
  ])
  const detailWireResponse = await page.request.get('http://127.0.0.1:18080/api/real-estate/apt-sale/detail?mode=sale&area=84.90&months=0&buildingName=회복아파트')
  expect(detailWireResponse.ok()).toBe(true)
  const detailWire = await detailWireResponse.json()
  expect(detailWire.data.points).toHaveLength(21)
  expect(detailWire.data.table.total).toBe(21)
  expect(detailWire.data.points.every((point: { area: string }) => point.area === '84.90')).toBe(true)
  const detailWireText = JSON.stringify(detailWire.data)
  for (const excludedAmount of [99001, 99002, 99003]) {
    expect(detailWireText).not.toContain(String(excludedAmount))
  }
  const chartBox = await page.locator('canvas').boundingBox()
  expect(chartBox).not.toBeNull()
  await page.locator('canvas').dispatchEvent('pointerdown', {
    clientX: Math.floor((chartBox?.x ?? 0) + (chartBox?.width ?? 0) / 2),
    clientY: Math.floor((chartBox?.y ?? 0) + (chartBox?.height ?? 0) / 2),
    pointerId: 1,
    pointerType: 'touch',
    isPrimary: true,
  })
  await expect(page.getByTestId('deal-point-row').nth(0)).toContainText(/8억 [0-9],[0-9]{3}만원/)
  await page.getByLabel('거래 날짜').selectOption(kstDateLabel(-2).replaceAll('.', '-'))
  await expect(page.getByText(selectedSameDay)).toBeVisible()
  await expect(page.getByTestId('deal-point-row').nth(0)).toContainText('8억 7,000만원')
  await page.getByLabel('거래 날짜').focus()
  await page.keyboard.press('Home')
  await page.keyboard.press('Enter')
  await expect(page.getByText(selectedSameDay)).toBeVisible()
  await expect(page.getByTestId('deal-point-row').nth(1)).toContainText('전용 84.90㎡')
  await page.getByLabel('조회 기간').selectOption('12')
  await expect(page.getByText('최근 1년 거래').locator('..').getByText('21건')).toBeVisible()
  await page.getByLabel('전용면적').selectOption('84.91')
  await expect(page.getByText('적용 조건 · 매매 · 전용 84.91㎡ · 1년')).toBeVisible()
  await expect(page.getByText('최근 1년 거래').locator('..').getByText('7건')).toBeVisible()
  await expect(page.getByTestId('deal-point-row')).toHaveCount(7)
  await expect(page.getByTestId('deal-point-row').first()).toContainText('9억 1,000만원')
  await expect(page.getByTestId('detail-transaction-card')).toHaveCount(7)
  await expect(page.getByTestId('detail-transaction-card').first()).toContainText('9억 1,000만원')
  await page.getByLabel('전용면적').selectOption('84.90')
  await page.getByLabel('조회 기간').selectOption('6')
  const detailCountAfterChartLoad = detailRequests.length
  await page.getByRole('button', { name: '2' }).click()
  await expect(page.getByTestId('detail-transaction-card')).toHaveCount(1)
  expect(pageRequests.length).toBeGreaterThanOrEqual(1)
  expect(detailRequests.length).toBe(detailCountAfterChartLoad)
  await expect(page.getByLabel('실거래 요약').getByText('2000년')).toBeVisible()
  await attachCapture(testInfo, capture)
})

test('상세 overview 안정성과 page 실패는 실제 네트워크 재시도와 보존 동작으로 회복한다', async ({
  page,
}, testInfo) => {
  const capture = captureRuntime(page)
  await stubKakaoMaps(page)
  await blockExternalNetwork(page)
  await configureFixtureApi(page, {
    reset: true,
    overviewFailures: [{ type: 'apt-sale', name: '요약재시도아파트', count: 20 }],
    pageFailures: [{ type: 'apt-sale', name: '페이지재시도아파트', page: 2, count: 20 }],
  })

  const overviewRetryPath = '/real-estate/apt-sale/seoul/gangnam/요약재시도아파트'
  const nearbyCountsDuringFailure: string[] = []
  page.on('request', (request) => {
    if (request.url().includes('/api/facilities/nearby-counts')) {
      nearbyCountsDuringFailure.push(request.url())
    }
  })
  await page.goto(overviewRetryPath)
  await hydrated(page)
  await expect(page.getByRole('alert').filter({ hasText: '최근 매매 요약' })).toBeVisible()
  expect(nearbyCountsDuringFailure).toEqual([])
  await configureFixtureApi(page, {
    overviewFailures: [{ type: 'apt-sale', name: '요약재시도아파트', count: 0 }],
  })
  await page.getByRole('button', { name: '요약 다시 불러오기' }).click()
  await expect(page.getByLabel('실거래 요약').getByText('2000년')).toBeVisible()
  await expect.poll(() => nearbyCountsDuringFailure.length).toBeGreaterThan(0)

  const retryPagePath = '/real-estate/apt-sale/seoul/gangnam/페이지재시도아파트'
  await page.goto(retryPagePath)
  await hydrated(page)
  await expect(page.getByLabel('실거래 요약').getByText('2000년')).toBeVisible()
  const failedPage = page.waitForResponse(
    (response) =>
      response.url().includes('/api/real-estate/apt-sale/detail-page') &&
      response
        .url()
        .includes(
          'buildingName=%ED%8E%98%EC%9D%B4%EC%A7%80%EC%9E%AC%EC%8B%9C%EB%8F%84%EC%95%84%ED%8C%8C%ED%8A%B8'
        ) &&
      response.url().includes('page=2')
  )
  const pageConsoleStart = capture.consoleErrors.length
  await page.getByRole('button', { name: '2' }).click()
  expect((await failedPage).status()).toBe(503)
  await expect(page.getByRole('alert').filter({ hasText: '거래 내역 페이지' })).toBeVisible()
  await allowOnlyExpectedConsoleErrors(testInfo, capture, pageConsoleStart, [
    /Failed to load resource: the server responded with a status of 50[0-9]/,
  ])
  await expect(page.getByTestId('detail-transaction-card')).toHaveCount(20)
  await configureFixtureApi(page, {
    pageFailures: [{ type: 'apt-sale', name: '페이지재시도아파트', page: 2, count: 0 }],
  })
  await page.getByRole('button', { name: '거래 내역 다시 불러오기' }).click()
  await expect(page.getByTestId('detail-transaction-card')).toHaveCount(1)
  await attachCapture(testInfo, capture)
})

test('지도 SDK fixture stub은 외부 네트워크 없이 상세 지도와 로드뷰를 안정화한다', async ({
  page,
}, testInfo) => {
  const capture = captureRuntime(page)
  await stubKakaoMaps(page)
  await blockExternalNetwork(page)
  await page.goto(salePath)
  await hydrated(page)
  await expect(page.getByTestId('map-container')).toHaveAttribute('data-fixture-kakao-map', 'true')
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as Window & { __seoKakaoStubCalls?: string[] }).__seoKakaoStubCalls ?? []
      )
    )
    .toContain('Roadview')
  await attachCapture(testInfo, capture)
})

test('모호한 좌표 overview는 nearby-counts와 반경 지도를 호출하지 않는다', async ({
  page,
}, testInfo) => {
  const capture = captureRuntime(page)
  await stubKakaoMaps(page)
  await blockExternalNetwork(page)
  const radiusCalls: string[] = []
  page.on('request', (request) => {
    if (request.url().includes('/api/facilities/nearby-counts')) radiusCalls.push(request.url())
    if (request.url().includes('/api/facilities/nearby?')) radiusCalls.push(request.url())
  })
  await page.goto(ambiguousPath)
  await hydrated(page)
  await expect(page.getByText('주소가 여러 건이라 대표 위치를 표시하지 않습니다', { exact: true })).toBeVisible()
  await expect(page.getByText('주소 후보별 지도 검색으로 확인하세요', { exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: '주소 후보 2건 · 위치 섹션에서 확인' })).toHaveAttribute(
    'href',
    '#reported-addresses'
  )
  await expect(page.getByText('주소가 여러 건 보고되었습니다')).toBeVisible()
  const firstAddress = '서울 강남구 테헤란로 200 (역삼동 124)'
  const secondAddress = '서울 강남구 테헤란로 200 (역삼동 124-1)'
  await expect(page.getByText(firstAddress)).toBeVisible()
  await expect(page.getByText(secondAddress)).toBeVisible()
  await expect(page.getByRole('link', { name: '카카오맵에서 테헤란로 200 (역삼동 124) 검색' })).toHaveAttribute(
    'href',
    `https://map.kakao.com/link/search/${encodeURIComponent(firstAddress)}`
  )
  await expect(page.getByRole('link', { name: '네이버맵에서 테헤란로 200 (역삼동 124-1) 검색' })).toHaveAttribute(
    'href',
    `https://map.naver.com/v5/search/${encodeURIComponent(secondAddress)}`
  )
  expect(radiusCalls).toEqual([])

  await page.setViewportSize({ width: 390, height: 900 })
  await page.goto(ambiguousPath)
  await hydrated(page)
  await page.screenshot({
    path: `${screenshotDir}/${testInfo.project.name}-390-ambiguous-header.png`,
    fullPage: false,
  })

  for (const width of [360, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto(ambiguousPath)
    await hydrated(page)
    await page.locator('#reported-addresses').scrollIntoViewIfNeeded()
    await expect(page.getByText('주소가 여러 건 보고되었습니다')).toBeVisible()
    await expect(page.getByText(firstAddress)).toBeVisible()
    await expect(page.getByText(secondAddress)).toBeVisible()
    const overflow = await viewportOverflowEvidence(page)
    expect(overflow, JSON.stringify(overflow, null, 2)).toMatchObject({
      documentWidth: overflow.viewport,
    })
    await page.screenshot({
      path: `${screenshotDir}/${testInfo.project.name}-${width}-ambiguous-addresses.png`,
      fullPage: false,
    })
  }
  expect(radiusCalls).toEqual([])
  await attachCapture(testInfo, capture)
})

test('월세 보증금 0 필터는 무보증 월세 거래와 차트 보증금 표기를 유지한다', async ({
  page,
}, testInfo) => {
  const capture = captureRuntime(page)
  await stubKakaoMaps(page)
  await blockExternalNetwork(page)
  await page.goto(rentPath)
  await hydrated(page)
  await page.getByLabel('거래 유형').selectOption('wolse')
  await expect(page.getByLabel('보증금')).toBeVisible()
  await page.getByLabel('보증금').selectOption('0')
  await expect(page.getByText('적용 조건 · 월세 · 전용 84.90㎡ · 전체 기간 · 보증금 0')).toBeVisible()
  await expect(page.getByTestId('deal-point-row')).toHaveCount(6)
  await expect(page.getByTestId('deal-point-row').first()).toContainText('보증금 0')
  await expect(page.getByText('전체 기간 거래').locator('..').getByText('6건')).toBeVisible()
  await attachCapture(testInfo, capture)
})

test('여섯 부동산 유형과 nearby rentType, SEO 상태가 fixture API로 검증된다', async ({
  page,
}, testInfo) => {
  const capture = captureRuntime(page)
  await stubKakaoMaps(page)
  await blockExternalNetwork(page)
  await configureFixtureApi(page, { reset: true })
  for (const path of [
    salePath,
    uncachedRentPath,
    '/real-estate/villa-sale/seoul/gangnam/회복빌라',
    '/real-estate/villa-rent/seoul/gangnam/회복빌라',
    '/real-estate/offitel-sale/seoul/gangnam/회복오피스텔',
    '/real-estate/offitel-rent/seoul/gangnam/회복오피스텔',
  ]) {
    const response = await page.goto(path)
    expect(response?.status()).toBe(200)
    await hydrated(page)
    await expect(page.locator('h1').first()).toContainText(/회복/)
    await expect(page.locator('link[rel=canonical]')).toHaveAttribute(
      'href',
      new RegExp(encodeURI(path).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    )
    await expect(page.locator('script[type="application/ld+json"]').first()).toBeAttached()
  }
  const initialNearbyLog = await configureFixtureApi(page, {})
  expect(initialNearbyLog.data.nearbyRequests).toContainEqual(expect.objectContaining({
    mode: 'rent',
    rentType: 'jeonse',
    excludeBuildingName: '회복아파트SSR',
  }))

  const clientRentTypes: string[] = []
  await page.route('**/api/real-estate/nearby?**', async (route) => {
    clientRentTypes.push(new URL(route.request().url()).searchParams.get('rentType') ?? '(missing)')
    await route.fulfill({ json: { success: true, data: { apt: [], villa: [], offitel: [] } } })
  })
  await page.goto(rentPath)
  await hydrated(page)
  await page.getByLabel('거래 유형').selectOption('wolse')
  await expect.poll(() => clientRentTypes).toContain('wolse')

  expect(capture.consoleErrors).toEqual([])
  const expectedNegativeStart = capture.consoleErrors.length
  expect((await page.goto('/real-estate/apt-sale/seoul/gangnam/없는아파트'))?.status()).toBe(404)
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/)
  await expect(page.locator('link[rel="canonical"]')).toHaveCount(0)
  expect((await page.goto('/real-estate/apt-sale/seoul/gangnam/고장아파트'))?.status()).toBe(503)
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'index, follow')
  await allowOnlyExpectedConsoleErrors(testInfo, capture, expectedNegativeStart, [
    /Failed to load resource: the server responded with a status of 40[0-9]/,
    /Failed to load resource: the server responded with a status of 50[0-9]/,
  ])
  await attachCapture(testInfo, capture)
})

test('청약 상세는 공급·경쟁률·가점·특공·임대·링크·SEO를 실제 fixture로 렌더링한다', async ({
  page,
}, testInfo) => {
  const capture = captureRuntime(page)
  await stubKakaoMaps(page)
  await blockExternalNetwork(page)
  const rentalStats: string[] = []
  page.on('request', (request) => {
    if (request.url().includes('/rental-price-stats')) rentalStats.push(request.url())
  })
  await page.goto(subscriptionPath)
  await hydrated(page)
  await expect(page.locator('h1').first()).toContainText('회복청약 아파트')
  await expect(page.getByText('면적별 공급정보')).toBeVisible()
  await expect(page.getByText('면적별 경쟁률')).toBeVisible()
  await expect(page.getByText('당첨 가점 분석')).toBeVisible()
  await expect(page.getByText('면적별 특별공급 내역')).toBeVisible()
  await expect(page.getByRole('link', { name: '공식 홈페이지' })).toHaveAttribute(
    'href',
    /applyhome/
  )
  await expect(page.getByRole('link', { name: '원문 확인' })).toHaveAttribute(
    'href',
    /pblanc/
  )
  await expect(page.locator('link[rel=canonical]')).toHaveAttribute(
    'href',
    /\/subscription\/90001$/
  )
  await expect(page.locator('script[type="application/ld+json"]').first()).toBeAttached()
  await expect(
    page.locator('[id^="google_ads_iframe"], ins.adsbygoogle, [data-ad-slot]')
  ).toHaveCount(0)

  await page.goto(publicRentSubscriptionPath)
  await hydrated(page)
  await expect(page.locator('h1').first()).toContainText('회복공공임대')
  await expect(page.getByText('주변 아파트 전월세 시세')).toBeVisible()
  expect(rentalStats.length).toBeGreaterThan(0)
  expect(capture.consoleErrors).toEqual([])
  const expectedNegativeStart = capture.consoleErrors.length
  expect((await page.goto('/subscription/999404'))?.status()).toBe(404)
  expect((await page.goto('/subscription/999503'))?.status()).toBe(503)
  await allowOnlyExpectedConsoleErrors(testInfo, capture, expectedNegativeStart, [
    /Failed to load resource: the server responded with a status of 40[0-9]/,
    /Failed to load resource: the server responded with a status of 50[0-9]/,
  ])
  await attachCapture(testInfo, capture)
})
