import { test, expect } from '@playwright/test'

test.describe('반응형 레이아웃 검증', () => {
  test.describe('홈페이지', () => {
    test('Mobile: 단일 컬럼 레이아웃, 데스크톱 섹션 숨김', async ({ page, isMobile }) => {
      test.skip(!isMobile, '모바일 전용 테스트')
      await page.goto('/')

      // 모바일 히어로 섹션이 보여야 함
      const mobileHero = page.locator('section.md\\:hidden').first()
      await expect(mobileHero).toBeVisible()

      // 데스크톱 히어로 섹션은 숨겨져야 함
      const desktopHero = page.locator('section.hidden.md\\:block').first()
      await expect(desktopHero).toBeHidden()
    })

    test('Desktop: 데스크톱 섹션 표시, 모바일 섹션 숨김', async ({ page, isMobile }) => {
      test.skip(isMobile, '데스크톱 전용 테스트')
      await page.goto('/')

      // 데스크톱 히어로 섹션이 보여야 함
      const desktopHero = page.locator('section.hidden.md\\:block').first()
      await expect(desktopHero).toBeVisible()

      // 모바일 히어로 섹션은 숨겨져야 함
      const mobileHero = page.locator('section.md\\:hidden').first()
      await expect(mobileHero).toBeHidden()
    })
  })

  test.describe('검색 페이지', () => {
    test('Mobile: 사이드바 전체 너비', async ({ page, isMobile }) => {
      test.skip(!isMobile, '모바일 전용 테스트')
      await page.goto('/search')

      const sidebar = page.locator('aside').first()
      await expect(sidebar).toBeVisible()

      const box = await sidebar.boundingBox()
      expect(box).toBeTruthy()
      // 모바일에서 사이드바는 화면 전체 너비를 차지해야 함
      const viewport = page.viewportSize()
      if (box && viewport) {
        expect(box.width).toBeGreaterThanOrEqual(viewport.width * 0.9)
      }
    })

    test('Desktop: 2컬럼 분할 뷰 (사이드바 + 지도)', async ({ page, isMobile }) => {
      test.skip(isMobile, '데스크톱 전용 테스트')
      await page.goto('/search')

      // 사이드바 존재
      const sidebar = page.locator('aside').first()
      await expect(sidebar).toBeVisible()

      const sidebarBox = await sidebar.boundingBox()
      expect(sidebarBox).toBeTruthy()
      if (sidebarBox) {
        // 사이드바 너비가 약 400px
        expect(sidebarBox.width).toBeGreaterThanOrEqual(350)
        expect(sidebarBox.width).toBeLessThanOrEqual(450)
      }

      // 지도 영역 존재 (desktop)
      const mapArea = page.locator('main.hidden.md\\:flex').first()
      await expect(mapArea).toBeVisible()
    })

    test('Tablet: 사이드바 400px + 지도 영역', async ({ page }) => {
      const viewport = page.viewportSize()
      test.skip(!viewport || viewport.width < 768 || viewport.width > 1024, '태블릿 전용 테스트')

      await page.goto('/search')

      const sidebar = page.locator('aside').first()
      await expect(sidebar).toBeVisible()

      const sidebarBox = await sidebar.boundingBox()
      if (sidebarBox) {
        expect(sidebarBox.width).toBeGreaterThanOrEqual(350)
        expect(sidebarBox.width).toBeLessThanOrEqual(450)
      }
    })
  })
})
