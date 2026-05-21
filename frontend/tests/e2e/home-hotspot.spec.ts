import { test, expect } from '@playwright/test'

// Sample rows for the new complex hotspot shape
function makeComplexHotspots() {
  return {
    newHigh: [
      {
        buildingName: '래미안대치팰리스',
        citySlug: 'seoul',
        city: '서울특별시',
        district: '강남구',
        districtSlug: 'gangnam',
        dealDate: '2026-05-01',
        newPyeong: 9500,
        prevMaxPyeong: 9000,
        changePct: 5.6,
      },
    ],
    active: [
      {
        buildingName: '아크로리버파크',
        citySlug: 'seoul',
        city: '서울특별시',
        district: '서초구',
        districtSlug: 'seocho',
        txnCount: 12,
        latestDealDate: '2026-05-01',
        avgPyeongPrice: 8800,
      },
    ],
    topPyeong: [
      {
        buildingName: '반포자이',
        citySlug: 'seoul',
        city: '서울특별시',
        district: '서초구',
        districtSlug: 'seocho',
        avgPyeongPrice: 9200,
        txnCount: 8,
      },
    ],
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
        apt: makeComplexHotspots(),
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
  test('데스크톱: 시그널 카드 섹션 + 건물유형 토글 표시', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await setupHomeMocks(page)
    await page.goto('/')

    await expect(page.getByText('오늘의 부동산 시장')).toBeVisible({ timeout: 15000 })
    // Property type toggle buttons visible regardless of data
    await expect(page.getByRole('button', { name: '아파트' })).toBeVisible()
    await expect(page.getByRole('button', { name: '오피스텔' })).toBeVisible()
    await expect(page.getByRole('button', { name: '빌라' })).toBeVisible()
  })

  test('신호등 탭 레이블: 신고가 갱신 / 거래 활발 / 평당가 TOP', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await setupHomeMocks(page)
    await page.goto('/')

    await expect(page.getByText('오늘의 부동산 시장')).toBeVisible({ timeout: 15000 })

    // New signal tab labels
    await expect(page.getByText('신고가 갱신')).toBeVisible()
    await expect(page.getByText('거래 활발')).toBeVisible()
    await expect(page.getByText('평당가 TOP')).toBeVisible()
  })

  test('건물유형 토글 → 동적 페치 (오피스텔 클릭)', async ({ page }) => {
    await setupHomeMocks(page)
    // Stub complex-hotspots endpoint for dynamic fetch on toggle
    await page.route('**/api/meta/complex-hotspots**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: makeComplexHotspots() }),
      })
    })

    await page.goto('/')
    await expect(page.getByText('오늘의 부동산 시장')).toBeVisible({ timeout: 15000 })

    const offitelBtn = page.getByRole('button', { name: '오피스텔' })
    const responsePromise = page.waitForResponse(
      (res) =>
        res.url().includes('/api/meta/complex-hotspots') && res.url().includes('propertyType=offitel'),
    )
    await offitelBtn.click()
    const response = await responsePromise
    expect(response.status()).toBe(200)
  })
})
