import { test, expect } from '@playwright/test'

// Minimal hotspot bundle for a single property type
function makePropertyHotspots() {
  return {
    sale: {
      rising: [],
      falling: [],
      active: [],
    },
    jeonse: {
      rising: [],
      falling: [],
      active: [],
    },
    wolse: {
      active: [],
    },
  }
}

function makeDashboardResponse() {
  return {
    success: true,
    data: {
      total: 0,
      buildingCount: 0,
      subscriptionActiveCount: 0,
      realEstateTrends: [],
      realEstateHotspots: {
        apt: makePropertyHotspots(),
      },
      trendingBuildings: { sale: [], jeonse: [], wolse: [] },
      subscriptionSummary: null,
      newlyListedToday: 0,
    },
  }
}

async function setupHomeMocks(page: import('@playwright/test').Page) {
  await page.route('**/api/meta/home-dashboard', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(makeDashboardResponse()),
    })
  })
  // Stub other common API calls the home page might make
  await page.route('**/api/meta/sync-status', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: {} }),
    })
  })
  await page.route('**/api/facilities/search**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { items: [] } }),
    })
  })
}

test.describe('메인페이지 부동산 핫스팟', () => {
  test('데스크톱: 시그널 카드 섹션 + 토글 컨트롤 표시', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await setupHomeMocks(page)
    await page.goto('/')

    await expect(page.getByText('오늘의 부동산 시장')).toBeVisible({ timeout: 15000 })
    // Property type toggle buttons visible regardless of data
    await expect(page.getByRole('button', { name: '아파트' })).toBeVisible()
    await expect(page.getByRole('button', { name: '오피스텔' })).toBeVisible()
    await expect(page.getByRole('button', { name: '빌라' })).toBeVisible()
  })

  test('월세 탭 클릭 시 평당가 카드 hidden + 안내 캡션', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await setupHomeMocks(page)
    await page.goto('/')

    await expect(page.getByText('오늘의 부동산 시장')).toBeVisible({ timeout: 15000 })

    // Click 월세 in TxnTypeMiniTabs (small pill buttons at top)
    const wolseBtn = page.getByRole('button', { name: '월세' }).first()
    await wolseBtn.click()

    // Special caption shown only for wolse
    await expect(page.getByText('월세는 거래량 시그널만 제공해요')).toBeVisible()
    // Rising/falling cards hidden in wolse mode
    await expect(page.getByText('평당가 상승 TOP')).not.toBeVisible()
  })

  test('건물유형 토글 → 동적 페치 (오피스텔 클릭)', async ({ page }) => {
    await setupHomeMocks(page)
    // Do NOT pre-stub offitel data so the component must fetch it
    await page.route('**/api/meta/hotspots**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: makePropertyHotspots() }),
      })
    })

    await page.goto('/')
    await expect(page.getByText('오늘의 부동산 시장')).toBeVisible({ timeout: 15000 })

    const offitelBtn = page.getByRole('button', { name: '오피스텔' })
    const responsePromise = page.waitForResponse(
      (res) =>
        res.url().includes('/api/meta/hotspots') && res.url().includes('propertyType=offitel'),
    )
    await offitelBtn.click()
    const response = await responsePromise
    expect(response.status()).toBe(200)
  })
})
