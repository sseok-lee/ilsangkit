import { expect, test, type Page } from '@playwright/test'

async function navigate(page: Page, path: string) {
  await page.evaluate(async (target) => {
    const app = (document.querySelector('#__nuxt') as unknown as {
      __vue_app__: { config: { globalProperties: { $router: { push: (path: string) => Promise<unknown> } } } }
    }).__vue_app__
    await app.config.globalProperties.$router.push(target)
  }, path)
  await expect(page).toHaveURL(new RegExp(path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$'))
}

async function expectHead(page: Page, path: string, noindex: boolean) {
  const robots = page.locator('head meta[name="robots"]')
  if (noindex) {
    await expect(robots).toHaveCount(1)
    await expect(robots).toHaveAttribute('content', 'noindex, follow')
  } else {
    // Absence means index/follow too: the SSR default is removed when the
    // reactive noindex override is disposed on client navigation.
    await expect(page.locator('head meta[name="robots"][content*="noindex"]')).toHaveCount(0)
    expect(await robots.count()).toBeLessThanOrEqual(1)
    if (await robots.count()) await expect(robots).toHaveAttribute('content', /^index, follow/)
  }
  const canonical = page.locator('head link[rel="canonical"]')
  await expect(canonical).toHaveCount(noindex ? 0 : 1)
  if (!noindex) await expect(canonical).toHaveAttribute('href', `https://ilsangkit.co.kr${path}`)
}

for (const path of ['/toilet', '/seoul/gangnam/toilet', '/subway']) {
  test(`${path}: SSR query head and client index/noindex/index transitions`, async ({ page, request }) => {
    for (const query of ['?lat=37.5', '?lng=127', '?lat=37.5&lng=127', '?q=test', '?q=', '?lat&lat=bad']) {
      const response = await request.get(path + query, { headers: { Accept: 'text/html' } })
      expect(response.status()).toBe(200)
      const html = await response.text()
      expect(html.match(/<meta[^>]*name="robots"[^>]*>/g)).toEqual(['<meta name="robots" content="noindex, follow">'])
      expect(html).not.toMatch(/<link[^>]*rel="canonical"/)
    }
    await page.goto(path)
    await page.waitForFunction(() => !!(document.querySelector('#__nuxt') as unknown as { __vue_app__?: unknown })?.__vue_app__)
    await expectHead(page, path, false)
    for (const query of ['?lat=37.5', '?lng=bad', '?q=', '?q=one&q=two']) {
      await navigate(page, path + query)
      await expectHead(page, path, true)
      await navigate(page, path)
      await expectHead(page, path, false)
    }
    for (const query of ['?page=2', '?keyword=test', '?keyword=%20']) {
      await navigate(page, path + query)
      const noindex = query === '?page=2' ? path !== '/subway' : query === '?keyword=test' && path === '/toilet'
      await expectHead(page, path, noindex)
      await navigate(page, path)
      await expectHead(page, path, false)
    }
    for (const query of ['?city=seoul', '?district=gangnam']) {
      await navigate(page, path + query)
      await expectHead(page, path, false)
    }
  })
}

test('category repeated keyword stays safe and retains nonblank keyword noindex', async ({ request }) => {
  const response = await request.get('/toilet?keyword=test&keyword=other', { headers: { Accept: 'text/html' } })
  expect(response.status()).toBe(200)
  expect(await response.text()).toContain('<meta name="robots" content="noindex, follow">')
})

test('schedule is indexable unless an independent query rule applies', async ({ page }) => {
  const path = '/chungnam/buyeo/trash'
  await page.goto(path + '?schedule=13343')
  await page.waitForFunction(() => !!(document.querySelector('#__nuxt') as unknown as { __vue_app__?: unknown })?.__vue_app__)
  await expectHead(page, path, false)
  await navigate(page, path + '?schedule=13343&q=test')
  await expectHead(page, path, true)
  await navigate(page, path + '?schedule=13343')
  await expectHead(page, path, false)
})
