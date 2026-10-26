import { test, expect, type Page } from '@playwright/test'

// Run with playwright.seo.config.ts: the fixed API supplies SSR and browser data.
const SALE_PATH = '/real-estate/apt-sale/seoul/gangnam/회복아파트'
const RENT_PATH = '/real-estate/apt-rent/seoul/gangnam/회복아파트'

// #940: 주변 단지는 NearbyComplexList 행(단지명은 heading 아님)으로 렌더된다. 활성 패널의 행 링크로 찾는다.
function nearbyRowLink(page: Page, name: string) {
  return page
    .locator('#nearby [role="tabpanel"] [data-testid="nearby-row"] a')
    .filter({ has: page.getByText(name, { exact: true }) })
}

test.beforeEach(async ({ page }) => {
  await page.route('**/*', (route) =>
    new URL(route.request().url()).hostname === '127.0.0.1'
      ? route.continue()
      : route.abort('blockedbyclient')
  )
})

test.describe('부동산 상세 — 인근 단지 cross-property', () => {
  // fixture nearby: 같은 면적(84㎡) 최근 거래 2026-09-12·7층, 매매 8억 5,000만원 / 전세 4억 9,800만원
  for (const [mode, path, price] of [
    ['매매', SALE_PATH, '8억 5,000만원'],
    ['전월세', RENT_PATH, '4억 9,800만원'],
  ]) {
    test(`${mode} 페이지 → SSR 인근 단지 행에 같은 면적 최근 거래가`, async ({ page }) => {
      const html = await (await page.request.get(path)).text()
      // SSR HTML(스크립트 제외)에 인근 단지 행과 그 단지명·최근가가 들어 있어야 크롤러가 내부 링크를 본다.
      const ssrRow = html
        .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
        .match(/<li[^>]*data-testid="nearby-row"[^>]*>[\s\S]*?<\/li>/g)
        ?.find((li) => li.includes('이웃아파트'))
      expect(ssrRow).toContain(price)
      await page.goto(path)
      await page.waitForLoadState('networkidle')
      const row = nearbyRowLink(page, '이웃아파트')
      await expect(row).toBeVisible()
      await expect(row).toHaveAttribute('href', /\/real-estate\/apt-(sale|rent)\//)
      await expect(row).toContainText(price)
      await expect(row).toContainText('84㎡ · 26.09.12 · 7층')
    })
  }

  for (const [label, rentType] of [
    ['전세', 'jeonse'],
    ['월세', 'wolse'],
  ]) {
    test(`전월세 페이지 → ${label} 토글 → nearby rentType=${rentType}`, async ({ page }) => {
      const requestedRentTypes: string[] = []
      await page.route('**/api/real-estate/nearby?**', (route) => {
        requestedRentTypes.push(
          new URL(route.request().url()).searchParams.get('rentType') ?? '(missing)'
        )
        return route.fulfill({ json: { success: true, data: { apt: [], villa: [], offitel: [] } } })
      })
      await page.goto(RENT_PATH)
      await page.waitForLoadState('networkidle')
      expect(requestedRentTypes).toEqual([])
      await expect(nearbyRowLink(page, '이웃아파트')).toBeVisible()
      if (rentType === 'jeonse') {
        await page.getByLabel('거래 유형').selectOption('wolse')
        await expect.poll(() => requestedRentTypes).toEqual(['wolse'])
      }
      await page.getByLabel('거래 유형').selectOption(rentType)
      await expect.poll(() => requestedRentTypes.at(-1)).toBe(rentType)
      await expect(nearbyRowLink(page, '이웃아파트')).toHaveCount(0)
    })
  }
})
