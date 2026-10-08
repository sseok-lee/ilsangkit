import { expect, test, type Page } from '@playwright/test'

const expectedItemHrefs = [
  '/real-estate/apt-sale', '/real-estate/villa-sale', '/real-estate/offitel-sale', '/real-estate',
  '/subscription', '/subscription/sale/apt', '/subscription/rent/public',
  '/hospital', '/pharmacy', '/school', '/childcare', '/search',
  '/about', '/guide', '/faq', '/contact', '/contact#data-fix',
]
async function localOnly(page: Page) {
  await page.route('**/*', route => {
    const url = new URL(route.request().url())
    return url.hostname === '127.0.0.1' ? route.fallback() : route.abort('blockedbyclient')
  })
}
async function hydrated(page: Page) {
  await page.waitForFunction(() => {
    const root = document.querySelector('#__nuxt') as Element & {
      __vue_app__?: { config: { globalProperties: { $nuxt?: { isHydrating: boolean } } } }
    }
    return root?.__vue_app__?.config.globalProperties.$nuxt?.isHydrating === false
  })
}
test.beforeEach(async ({ page }) => { await localOnly(page) })

for (const width of [320, 390, 767, 768, 1024, 1440]) {
  test(`footer fits at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 1000 })
    const warnings: string[] = []
    page.on('console', message => { if (/hydration/i.test(message.text())) warnings.push(message.text()) })
    await page.goto('/about')
    await hydrated(page)
    const footer = page.locator('footer')
    const mobile = footer.getByTestId('footer-mobile-navigation')
    const wide = footer.getByTestId('footer-wide-navigation')
    await expect(width < 768 ? mobile : wide).toBeVisible()
    await expect(width < 768 ? wide : mobile).toBeHidden()
    for (const variant of [wide, mobile]) {
      expect(await variant.locator('nav a').evaluateAll(links => links.map(a => a.getAttribute('href'))))
        .toEqual(expectedItemHrefs)
    }
    await expect(footer.locator('a[href$="-rent"]')).toHaveCount(0)
    for (const href of ['/privacy', '/terms', 'mailto:contact@ilsangkit.co.kr']) {
      await expect(footer.locator(`a[href="${href}"]`)).toBeVisible()
    }
    if (width < 768) {
      expect(await mobile.locator('details').evaluateAll(items => items.map(item => (item as HTMLDetailsElement).open)))
        .toEqual([true, false, false, false])
    } else {
      expect(await wide.evaluate(element => getComputedStyle(element).gridTemplateColumns.split(' ').length)).toBe(4)
    }
    expect(await footer.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    expect(warnings).toEqual([])
    await footer.screenshot({ path: info.outputPath(`footer-${width}.png`) })
    if (width < 768) {
      for (const group of await mobile.locator('details').all()) {
        if (!await group.evaluate(element => (element as HTMLDetailsElement).open)) {
          await group.locator('summary').click()
        }
      }
      for (const target of await mobile.locator('summary, nav a').all()) {
        await expect(target).toBeVisible()
        expect((await target.boundingBox())?.height).toBeGreaterThanOrEqual(44)
      }
      expect(await footer.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
      await footer.screenshot({ path: info.outputPath(`footer-expanded-${width}.png`), style: 'header { visibility: hidden !important; }' })
    }
  })
}

test('disclosures remain independent and survive width changes', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 })
  await page.goto('/about')
  await hydrated(page)
  const mobile = page.getByTestId('footer-mobile-navigation')
  const estate = mobile.locator('[data-footer-group="real-estate"]')
  const facilities = mobile.locator('[data-footer-group="facilities"]')
  await estate.locator('summary').focus()
  await page.keyboard.press('Enter')
  await expect(estate).not.toHaveAttribute('open')
  await facilities.locator('summary').focus()
  await page.keyboard.press('Space')
  await expect(facilities).toHaveAttribute('open', '')
  await expect(estate).not.toHaveAttribute('open')
  await facilities.locator('summary').click()
  await facilities.locator('summary').focus()
  await page.keyboard.press('Tab')
  await expect(mobile.locator('[data-footer-group="support"] summary')).toBeFocused()

  await facilities.locator('summary').focus()
  await page.setViewportSize({ width: 768, height: 900 })
  const wide = page.getByTestId('footer-wide-navigation')
  await expect(wide.locator('[data-footer-group="facilities"] a').first()).toBeFocused()
  await expect(wide.getByRole('link', { name: '학교', exact: true })).toBeVisible()
  await wide.getByRole('link', { name: '학교', exact: true }).focus()
  await page.setViewportSize({ width: 390, height: 900 })
  await expect(facilities.locator('summary')).toBeFocused()
  await expect(estate).not.toHaveAttribute('open')
  await expect(facilities).not.toHaveAttribute('open')
  const privacy = page.locator('footer a[href="/privacy"]')
  await privacy.focus()
  await page.setViewportSize({ width: 1024, height: 900 })
  await expect(privacy).toBeFocused()
})

test('touch opens groups independently and a remount resets defaults', async ({ browser }, info) => {
  const context = await browser.newContext({ hasTouch: true, serviceWorkers: 'block', viewport: { width: 390, height: 844 }, baseURL: info.project.use.baseURL })
  try {
    const page = await context.newPage()
    await localOnly(page)
    await page.goto('/about')
    await hydrated(page)
    const groups = page.getByTestId('footer-mobile-navigation').locator('details')
    await groups.nth(2).locator('summary').tap()
    await groups.nth(3).locator('summary').tap()
    expect(await groups.evaluateAll(items => items.map(item => (item as HTMLDetailsElement).open)))
      .toEqual([true, false, true, true])
    await groups.nth(2).locator('summary').tap()
    await expect(groups.nth(2).locator('a[href="/school"]')).toBeHidden()
    await expect(groups.nth(3)).toHaveJSProperty('open', true)
    await page.reload()
    await hydrated(page)
    expect(await groups.evaluateAll(items => items.map(item => (item as HTMLDetailsElement).open)))
      .toEqual([true, false, false, false])
  } finally { await context.close() }
})

test('late sync data does not reopen a closed group', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 })
  let release!: () => void
  const ready = new Promise<void>(resolve => { release = resolve })
  await page.route('**/api/meta/sync-status', async route => {
    await ready
    await route.fulfill({ json: { success: true, data: { pharmacy: new Date().toISOString() } } })
  })
  await page.goto('/about')
  await hydrated(page)
  const first = page.getByTestId('footer-mobile-navigation').locator('details').first()
  await first.locator('summary').click()
  release()
  await expect(page.locator('footer')).toContainText('데이터 최종 동기화')
  await expect(first).not.toHaveAttribute('open')
})

test('footer survives sync failure and keeps the policy block', async ({ page }) => {
  await page.route('**/api/meta/sync-status', route => route.fulfill({ status: 503, json: { success: false } }))
  await page.goto('/about')
  await hydrated(page)
  await expect(page.locator('footer')).not.toContainText('데이터 최종 동기화')
  await expect(page.locator('footer a[href="/privacy"]')).toBeVisible()
})

test('SSR footer works without JavaScript', async ({ browser }, info) => {
  const context = await browser.newContext({ javaScriptEnabled: false, serviceWorkers: 'block', viewport: { width: 390, height: 900 }, baseURL: info.project.use.baseURL })
  try {
    const page = await context.newPage()
    await localOnly(page)
    await page.goto('/about')
    const facilities = page.getByTestId('footer-mobile-navigation').locator('[data-footer-group="facilities"]')
    await facilities.locator('summary').click()
    await expect(facilities.locator('a[href="/school"]')).toBeVisible()
    await expect(facilities.locator('a[href="/childcare"]')).toBeVisible()
    await page.locator('footer a[href="/privacy"]').click()
    await expect(page).toHaveURL(/\/privacy$/)
  } finally { await context.close() }
})

test('initial response contains the complete footer', async ({ request }) => {
  const response = await request.get('/about')
  expect(response.ok()).toBe(true)
  const footerHtml = (await response.text()).match(/<footer\b[^>]*>[\s\S]*?<\/footer>/)?.[0]
  expect(footerHtml).toBeDefined()
  for (const href of [...expectedItemHrefs, '/privacy', '/terms']) {
    expect(footerHtml).toContain(`href="${href}"`)
  }
  expect(footerHtml).toContain('<details')
  for (const type of ['apt-rent', 'villa-rent', 'offitel-rent']) {
    expect(footerHtml).not.toContain(`href="/real-estate/${type}"`)
  }
})

test('keeps map and admin pages free of the global footer', async ({ page }) => {
  for (const path of ['/real-estate', '/admin/login']) {
    await page.goto(path)
    await hydrated(page)
    await expect(page.locator('footer')).toHaveCount(0)
  }
})
test('renders the new footer on the error page', async ({ page }) => {
  const response = await page.goto('/__missing-footer-page')
  expect(response?.status()).toBe(404)
  await expect(page.locator('footer a[href="/privacy"]')).toBeVisible()
})
test('internal footer links perform a document navigation', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 900 })
  await page.goto('/about')
  await hydrated(page)
  const destination = page.waitForRequest(request => request.isNavigationRequest()
    && request.resourceType() === 'document'
    && new URL(request.url()).pathname === '/real-estate')
  await page.getByTestId('footer-wide-navigation').getByRole('link', { name: '지도로 찾기', exact: true }).click()
  await destination
  await expect(page).toHaveURL(/\/real-estate$/)
})

test('contact anchor and source links retain their destinations', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 900 })
  await page.goto('/about')
  await hydrated(page)
  const footer = page.locator('footer')
  await expect(footer.locator('a[href="mailto:contact@ilsangkit.co.kr"]')).toBeVisible()
  for (const href of ['https://www.data.go.kr', 'https://rt.molit.go.kr']) {
    const source = footer.locator(`a[href="${href}"]`)
    await expect(source).toBeVisible()
    await expect(source).toHaveAttribute('target', '_blank')
    expect((await source.getAttribute('rel'))?.split(/\s+/)).toEqual(expect.arrayContaining(['noopener', 'noreferrer']))
    await expect(source).toHaveAttribute('aria-label', /새 창/)
  }
  await page.getByTestId('footer-wide-navigation').getByRole('link', { name: '정보 수정 요청', exact: true }).click()
  await expect(page).toHaveURL(/\/contact#data-fix$/)
  await expect(page.locator('#data-fix')).toBeInViewport()
})

test('header menu still makes the footer inert', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 })
  await page.goto('/about')
  await hydrated(page)
  await page.getByRole('button', { name: '메뉴', exact: true }).click()
  await expect(page.locator('footer')).toHaveAttribute('inert', '')
  await page.keyboard.press('Escape')
  await expect(page.locator('footer')).not.toHaveAttribute('inert')
})
