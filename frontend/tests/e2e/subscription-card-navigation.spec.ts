import { expect, test } from '@playwright/test'

for (const category of ['sale', 'rent']) {
  test(`${category} notice card opens detail from its body and keyboard`, async ({ page }) => {
    await page.goto(`/subscription/${category}`, { waitUntil: 'domcontentloaded' })
    await page.waitForFunction(() => {
      const root = document.querySelector('#__nuxt') as (Element & {
        __vue_app__?: { $nuxt?: { isHydrating?: boolean } }
      }) | null
      return root?.__vue_app__?.$nuxt?.isHydrating === false
    })

    const row = page.locator('.notice-row').first()
    const link = row.locator('.notice-name')
    const href = await link.getAttribute('href')
    expect(href).toMatch(/^\/subscription\/\d+$/)

    // Click the region's screen position: it is outside the title link.
    // A stretched link may cover it, so use the real pointer hit target.
    await row.scrollIntoViewIfNeeded()
    const region = await row.locator('.region').boundingBox()
    expect(region).not.toBeNull()
    await page.mouse.click(region!.x + region!.width / 2, region!.y + region!.height / 2)
    await expect(page).toHaveURL(new URL(href!, page.url()).href)

    await page.goBack({ waitUntil: 'domcontentloaded' })
    await expect(page).toHaveURL(new RegExp(`/subscription/${category}$`))
    await expect(link).toHaveAttribute('href', href!)
    await link.focus()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(new URL(href!, page.url()).href)
  })
}
