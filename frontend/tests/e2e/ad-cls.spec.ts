import { test, expect } from '@playwright/test'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { installFakeAdSdk } from './helpers/adSdk'

const baselinePath = new URL('../fixtures/ads/layout-baseline.json', import.meta.url)
for (const scenario of ['fixed', 'auto']) {
  test(`${scenario} normal fill layout`, async ({ page, context }, info) => {
    const sdk = await installFakeAdSdk(context)
    await page.goto(`/${scenario}`)
    await expect.poll(() => page.evaluate(() => window.__fakeAds?.pushCount)).toBe(1)
    const beforeY = (await page.locator('#after').boundingBox())!.y
    await page.evaluate(() => window.__fakeAds.fill(0, 'filled', 280))
    await expect(page.locator('ins.adsbygoogle')).toHaveAttribute('data-ad-status', 'filled')
    await page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    )
    const afterY = (await page.locator('#after').boundingBox())!.y
    const shift = await page.evaluate(() => window.__adShift)
    expect(sdk.attempts).toBe(1)
    expect(await page.evaluate(() => window.__ilsangkitAdDebug)).toBeUndefined()
    await info.attach('normal-fill-metrics', {
      body: JSON.stringify({ viewport: page.viewportSize(), beforeY, afterY, shift }),
      contentType: 'application/json',
    })
    const key = `${info.project.name}:${scenario}`
    if (process.env.ADS_CAPTURE_BASELINE === '1') {
      const records = existsSync(baselinePath) ? JSON.parse(readFileSync(baselinePath, 'utf8')) : {}
      records[key] = {
        source: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
        viewport: page.viewportSize(),
        height: 280,
        beforeY,
        afterY,
        shift,
      }
      writeFileSync(baselinePath, JSON.stringify(records, null, 2) + '\n')
    } else {
      const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'))[key]
      expect(page.viewportSize()).toEqual(baseline.viewport)
      expect(shift - baseline.shift).toBeLessThan(0.01)
    }
  })
}
