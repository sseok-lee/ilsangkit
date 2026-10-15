import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { mountAdHarness } from '../../helpers/adHarness'
import { AD_SLOT_MOBILE, AD_SLOT_DESKTOP } from '~/components/ads/AdBanner.vue'
let h: ReturnType<typeof mountAdHarness> | undefined
async function settle() {
  await new Promise((resolve) => setTimeout(resolve, 0))
  await h!.flush()
}
async function status(value: string) {
  h!.wrapper.get('ins').element.setAttribute('data-ad-status', value)
  await settle()
}
const collapsed = () => h!.wrapper.classes().includes('ad-banner--collapsed')
afterEach(() => {
  h?.dispose()
  h = undefined
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('manual ad slot lifecycle', () => {
  it('requests a connected ClientOnly slot when SDK becomes ready, never on a timeout', async () => {
    vi.useFakeTimers()
    h = mountAdHarness({ loaderPhase: 'loading' })
    await h.flush()
    await vi.advanceTimersByTimeAsync(5000)
    expect(h.push).not.toHaveBeenCalled()
    expect(collapsed()).toBe(false)
    h.loader.value = { phase: 'ready', attempts: 1 }
    await h.flush()
    expect(h.push).toHaveBeenCalledTimes(1)
    const ins = h.wrapper.get('ins').element
    await vi.advanceTimersByTimeAsync(10000)
    await h.flush()
    expect(collapsed()).toBe(false)
    expect(h.wrapper.get('ins').element).toBe(ins)
    ins.setAttribute('data-ad-status', 'filled')
    await vi.advanceTimersByTimeAsync(1)
    await h.flush()
    expect(collapsed()).toBe(false)
    expect(h.push).toHaveBeenCalledTimes(1)
    expect(h.wrapper.find('.ad-banner__label').exists()).toBe(false)
  })
  it('collapses unfilled and restores late filled on the same element', async () => {
    h = mountAdHarness()
    await h.flush()
    await status('unfilled')
    expect(collapsed()).toBe(true)
    await status('filled')
    expect(collapsed()).toBe(false)
    expect(h.push).toHaveBeenCalledTimes(1)
  })
  it.each(['unfill-optimized', 'future-status'])(
    'preserves %s and records its status',
    async (value) => {
      h = mountAdHarness()
      await h.flush()
      await status(value)
      expect(collapsed()).toBe(false)
      expect(h.wrapper.get('ins').attributes('data-ad-status')).toBe(value)
    }
  )
  it('collapses loader errors, then restores the same unrequested slot for retry', async () => {
    h = mountAdHarness({ loaderPhase: 'error' })
    await h.flush()
    expect(collapsed()).toBe(true)
    const ins = h.wrapper.get('ins').element
    h.loader.value = { phase: 'loading', attempts: 2 }
    await h.flush()
    expect(collapsed()).toBe(false)
    h.loader.value = { phase: 'ready', attempts: 2 }
    await h.flush()
    expect(h.wrapper.get('ins').element).toBe(ins)
    expect(h.push).toHaveBeenCalledTimes(1)
  })
  it('recovers external display hiding without duplicating a requested slot', async () => {
    h = mountAdHarness()
    await h.flush()
    const ins = h.wrapper.get('ins').element as HTMLElement
    ins.style.display = 'none'
    await settle()
    expect(collapsed()).toBe(true)
    ins.style.display = 'block'
    await settle()
    expect(collapsed()).toBe(false)
    expect(h.push).toHaveBeenCalledTimes(1)
  })
  it('requests an initially hidden slot once when it becomes visible', async () => {
    h = mountAdHarness({ loaderPhase: 'loading' })
    await h.flush()
    const ins = h.wrapper.get('ins').element as HTMLElement
    ins.style.display = 'none'
    await settle()
    h.loader.value = { phase: 'ready', attempts: 1 }
    await h.flush()
    expect(h.push).not.toHaveBeenCalled()
    ins.style.display = 'block'
    await settle()
    expect(h.push).toHaveBeenCalledTimes(1)
  })
  it('keeps a zero-height or visibility-hidden pending slot eligible', async () => {
    h = mountAdHarness({ loaderPhase: 'loading' })
    await h.flush()
    const ins = h.wrapper.get('ins').element as HTMLElement
    ins.style.height = '0px'
    ins.style.visibility = 'hidden'
    await settle()
    expect(collapsed()).toBe(false)
    h.loader.value = { phase: 'ready', attempts: 1 }
    await h.flush()
    expect(h.push).toHaveBeenCalledTimes(1)
  })
  it.each([false, true])(
    'uses device slot then freezes attributes across resize (%s)',
    async (desktop) => {
      h = mountAdHarness({ desktop })
      await h.flush()
      const ins = h.wrapper.get('ins').element
      expect(ins.getAttribute('data-ad-slot')).toBe(desktop ? AD_SLOT_DESKTOP : AD_SLOT_MOBILE)
      const attributes = h.wrapper.get('ins').attributes()
      h.resize(!desktop)
      await h.flush()
      expect(h.wrapper.get('ins').element).toBe(ins)
      expect(h.wrapper.get('ins').attributes()).toEqual(attributes)
      expect(h.push).toHaveBeenCalledTimes(1)
    }
  )
  it.each([false, true])('uses viewport default without reserved size (%s)', async (desktop) => {
    h = mountAdHarness({ desktop })
    await h.flush()
    const ins = h.wrapper.get('ins')
    expect(ins.attributes('data-ad-format')).toBe(desktop ? 'horizontal' : 'auto')
    expect(ins.attributes('style')).not.toMatch(/(?:^|;)\s*(?:height|min-height|max-height)\s*:/)
    expect(h.wrapper.attributes('style') ?? '').not.toContain('--ad-fixed-height')
    expect(h.wrapper.classes()).toContain('ad-banner--empty')
  })
  it.each(['auto', 'rectangle', 'horizontal', 'vertical'])(
    'honors explicit %s format on desktop and compact mobile',
    async (adFormat) => {
      h = mountAdHarness({
        desktop: true,
        loaderPhase: 'loading',
        props: { adFormat, variant: 'compact-mobile' },
      })
      await h.flush()
      expect(h.wrapper.get('ins').attributes('data-ad-format')).toBe(adFormat)
      h.resize(false)
      await h.flush()
      expect(h.wrapper.get('ins').attributes('data-ad-format')).toBe(adFormat)
    }
  )
  it('preserves explicit slot and full-width choice without reserving height', async () => {
    h = mountAdHarness({
      props: { adSlot: 'custom', adFormat: 'rectangle', fullWidthResponsive: 'false' },
    })
    await h.flush()
    const ins = h.wrapper.get('ins')
    expect(ins.attributes('data-ad-slot')).toBe('custom')
    expect(ins.attributes('data-full-width-responsive')).toBe('false')
    expect(ins.attributes('style')).not.toMatch(/(?:^|;)\s*(?:height|min-height|max-height)\s*:/)
  })
  it('keeps compact mobile width and format after a requested slot crosses the breakpoint', async () => {
    h = mountAdHarness({ props: { variant: 'compact-mobile' } })
    await h.flush()
    const ins = h.wrapper.get('ins')
    expect(ins.attributes('data-ad-format')).toBe('horizontal')
    expect(ins.attributes('data-full-width-responsive')).toBe('false')
    expect(ins.attributes('style')).toContain('max-width: 336px')
    expect(ins.attributes('style')).toContain('margin-inline: auto')
    expect(ins.attributes('style')).not.toMatch(/(?:^|;)\s*(?:height|min-height|max-height)\s*:/)
    const attributes = ins.attributes()
    h.resize(true)
    await h.flush()
    expect(h.wrapper.get('ins').attributes()).toEqual(attributes)
    expect(h.push).toHaveBeenCalledTimes(1)
  })
  it('uses the latest viewport format before requesting and freezes the rendered attributes', async () => {
    h = mountAdHarness({ loaderPhase: 'loading' })
    await h.flush()
    expect(h.wrapper.get('ins').attributes('data-ad-format')).toBe('auto')
    h.resize(true)
    await h.flush()
    expect(h.wrapper.get('ins').attributes('data-ad-format')).toBe('horizontal')
    expect(h.wrapper.get('ins').attributes('data-ad-slot')).toBe(AD_SLOT_DESKTOP)
    h.loader.value = { phase: 'ready', attempts: 1 }
    await h.flush()
    const attributes = h.wrapper.get('ins').attributes()
    h.resize(false)
    await h.flush()
    expect(h.wrapper.get('ins').attributes()).toEqual(attributes)
    expect(h.push).toHaveBeenCalledTimes(1)
  })
  it('admits SDK height before filled and clears only empty spacing', async () => {
    h = mountAdHarness()
    await h.flush()
    const ins = h.wrapper.get('ins').element as HTMLElement
    ins.style.height = '180px'
    h.setRenderedHeight(ins, 180)
    h.triggerResize()
    await h.flush()
    expect(ins.hasAttribute('data-ad-status')).toBe(false)
    expect(h.wrapper.classes()).not.toContain('ad-banner--empty')
    expect(collapsed()).toBe(false)
    expect(ins.style.height).toBe('180px')
    h.setRenderedHeight(ins, 0)
    h.triggerResize()
    await h.flush()
    expect(h.wrapper.classes()).toContain('ad-banner--empty')
    expect(collapsed()).toBe(false)
  })
  it('admits actual height while SDK is loading and resets height for a replacement element', async () => {
    const now = 2000
    vi.spyOn(performance, 'now').mockImplementation(() => now)
    h = mountAdHarness({ loaderPhase: 'loading' })
    await h.flush()
    const ins = h.wrapper.get('ins').element as HTMLElement
    h.setRenderedHeight(ins, 180)
    h.triggerResize()
    await h.flush()
    expect(h.wrapper.classes()).not.toContain('ad-banner--empty')
    expect(h.push).not.toHaveBeenCalled()
    h.route.path = '/guide/replacement'
    await h.flush()
    expect(h.wrapper.get('ins').element).not.toBe(ins)
    expect(h.wrapper.classes()).toContain('ad-banner--empty')
    h.setRenderedHeight(ins, 300)
    h.triggerResize()
    await h.flush()
    expect(h.wrapper.classes()).toContain('ad-banner--empty')
  })
  it('only gate creates a new element when matching again', async () => {
    h = mountAdHarness({ desktop: false, props: { only: 'desktop' } })
    await h.flush()
    expect(h.wrapper.find('ins').exists()).toBe(false)
    expect(h.push).not.toHaveBeenCalled()
    h.resize(true)
    await h.flush()
    expect(h.push).toHaveBeenCalledTimes(1)
    h.resize(false)
    await h.flush()
    h.resize(true)
    await h.flush()
    expect(h.push).toHaveBeenCalledTimes(2)
  })
  it('preserves pending work during rapid nav, but policy changes still dispose the slot', async () => {
    let now = 0
    vi.spyOn(performance, 'now').mockImplementation(() => now)
    h = mountAdHarness({ width: 0 })
    await h.flush()
    const ins = h.wrapper.get('ins').element
    now = 100
    h.route.path = '/guide/rapid'
    await h.flush()
    expect(h.wrapper.get('ins').element).toBe(ins)
    h.setWidth(353)
    h.triggerResize()
    await h.flush()
    expect(h.push).toHaveBeenCalledTimes(1)
    useState('ads:suppressed', () => false).value = true
    await h.flush()
    expect(h.wrapper.find('ins').exists()).toBe(false)
    useState('ads:suppressed', () => false).value = false
    await h.flush()
    expect(h.push).toHaveBeenCalledTimes(2)
    now = 2000
    h.route.path = '/guide/later'
    await h.flush()
    expect(h.push).toHaveBeenCalledTimes(3)
    ins.setAttribute('data-ad-status', 'unfilled')
    await settle()
    expect(collapsed()).toBe(false)
  })
  it('preserves proximity during rapid routes and requires it for a later replacement', async () => {
    let now = 0
    vi.spyOn(performance, 'now').mockImplementation(() => now)
    h = mountAdHarness({ loaderPhase: 'loading', near: false })
    await h.flush()
    const ins = h.wrapper.get('ins').element
    h.enterViewport()
    await h.flush()
    h.leaveViewport()
    now = 100
    h.route.path = '/guide/rapid-near'
    await h.flush()
    expect(h.wrapper.get('ins').element).toBe(ins)
    h.loader.value = { phase: 'ready', attempts: 1 }
    await h.flush()
    expect(h.push).toHaveBeenCalledTimes(1)
    now = 2000
    h.route.path = '/guide/later-far'
    await h.flush()
    expect(h.wrapper.get('ins').element).not.toBe(ins)
    expect(h.push).toHaveBeenCalledTimes(1)
    h.enterViewport()
    await h.flush()
    expect(h.push).toHaveBeenCalledTimes(2)
  })
  it('releases request observers after push while keeping status and size recovery active', async () => {
    const remove = vi.spyOn(document, 'removeEventListener')
    h = mountAdHarness({ visible: false, width: 0 })
    await h.flush()
    const ins = h.wrapper.get('ins').element as HTMLElement
    h.setWidth(353)
    h.triggerResize()
    await h.flush()
    expect(h.push).not.toHaveBeenCalled()
    h.setVisibility('visible')
    await h.flush()
    expect(h.push).toHaveBeenCalledTimes(1)
    expect(h.intersections.every(({ elements }) => elements.size === 0)).toBe(true)
    expect(h.observers.some(({ elements }) => elements.has(ins))).toBe(true)
    expect(h.observers.every(({ elements }) => !elements.has(h!.wrapper.element))).toBe(true)
    expect(remove.mock.calls.some(([type]) => type === 'visibilitychange')).toBe(true)
    await status('unfilled')
    expect(collapsed()).toBe(true)
    h.setRenderedHeight(ins, 180)
    await status('filled')
    expect(collapsed()).toBe(false)
    expect(h.wrapper.classes()).not.toContain('ad-banner--empty')
    ins.style.display = 'none'
    await settle()
    expect(collapsed()).toBe(true)
    ins.style.display = 'block'
    await settle()
    expect(collapsed()).toBe(false)
    expect(h.push).toHaveBeenCalledTimes(1)
  })
  it('cleans up observers and ignores a loader ready after unmount', async () => {
    h = mountAdHarness({ loaderPhase: 'loading' })
    await h.flush()
    h.wrapper.unmount()
    h.loader.value = { phase: 'ready', attempts: 1 }
    await nextTick()
    expect(h.push).not.toHaveBeenCalled()
    expect(h.observers.every((observer) => observer.elements.size === 0)).toBe(true)
  })
})

it('observes ClientOnly insertion later than ten ticks', async () => {
  h = mountAdHarness({ clientDelayTicks: 20 })
  await h.flush()
  expect(h.wrapper.find('ins').exists()).toBe(false)
  for (let i = 0; i < 25; i++) await nextTick()
  await h.flush()
  expect(h.push).toHaveBeenCalledTimes(1)
  await status('unfilled')
  expect(collapsed()).toBe(true)
  const ins = h.wrapper.get('ins').element as HTMLElement
  h.setRenderedHeight(ins, 180)
  await status('filled')
  expect(collapsed()).toBe(false)
  expect(h.wrapper.classes()).not.toContain('ad-banner--empty')
})
it('preserves synchronous SDK styles after locking rendered attributes', async () => {
  h = mountAdHarness()
  h.push.mockImplementation(() => {
    ;(h!.wrapper.get('ins').element as HTMLElement).style.height = '280px'
  })
  await h.flush()
  const ins = h.wrapper.get('ins').element as HTMLElement
  expect(ins.style.height).toBe('280px')
  h.setRenderedHeight(ins, 280)
  h.triggerResize()
  h.resize(true)
  await h.flush()
  expect(ins.style.height).toBe('280px')
  expect(h.wrapper.classes()).not.toContain('ad-banner--empty')
  const events = window.__ilsangkitAdDebug!.snapshot()
  expect(
    events.some((event) => event.kind === 'push-returned' && event.pageType === 'guide-detail')
  ).toBe(true)
})
