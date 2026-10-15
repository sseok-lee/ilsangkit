import type { BrowserContext, Page } from '@playwright/test'

export type AdPhase = 'initial' | 'hydrated' | 'ready' | 'failed' | 'pending-size' | 'filled'
export interface AdSlotFrame {
  height: number
  marginTop: number
  marginBottom: number
  paddingTop: number
  paddingBottom: number
  borderTop: number
  borderBottom: number
  insHeight: number | null
}
export interface AdFrame {
  at: number
  phase: AdPhase
  afterY: number
  shift: number
  slots: AdSlotFrame[]
}
declare global {
  interface Window {
    __adFrames: AdFrame[]
    __adPhase: AdPhase
  }
}

export async function installAdFrameRecorder(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    window.__adFrames = []
    window.__adPhase = 'initial'
    function record(at: number) {
      const after = document.querySelector<HTMLElement>('#after')
      const elements = Array.from(document.querySelectorAll<HTMLElement>('.ad-banner'))
      const styleReady =
        document.body &&
        getComputedStyle(document.body).getPropertyValue('--ad-fixture-ready').trim() === '1'
      if (
        styleReady &&
        after?.isConnected &&
        elements.length &&
        elements.every((el) => el.isConnected)
      ) {
        const afterY = after.getBoundingClientRect().top + window.scrollY
        const slots = elements.map((el) => {
          const css = getComputedStyle(el)
          const ins = el.querySelector<HTMLElement>('ins.adsbygoogle')
          return {
            height: el.getBoundingClientRect().height,
            marginTop: parseFloat(css.marginTop),
            marginBottom: parseFloat(css.marginBottom),
            paddingTop: parseFloat(css.paddingTop),
            paddingBottom: parseFloat(css.paddingBottom),
            borderTop: parseFloat(css.borderTopWidth),
            borderBottom: parseFloat(css.borderBottomWidth),
            insHeight: ins ? ins.getBoundingClientRect().height : null,
          }
        })
        window.__adFrames.push({
          at,
          phase: window.__adPhase,
          afterY,
          shift: window.__adShift ?? 0,
          slots,
        })
      }
      requestAnimationFrame(record)
    }
    requestAnimationFrame(record)
  })
}

export async function markAdPhase(page: Page, phase: AdPhase): Promise<void> {
  await page.evaluate((value) => {
    window.__adPhase = value
  }, phase)
}

export async function readAdFrames(page: Page): Promise<AdFrame[]> {
  return page.evaluate(() =>
    window.__adFrames.map((frame) => ({
      ...frame,
      slots: frame.slots.map((slot) => ({ ...slot })),
      shift: (window.__adShifts ?? [])
        .filter((entry) => entry.at <= frame.at)
        .reduce((sum, entry) => sum + entry.value, 0),
    }))
  )
}
