import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { assertNoFakeAdInstrumentationErrors, installFakeAdSdk } from './helpers/adSdk'
import { installAdFrameRecorder, markAdPhase, readAdFrames } from './helpers/adFrames'

test.afterEach(async ({ page }) => {
  await assertNoFakeAdInstrumentationErrors(page)
})

// Read-only R1 comparison context. R2 deliberately allows measured normal-fill CLS.
const baseline = JSON.parse(
  readFileSync(new URL('../fixtures/ads/layout-baseline.json', import.meta.url), 'utf8')
)
for (const scenario of ['default', 'auto']) {
  for (const height of [100, 280, 390]) {
    test(`${scenario} natural ${height}px fill geometry and ten-second stability`, async ({
      page,
      context,
    }, info) => {
      await installAdFrameRecorder(context)
      const sdk = await installFakeAdSdk(context)
      await page.goto(`/${scenario}`)
      await expect.poll(() => page.evaluate(() => window.__fakeAds?.requests.length)).toBe(1)
      const before = (await readAdFrames(page)).at(-1)!
      expect(before.slots[0].height).toBe(0)
      const reference = info.outputPath('empty-reference.png')
      await page.screenshot({ path: reference })
      await info.attach('empty-reference', { path: reference, contentType: 'image/png' })
      await page.evaluate((size) => window.__fakeAds.fill(0, 'filled', size), height)
      await markAdPhase(page, 'filled')
      await expect
        .poll(() => page.locator('.ad-banner').evaluate((el) => el.getBoundingClientRect().height))
        .toBe(height)
      await page.evaluate(
        () =>
          new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
          )
      )
      const filled = (await readAdFrames(page)).at(-1)!
      const oldSlot = before.slots[0]
      const newSlot = filled.slots[0]
      const expectedDelta =
        newSlot.height -
        oldSlot.height +
        newSlot.marginTop +
        newSlot.marginBottom -
        oldSlot.marginTop -
        oldSlot.marginBottom
      expect(Math.abs(filled.afterY - before.afterY - expectedDelta)).toBeLessThan(1)
      expect(newSlot.insHeight).toBe(height)
      expect(expectedDelta).toBeGreaterThanOrEqual(height)
      await page.waitForTimeout(10000)
      const frames = await readAdFrames(page)
      for (const frame of frames.filter((frame) => frame.at >= filled.at)) {
        expect(Math.abs(frame.afterY - filled.afterY)).toBeLessThan(1)
        expect(frame.slots[0].height).toBe(height)
      }
      expect(sdk.attempts).toBe(1)
      await info.attach('r2-normal-fill-frames', {
        body: JSON.stringify({
          viewport: page.viewportSize(),
          scenario,
          height,
          beforeY: before.afterY,
          afterY: filled.afterY,
          expectedDelta,
          shift: frames.at(-1)!.shift,
          r1Comparison:
            baseline[`${info.project.name}:${scenario === 'default' ? 'fixed' : 'auto'}`],
          frames,
          shifts: await page.evaluate(() => window.__adShifts),
        }),
        contentType: 'application/json',
      })
      const screenshot = info.outputPath('natural-fill.png')
      await page.screenshot({ path: screenshot })
      await info.attach('natural-fill', { path: screenshot, contentType: 'image/png' })
    })
  }
}
