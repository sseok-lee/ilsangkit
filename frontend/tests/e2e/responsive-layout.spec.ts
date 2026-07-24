import { test, expect } from '@playwright/test'

test.describe('반응형 레이아웃 검증', () => {
  test.describe('홈페이지', () => {
    test('Mobile: 핵심 검색과 주요 섹션 표시', async ({ page, isMobile }) => {
      test.skip(!isMobile, '모바일 전용 테스트')
      await page.goto('/')

      await expect(page.getByText('내 동네 부동산·청약·생활정보, 한 번에')).toBeVisible()
      await expect(page.getByLabel('단지명·동네·시설 검색')).toBeVisible()
      await expect(page.getByText('오늘 확인할 정보')).toBeVisible()
      await expect(page.getByText('빠른 생활시설 찾기')).toBeVisible()
    })

    test('Desktop: 핵심 검색과 주요 섹션 표시', async ({ page, isMobile }) => {
      test.skip(isMobile, '데스크톱 전용 테스트')
      await page.goto('/')

      await expect(page.getByText('내 동네 부동산·청약·생활정보, 한 번에')).toBeVisible()
      await expect(page.getByLabel('단지명·동네·시설 검색')).toBeVisible()
      await expect(page.getByRole('navigation').first()).toBeVisible()
      await expect(page.getByText('부동산 실거래가')).toBeVisible()
    })
  })

  test.describe('검색 페이지', () => {
    test('Mobile: 검색 입력 표시', async ({ page, isMobile }) => {
      test.skip(!isMobile, '모바일 전용 테스트')
      await page.goto('/search')

      await expect(page.getByText('통합 검색')).toBeVisible()
      await expect(page.getByLabel('통합 검색')).toBeVisible()
    })

    test('Desktop: 검색 입력 표시', async ({ page, isMobile }) => {
      test.skip(isMobile, '데스크톱 전용 테스트')
      await page.goto('/search')

      await expect(page.getByText('통합 검색')).toBeVisible()
      await expect(page.getByLabel('통합 검색')).toBeVisible()
    })
  })
})
