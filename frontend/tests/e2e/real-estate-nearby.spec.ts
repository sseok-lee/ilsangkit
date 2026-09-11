import { test, expect } from '@playwright/test'

// Run with playwright.seo.config.ts: the fixed API supplies SSR and browser data.
const SALE_PATH = '/real-estate/apt-sale/seoul/gangnam/회복아파트'
const RENT_PATH = '/real-estate/apt-rent/seoul/gangnam/회복아파트'

test.beforeEach(async ({ page }) => {
  await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1'
    ? route.continue() : route.abort('blockedbyclient'))
})

test.describe('부동산 상세 — 인근 단지 cross-property', () => {
  for (const [mode, path] of [['매매', SALE_PATH], ['전월세', RENT_PATH]]) {
    test(`${mode} 페이지 → SSR 인근 카드에 최근 거래가 라벨`, async ({ page }) => {
      await page.goto(path)
      await page.waitForLoadState('networkidle')
      const card = page.getByRole('link').filter({ has: page.getByRole('heading', { name: '이웃아파트', exact: true }) })
      await expect(card).toBeVisible()
      await expect(card).toContainText('최근 거래가')
      await expect(card).toContainText('8억 5,000만')
    })
  }

  for (const [label, rentType] of [['전세', 'jeonse'], ['월세', 'wolse']]) {
    test(`전월세 페이지 → ${label} 토글 → nearby rentType=${rentType}`, async ({ page }) => {
      const requestedRentTypes: string[] = []
      await page.route('**/api/real-estate/nearby?**', route => {
        requestedRentTypes.push(new URL(route.request().url()).searchParams.get('rentType') ?? '(missing)')
        return route.fulfill({ json: { success: true, data: { apt: [], villa: [], offitel: [] } } })
      })
      await page.goto(RENT_PATH)
      await page.waitForLoadState('networkidle')
      expect(requestedRentTypes).toEqual([])
      await page.getByRole('button', { name: label, exact: true }).click()
      await expect.poll(() => requestedRentTypes).toEqual([rentType])
      await expect(page.getByRole('heading', { name: '이웃아파트', exact: true })).toHaveCount(0)
    })
  }
})
