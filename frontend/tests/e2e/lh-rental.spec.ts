import { test, expect } from '@playwright/test'

const SAMPLE_LIST = {
  success: true,
  data: {
    items: [
      {
        id: 5511,
        complexCode: '55001',
        complexName: 'E2E 강남 매입임대 1단지',
        city: '서울특별시',
        district: '강남구',
        rentalType: '매입임대',
        houseType: '아파트',
        householdCount: 80,
        exclusiveArea: 59.96,
        depositAmount: 80000000,
        monthlyRent: 200000,
        landlordAgency: 'LH',
        sourceId: 'lh-55001',
        createdAt: '2026-04-01T00:00:00Z',
        updatedAt: '2026-04-25T00:00:00Z',
      },
    ],
    pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
  },
}

test.describe('lh-rental: hub → 매입임대 탭', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/public-rental?**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(SAMPLE_LIST),
      })
    })
  })

  test('hub 에서 매입임대 탭으로 진입해 LH 매물 카드가 보인다', async ({ page }) => {
    await page.goto('/lh-rental')

    await expect(page.getByRole('heading', { name: 'LH 매입·전세임대' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'LH 매입임대' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'LH 전세임대' })).toBeVisible()

    await page.getByRole('link', { name: 'LH 매입임대' }).click()
    await expect(page).toHaveURL(/\/lh-rental\/buy-lease/)
    await expect(page.getByText('E2E 강남 매입임대 1단지')).toBeVisible()
  })
})
