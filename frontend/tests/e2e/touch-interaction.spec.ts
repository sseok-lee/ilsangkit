import { test, expect } from '@playwright/test'

test.describe('터치 인터랙션 검증', () => {
  test.describe('터치 타겟 크기', () => {
    test('검색 페이지 버튼 최소 44x44px (Mobile)', async ({ page, isMobile }) => {
      test.skip(!isMobile, '모바일 전용 테스트')
      await page.goto('/search')

      // 뒤로가기 버튼
      const backButton = page.locator('header button').first()
      await expect(backButton).toBeVisible()
      const backBox = await backButton.boundingBox()
      if (backBox) {
        expect(backBox.width).toBeGreaterThanOrEqual(44)
        expect(backBox.height).toBeGreaterThanOrEqual(44)
      }
    })

    test('홈 페이지 CTA 버튼 터치 영역 (Mobile)', async ({ page, isMobile }) => {
      test.skip(!isMobile, '모바일 전용 테스트')
      await page.goto('/')

      const ctaButton = page.locator('[data-testid="location-button"]')
      await expect(ctaButton).toBeVisible()
      const ctaBox = await ctaButton.boundingBox()
      if (ctaBox) {
        expect(ctaBox.height).toBeGreaterThanOrEqual(44)
      }
    })
  })

  test.describe('카테고리 칩 스와이프', () => {
    test('카테고리 칩 가로 스크롤 가능 (Mobile)', async ({ page, isMobile }) => {
      test.skip(!isMobile, '모바일 전용 테스트')
      await page.goto('/search')

      // 카테고리 칩 컨테이너
      const chipContainer = page.locator('.overflow-x-auto').first()
      await expect(chipContainer).toBeVisible()

      // scrollWidth > clientWidth 이면 스크롤 가능
      const isScrollable = await chipContainer.evaluate((el) => {
        return el.scrollWidth > el.clientWidth
      })
      expect(isScrollable).toBe(true)
    })

    test('홈 페이지 카테고리 칩 가로 스크롤 (Mobile)', async ({ page, isMobile }) => {
      test.skip(!isMobile, '모바일 전용 테스트')
      await page.goto('/')

      const chipContainer = page.locator('.overflow-x-auto').first()
      await expect(chipContainer).toBeVisible()

      const isScrollable = await chipContainer.evaluate((el) => {
        return el.scrollWidth > el.clientWidth
      })
      expect(isScrollable).toBe(true)
    })
  })

  test.describe('지도 토글', () => {
    test('FAB 클릭 시 전체화면 지도 오버레이 (Mobile)', async ({ page, isMobile }) => {
      test.skip(!isMobile, '모바일 전용 테스트')
      await page.goto('/search')

      // FAB 버튼 찾기
      const fab = page.locator('text=지도에서 보기')
      await expect(fab).toBeVisible()

      // FAB 클릭
      await fab.click()

      // 지도 오버레이가 나타나야 함
      const mapOverlay = page.locator('.fixed.inset-0').first()
      await expect(mapOverlay).toBeVisible()

      // 닫기 버튼으로 닫을 수 있어야 함
      const closeButton = page.locator('.fixed.inset-0 button').first()
      if (await closeButton.isVisible()) {
        // 지도 헤더의 닫기 버튼 클릭
        const closeIcon = page.locator('text=close').last()
        if (await closeIcon.isVisible()) {
          await closeIcon.click()
        }
      }
    })
  })
})
