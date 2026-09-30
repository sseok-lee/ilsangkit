import { test, expect, type Page } from '@playwright/test'

function dailyCounts(base: number) {
  return Array.from({ length: 30 }, (_, index) => ({
    date: `2026-09-${String(index + 1).padStart(2, '0')}`,
    count: base + (index % 4),
  }))
}

function makeHomeMarketResponse(
  label = '전국',
  city: string | null = null,
  district: string | null = null
) {
  const apt = dailyCounts(district === 'gangbuk' ? 3 : 5)
  const villa = dailyCounts(2)
  const offitel = dailyCounts(1)
  return {
    success: true,
    data: {
      region: { city, district, label },
      window: { from: '2026-08-23', to: '2026-09-21' },
      generatedAt: '2026-09-21T03:00:00.000Z',
      counts: {
        apt: {
          status: 'ok',
          data: { total: apt.reduce((sum, item) => sum + item.count, 0), daily: apt },
        },
        villa: {
          status: 'ok',
          data: { total: villa.reduce((sum, item) => sum + item.count, 0), daily: villa },
        },
        offitel: {
          status: 'ok',
          data: { total: offitel.reduce((sum, item) => sum + item.count, 0), daily: offitel },
        },
      },
      recent: {
        status: 'ok',
        data: [
          {
            type: 'apt',
            transactionId: 1,
            city: '서울특별시',
            district: label,
            bjdCode: '1168010100',
            buildingName: `${label} 회복아파트`,
            jibun: '123',
            date: '2026-09-20',
            amount: 85000,
            area: '84.90㎡',
          },
        ],
      },
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
      realEstateHotspots: {},
      trendingBuildings: { sale: [], jeonse: [], wolse: [] },
      subscriptionSummary: null,
      newlyListedToday: 0,
    },
  }
}

async function setupHomeMocks(page: Page) {
  await page.route('**/api/real-estate/home-market**', async (route) => {
    const url = new URL(route.request().url())
    const district = url.searchParams.get('district')
    const city = url.searchParams.get('city')
    const label = district === 'gangnam' ? '강남구' : district === 'gangbuk' ? '강북구' : '전국'
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(makeHomeMarketResponse(label, city, district)),
    })
  })
  await page.route('**/api/meta/home-dashboard', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(makeDashboardResponse()),
    })
  })
  await page.route('**/api/meta/sync-status', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: {} }),
    })
  })
  await page.route('**/api/subscription**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: { items: [], total: 0, page: 1, totalPages: 0 },
      }),
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

test.describe('메인페이지 동네 거래 패널', () => {
  test('데스크톱: 거래 패널과 세 주거 유형 카드가 표시된다', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await setupHomeMocks(page)
    await page.goto('/')

    await expect(page.getByRole('heading', { name: '지금, 우리 동네 거래는' })).toBeVisible({
      timeout: 15000,
    })
    await expect(page.getByRole('heading', { name: '아파트 매매' })).toBeVisible()
    await expect(page.getByRole('heading', { name: '빌라 매매' })).toBeVisible()
    await expect(page.getByRole('heading', { name: '오피스텔 매매' })).toBeVisible()
    await expect(page.getByRole('heading', { name: '최근 거래가 있는 단지' })).toBeVisible()
  })

  test('지역 선택 변경 시 home-market API를 다시 요청하고 최근 거래 목록을 갱신한다', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await setupHomeMocks(page)
    await page.goto('/')

    await expect(page.getByText('전국 회복아파트')).toBeVisible({ timeout: 15000 })
    const responsePromise = page.waitForResponse(
      (res) =>
        res.url().includes('/api/real-estate/home-market') && res.url().includes('district=gangbuk')
    )
    await page.getByLabel('시도 선택').selectOption('seoul')
    await page.getByLabel('시군구 선택').selectOption('gangbuk')
    expect((await responsePromise).status()).toBe(200)
    await expect(page.getByText('강북구 회복아파트')).toBeVisible()
  })

  test('시장 정보 실패 시 재시도 버튼으로 회복한다', async ({ page }) => {
    let calls = 0
    await setupHomeMocks(page)
    await page.route('**/api/real-estate/home-market**', async (route) => {
      calls += 1
      if (calls === 1) {
        await route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ success: false }),
        })
        return
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(makeHomeMarketResponse()),
      })
    })

    await page.goto('/')
    await expect(page.getByText('시장 정보를 불러오지 못했습니다.')).toBeVisible({ timeout: 15000 })
    await page.getByRole('button', { name: '다시 시도' }).click()
    await expect(page.getByRole('heading', { name: '아파트 매매' })).toBeVisible()
    expect(calls).toBe(2)
  })
})
