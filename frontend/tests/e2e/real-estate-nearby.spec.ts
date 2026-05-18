import { test, expect } from '@playwright/test'

// Building: 리버뷰신안인스빌2단지, 서울 영등포구 (transactionCount >= 5 in DB)
const CITY_SLUG = 'seoul'
const DISTRICT_SLUG = 'yeongdeungpo'
const BUILDING_NAME = '리버뷰신안인스빌2단지'
const SALE_PATH = `/real-estate/apt-sale/${CITY_SLUG}/${DISTRICT_SLUG}/${encodeURIComponent(BUILDING_NAME)}`
const RENT_PATH = `/real-estate/apt-rent/${CITY_SLUG}/${DISTRICT_SLUG}/${encodeURIComponent(BUILDING_NAME)}`

// Shared mock nearby response (apt only)
const NEARBY_APT_ITEM = {
  buildingName: '인근아파트단지',
  city: '서울특별시',
  district: '영등포구',
  dongName: '당산동',
  bjdCode: '1156011100',
  latestPrice: 500000000,
}

function makeNearbyResponse(apt: typeof NEARBY_APT_ITEM[]) {
  return {
    success: true,
    data: { apt, villa: [], offitel: [] },
  }
}

function makeComplexListResponse(bjdCode: string) {
  return {
    success: true,
    data: {
      items: [
        {
          buildingName: BUILDING_NAME,
          bjdCode,
          city: '서울특별시',
          district: '영등포구',
        },
      ],
      total: 1,
      page: 1,
      totalPages: 1,
    },
  }
}

async function setupBaseMocks(page: import('@playwright/test').Page) {
  // Provide a bjdCode so the page can call loadNearby
  await page.route('**/api/real-estate/*/complexes**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(makeComplexListResponse('1156011100')),
    })
  })

  // Stub out stats / transactions / building-info so they return gracefully
  await page.route('**/api/real-estate/*/stats**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { monthly: [], summary: null } }),
    })
  })
  await page.route('**/api/real-estate/*/transactions**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { items: [], total: 0, page: 1, totalPages: 0 } }),
    })
  })
  await page.route('**/api/real-estate/*/building-info**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          buildingName: BUILDING_NAME,
          bjdCode: '1156011100',
          city: '서울특별시',
          district: '영등포구',
          dongName: '당산동',
          lat: 37.52,
          lng: 126.9,
          buildYear: 2000,
          minArea: 59,
          maxArea: 84,
          latestDealAmount: 500000000,
          latestDealYear: 2025,
          latestDealMonth: 1,
        },
      }),
    })
  })
  await page.route('**/api/real-estate/*/area-groups**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: [] }),
    })
  })
  await page.route('**/api/meta/sync-status**', async (route) => {
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
  await page.route('**/api/real-estate/price-analysis**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: null }),
    })
  })
}

test.describe('부동산 상세 — 인근 단지 cross-property', () => {
  test('매매 페이지 → 인근 카드에 "최근 거래가" 라벨', async ({ page }) => {
    await setupBaseMocks(page)
    await page.route('**/api/real-estate/nearby**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(makeNearbyResponse([NEARBY_APT_ITEM])),
      })
    })

    await page.goto(SALE_PATH)
    await expect(page.locator('text=같은 동 아파트 실거래').first()).toBeVisible({ timeout: 15000 })
    await expect(page.locator('text=인근아파트단지').first()).toBeVisible()
    await expect(page.locator('p:has-text("최근 거래가")').first()).toBeVisible()
  })

  test('전월세 페이지 → 인근 카드에 "최근 거래가" 라벨', async ({ page }) => {
    await setupBaseMocks(page)
    await page.route('**/api/real-estate/nearby**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(makeNearbyResponse([NEARBY_APT_ITEM])),
      })
    })

    await page.goto(RENT_PATH)
    await expect(page.locator('text=같은 동 아파트 실거래').first()).toBeVisible({ timeout: 15000 })
    await expect(page.locator('p:has-text("최근 거래가")').first()).toBeVisible()
  })

  test('전월세 페이지 → 전세 토글 클릭 → nearby API에 rentType=jeonse 전달', async ({ page }) => {
    const requestedRentTypes: string[] = []

    await setupBaseMocks(page)
    await page.route('**/api/real-estate/nearby**', async (route) => {
      const url = route.request().url()
      const rentType = new URL(url).searchParams.get('rentType') ?? '(missing)'
      requestedRentTypes.push(rentType)
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(makeNearbyResponse([NEARBY_APT_ITEM])),
      })
    })

    await page.goto(RENT_PATH)
    await expect(page.locator('text=같은 동 아파트 실거래').first()).toBeVisible({ timeout: 15000 })

    await page.getByRole('button', { name: '전세', exact: true }).click()
    await expect.poll(() => requestedRentTypes).toContain('jeonse')
  })

  test('전월세 페이지 → 월세 토글 클릭 → nearby API에 rentType=wolse 전달', async ({ page }) => {
    const requestedRentTypes: string[] = []

    await setupBaseMocks(page)
    await page.route('**/api/real-estate/nearby**', async (route) => {
      const url = route.request().url()
      const rentType = new URL(url).searchParams.get('rentType') ?? '(missing)'
      requestedRentTypes.push(rentType)
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(makeNearbyResponse([NEARBY_APT_ITEM])),
      })
    })

    await page.goto(RENT_PATH)
    await expect(page.locator('text=같은 동 아파트 실거래').first()).toBeVisible({ timeout: 15000 })

    await page.getByRole('button', { name: '월세', exact: true }).click()
    await expect.poll(() => requestedRentTypes).toContain('wolse')
  })
})
