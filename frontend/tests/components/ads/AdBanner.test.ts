import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { cloneVNode, defineComponent, h as vnode, nextTick, onMounted, shallowRef } from 'vue'
import { mountAdHarness, setupAdEnvironment, deferredClientOnlyStub } from '../../helpers/adHarness'
import AdBanner, { AD_SLOT_MOBILE, AD_SLOT_DESKTOP } from '~/components/ads/AdBanner.vue'
import { useAdSenseRuntime } from '~/composables/useAdSenseRuntime'
import type { AdLoaderState } from '~/composables/useAdSenseRuntime'
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

describe('opt-in mobile 320x100 slot', () => {
  const fixedProps = { variant: 'mobile-banner-320x100', only: 'mobile' }

  it.each([320, 321])('preserves requested or SDK width %spx through Nuxt ClientOnly cloning', async (width) => {
    // Nuxt ClientOnly clones its single child with attrs, normalizing style
    // strings into objects. The default delayed harness intentionally omits it.
    const ClientOnly = defineComponent({
      inheritAttrs: false,
      setup(_, { slots, attrs }) {
        const mounted = shallowRef(false)
        onMounted(() => {
          mounted.value = true
        })
        return () => {
          if (!mounted.value) return null
          const children = slots.default?.()
          const child = children?.[0]
          return children?.length === 1 && child ? [cloneVNode(child, attrs)] : children
        }
      },
    })
    const env = setupAdEnvironment({ width: 353 })
    const loader = useState<AdLoaderState>('ads:loader', () => ({ phase: 'loading', attempts: 1 }))
    const host = document.createElement('div')
    document.body.appendChild(host)
    const wrapper = mount(AdBanner, {
      attachTo: host,
      props: { variant: 'mobile-banner-320x100', only: 'mobile' },
      global: { stubs: { AdBanner: false, ClientOnly } },
    })
    h = {
      ...env,
      loader,
      wrapper,
      dispose() {
        wrapper.unmount()
        host.remove()
        env.dispose()
      },
    }
    await h.flush()
    const ins = wrapper.get('ins').element as HTMLElement
    expect(ins.style.height).toBe('')
    const seen: Array<[string, string]> = []
    h.push.mockImplementation(() => {
      seen.push([ins.style.width, ins.style.height])
      ins.style.height = '120px'
      if (width === 321) ins.style.width = '321px'
    })
    loader.value = { phase: 'ready', attempts: 1 }
    await h.flush()
    expect(seen).toEqual([['320px', '100px']])
    expect(ins.style.width).toBe(`${width}px`)
    expect(ins.style.height).toBe('120px')
    h.setRenderedHeight(ins, 120)
    h.triggerResize()
    await status('filled')
    h.setWidth(400)
    h.triggerResize()
    await h.flush()
    expect(wrapper.get('ins').element).toBe(ins)
    expect(ins.style.width).toBe(`${width}px`)
    expect(ins.style.height).toBe('120px')
    expect(h.push).toHaveBeenCalledTimes(1)
  })

  it('applies fixed dimensions only immediately before push and preserves synchronous SDK writes', async () => {
    h = mountAdHarness({ width: 353, loaderPhase: 'loading', props: fixedProps })
    await h.flush()
    const ins = h.wrapper.get('ins').element as HTMLElement
    expect(ins.style.height).toBe('')
    // Initial full width comes from CSS; Vue must not own fixed inline sizing.
    expect(ins.style.width).toBe('')
    expect(h.push).not.toHaveBeenCalled()
    const seen: Array<[string, string, string | null, string | null]> = []
    h.push.mockImplementation(() => {
      seen.push([ins.style.width, ins.style.height,
        ins.getAttribute('data-ad-format'), ins.getAttribute('data-full-width-responsive')])
      ins.style.height = '120px'
      ins.style.width = '321px'
    })
    h.loader.value = { phase: 'ready', attempts: 1 }
    await h.flush()
    expect(seen).toEqual([['320px', '100px', null, null]])
    expect(ins.style.height).toBe('120px')
    expect(ins.style.width).toBe('321px')
    expect(ins.style.marginInline).toBe('auto')
    expect(ins.getAttribute('data-ad-slot')).toBe(AD_SLOT_MOBILE)
    h.setRenderedHeight(ins, 120)
    h.triggerResize()
    await status('filled')
    h.setWidth(400)
    h.triggerResize()
    await h.flush()
    expect(ins.style.height).toBe('120px')
    expect(ins.style.width).toBe('321px')
    expect(h.push).toHaveBeenCalledTimes(1)
  })

  it.each([{ near: false }, { visible: false }, { width: 319 }])(
    'reserves no height or request while eligibility is missing: %j', async (options) => {
      h = mountAdHarness({ ...options, props: fixedProps })
      await h.flush()
      expect(h.push).not.toHaveBeenCalled()
      const ins = h.wrapper.find('ins')
      if (ins.exists()) expect((ins.element as HTMLElement).style.height).toBe('')
      expect(h.wrapper.classes()).toContain('ad-banner--empty')
      expect(collapsed()).toBe(false)
    }
  )

  it('keeps the narrow host observable and creates a fresh generation after width recovery', async () => {
    h = mountAdHarness({ width: 319, props: fixedProps })
    await h.flush()
    const host = h.wrapper.element as HTMLElement
    expect(h.wrapper.find('ins').exists()).toBe(false)
    expect(h.observers.some(({ elements }) => elements.has(host))).toBe(true)
    expect(h.push).not.toHaveBeenCalled()
    h.setWidth(320)
    h.triggerResize()
    await h.flush()
    const first = h.wrapper.get('ins').element as HTMLElement
    expect(h.push).toHaveBeenCalledTimes(1)
    const stale = h.observers.find(({ elements }) => elements.has(first))!
    h.setWidth(319)
    h.triggerResize()
    await h.flush()
    expect(h.wrapper.element).toBe(host)
    expect(h.wrapper.find('ins').exists()).toBe(false)
    expect(h.wrapper.classes()).toContain('ad-banner--empty')
    h.setWidth(320)
    h.triggerResize()
    await h.flush()
    const second = h.wrapper.get('ins').element
    expect(second).not.toBe(first)
    expect(h.push).toHaveBeenCalledTimes(2)
    first.dataset.adStatus = 'unfilled'
    stale.callback([], {} as ResizeObserver)
    await settle()
    expect(collapsed()).toBe(false)
    expect(h.wrapper.get('ins').element).toBe(second)
    expect(h.push).toHaveBeenCalledTimes(2)
  })

  it('measures host content width including padding and recovers at exactly 320', async () => {
    h = mountAdHarness({ loaderPhase: 'loading', props: fixedProps })
    await h.flush()
    const host = h.wrapper.element as HTMLElement
    host.style.paddingLeft = '10px'
    host.style.paddingRight = '10px'
    host.style.borderLeft = '1px solid black'
    host.style.borderRight = '1px solid black'
    h.setElementWidth(host, 341.75)
    h.triggerResize()
    await h.flush()
    expect(h.wrapper.find('ins').exists()).toBe(false)
    h.loader.value = { phase: 'ready', attempts: 1 }
    await h.flush()
    expect(h.push).not.toHaveBeenCalled()
    h.setElementWidth(host, 342)
    h.triggerResize()
    await h.flush()
    expect(h.wrapper.get('ins').element.style.height).toBe('100px')
    expect(h.push).toHaveBeenCalledTimes(1)
  })

  it('rechecks content width when SDK becomes ready before a host resize callback', async () => {
    h = mountAdHarness({ width: 353, loaderPhase: 'loading', props: fixedProps })
    await h.flush()
    const ins = h.wrapper.get('ins').element as HTMLElement
    h.setElementWidth(h.wrapper.element as HTMLElement, 319)
    h.loader.value = { phase: 'ready', attempts: 1 }
    await h.flush()
    expect(h.push).not.toHaveBeenCalled()
    expect(ins.style.height).toBe('')
    h.triggerResize()
    await h.flush()
    expect(h.wrapper.find('ins').exists()).toBe(false)
    h.setElementWidth(h.wrapper.element as HTMLElement, 320)
    h.triggerResize()
    await h.flush()
    expect(h.wrapper.get('ins').element).not.toBe(ins)
    expect(h.push).toHaveBeenCalledTimes(1)
  })

  it('keeps the same mobile element across sufficient widths, but replaces it after desktop', async () => {
    h = mountAdHarness({ width: 353, props: { variant: 'mobile-banner-320x100' } })
    await h.flush()
    const first = h.wrapper.get('ins').element
    const oldHost = h.wrapper.element
    const stale = h.observers.find(({ elements }) => elements.has(oldHost))!
    h.setWidth(400)
    h.triggerResize()
    h.resize(false)
    await h.flush()
    expect(h.wrapper.get('ins').element).toBe(first)
    expect(h.push).toHaveBeenCalledTimes(1)
    h.resize(true)
    await h.flush()
    expect(h.wrapper.find('ins').exists()).toBe(false)
    expect(stale.elements.size).toBe(0)
    h.resize(false)
    await h.flush()
    expect(h.wrapper.get('ins').element).not.toBe(first)
    expect(h.push).toHaveBeenCalledTimes(2)
    h.setElementWidth(oldHost as HTMLElement, 0)
    stale.callback([], {} as ResizeObserver)
    await h.flush()
    expect(h.wrapper.find('ins').exists()).toBe(true)
  })

  it.each([undefined, 'mobile', 'desktop'])(
    'never renders the fixed variant on desktop with only=%s', async (only) => {
      h = mountAdHarness({ desktop: true, props: { variant: 'mobile-banner-320x100', only } })
      await h.flush()
      expect(h.wrapper.find('ins').exists()).toBe(false)
      expect(h.push).not.toHaveBeenCalled()
    }
  )

  it('rejects contradictory only=desktop on mobile too', async () => {
    h = mountAdHarness({ props: { variant: 'mobile-banner-320x100', only: 'desktop' } })
    await h.flush()
    expect(h.wrapper.find('ins').exists()).toBe(false)
    expect(h.push).not.toHaveBeenCalled()
  })

  it('omits responsive format attributes despite explicit props and keeps custom slot frozen', async () => {
    h = mountAdHarness({ props: { ...fixedProps, adSlot: 'custom-fixed', adFormat: 'rectangle', fullWidthResponsive: 'true' } })
    await h.flush()
    const ins = h.wrapper.get('ins')
    expect(ins.attributes('data-ad-slot')).toBe('custom-fixed')
    expect(ins.attributes('data-ad-format')).toBeUndefined()
    expect(ins.attributes('data-full-width-responsive')).toBeUndefined()
    expect(h.wrapper.classes()).toContain('ad-banner--mobile-banner-320x100')
    expect(h.wrapper.classes()).not.toContain('ad-banner--undefined')
    expect(h.wrapper.html()).not.toMatch(/(?:data-ad-format|data-full-width-responsive)="(?:null|undefined)"/)
    await h.wrapper.setProps({ adSlot: 'later', adFormat: 'vertical', fullWidthResponsive: 'false' })
    expect(ins.attributes('data-ad-slot')).toBe('custom-fixed')
    expect(ins.attributes('data-ad-format')).toBeUndefined()
    expect(ins.attributes('data-full-width-responsive')).toBeUndefined()
    expect(h.push).toHaveBeenCalledTimes(1)
  })

  it('does not collapse after ten seconds without status or after unknown and optimized status', async () => {
    vi.useFakeTimers()
    h = mountAdHarness({ props: fixedProps })
    await h.flush()
    const ins = h.wrapper.get('ins').element
    await vi.advanceTimersByTimeAsync(10000)
    await h.flush()
    expect(collapsed()).toBe(false)
    for (const value of ['future-status', 'unfill-optimized']) {
      ins.setAttribute('data-ad-status', value)
      await vi.advanceTimersByTimeAsync(1)
      await h.flush()
      expect(collapsed()).toBe(false)
    }
    expect(h.wrapper.get('ins').element).toBe(ins)
    expect(h.push).toHaveBeenCalledTimes(1)
  })

  it('attempts a throwing SDK push once without collapsing', async () => {
    h = mountAdHarness({ loaderPhase: 'loading', props: fixedProps })
    await h.flush()
    h.push.mockImplementation(() => { throw new Error('SDK failure') })
    h.loader.value = { phase: 'ready', attempts: 1 }
    await h.flush()
    h.triggerResize()
    h.setVisibility('visible')
    await status('filled')
    expect(collapsed()).toBe(false)
    expect(h.push).toHaveBeenCalledTimes(1)
    expect(h.wrapper.get('ins').element.style.height).toBe('100px')
  })

  it('collapses only explicit failure states and restores filled on the same element', async () => {
    h = mountAdHarness({ loaderPhase: 'error', props: fixedProps })
    await h.flush()
    const ins = h.wrapper.get('ins').element as HTMLElement
    expect(collapsed()).toBe(true)
    expect(ins.style.height).toBe('')
    h.loader.value = { phase: 'ready', attempts: 2 }
    await h.flush()
    expect(collapsed()).toBe(false)
    await status('unfilled')
    expect(collapsed()).toBe(true)
    await status('filled')
    expect(collapsed()).toBe(false)
    ins.style.display = 'none'
    await settle()
    expect(collapsed()).toBe(true)
    ins.style.display = 'block'
    await settle()
    expect(collapsed()).toBe(false)
    expect(h.wrapper.get('ins').element).toBe(ins)
    expect(h.push).toHaveBeenCalledTimes(1)
  })

  it.each(['disabled', 'suppressed', 'bot', 'excluded'])('blocks %s policy before a fixed request', async (policy) => {
    if (policy === 'disabled') vi.stubGlobal('useRuntimeConfig', () => ({ public: { adsEnabled: false } }))
    if (policy === 'bot') vi.stubGlobal('navigator', { userAgent: 'Googlebot', webdriver: false })
    h = mountAdHarness({ loaderPhase: 'loading', path: policy === 'excluded' ? '/real-estate' : undefined, props: fixedProps })
    await h.flush()
    if (policy === 'suppressed') useState('ads:suppressed', () => false).value = true
    h.loader.value = { phase: 'ready', attempts: 1 }
    await h.flush()
    expect(h.wrapper.find('ins').exists()).toBe(false)
    expect(h.push).not.toHaveBeenCalled()
  })

  it('preserves element and acquired proximity on rapid routes, replacing only on admitted navigation', async () => {
    let now = 0
    vi.spyOn(performance, 'now').mockImplementation(() => now)
    h = mountAdHarness({ loaderPhase: 'loading', near: false, props: fixedProps })
    await h.flush()
    const first = h.wrapper.get('ins').element as HTMLElement
    h.enterViewport()
    await h.flush()
    h.leaveViewport()
    now = 100
    h.route.path = '/guide/rapid-fixed'
    await h.flush()
    expect(h.wrapper.get('ins').element).toBe(first)
    expect(first.style.height).toBe('')
    h.loader.value = { phase: 'ready', attempts: 1 }
    await h.flush()
    expect(h.push).toHaveBeenCalledTimes(1)
    now = 2000
    h.route.path = '/guide/later-fixed'
    await h.flush()
    const second = h.wrapper.get('ins').element as HTMLElement
    expect(second).not.toBe(first)
    expect(second.style.height).toBe('')
    expect(h.push).toHaveBeenCalledTimes(1)
    h.enterViewport()
    await h.flush()
    expect(second.style.height).toBe('100px')
    expect(h.push).toHaveBeenCalledTimes(2)
  })

  it('recovers a narrow host without ResizeObserver and removes fallback listeners on unmount', async () => {
    // The harness installs its controlled observer, so disable it after mounting
    // but before the post-flush host watcher creates an observer.
    h = mountAdHarness({ width: 319, props: fixedProps })
    vi.stubGlobal('ResizeObserver', undefined)
    const add = vi.spyOn(window, 'addEventListener')
    const remove = vi.spyOn(window, 'removeEventListener')
    await h.flush()
    expect(h.wrapper.find('ins').exists()).toBe(false)
    const hostListener = add.mock.calls.find(([type]) => String(type) === 'resize')?.[1]
    expect(hostListener).toBeTypeOf('function')
    h.setWidth(320)
    window.dispatchEvent(new Event('resize'))
    await h.flush()
    expect(h.push).toHaveBeenCalledTimes(1)
    h.wrapper.unmount()
    expect(remove).toHaveBeenCalledWith('resize', hostListener)
    h.setWidth(319)
    window.dispatchEvent(new Event('resize'))
    await h.flush()
    expect(h.push).toHaveBeenCalledTimes(1)
  })

  it('ignores disconnected host callbacks and cleans up every observer on unmount', async () => {
    h = mountAdHarness({ width: 319, props: fixedProps })
    await h.flush()
    const host = h.wrapper.element as HTMLElement
    host.remove()
    h.setWidth(320)
    h.triggerResize()
    await h.flush()
    expect(h.wrapper.find('ins').exists()).toBe(false)
    expect(h.push).not.toHaveBeenCalled()
    h.wrapper.unmount()
    expect(h.observers.every(({ elements }) => elements.size === 0)).toBe(true)
    expect(h.intersections.every(({ elements }) => elements.size === 0)).toBe(true)
  })
})

describe('SDK first-available selection across owned slots', () => {
  it.each(['near', 'width', 'display', 'visible', 'throw'] as const)(
    'keeps intent and actual consumption aligned with a pending header (%s)',
    async (gate) => {
      const env = setupAdEnvironment({ near: false, visible: gate !== 'visible' })
      sessionStorage.setItem('ads:debug', '1')
      useAdSenseRuntime().initializeDebug()
      const loader = useState('ads:loader', () => ({ phase: 'loading', attempts: 1 }))
      const host = document.createElement('div')
      document.body.appendChild(host)
      const group = mount(
        () => vnode('div', [
          vnode(AdBanner, { variant: 'mobile-banner-320x100' }),
          vnode(AdBanner),
          vnode(AdBanner),
        ]),
        {
          attachTo: host,
          global: { stubs: { AdBanner: false, ClientOnly: deferredClientOnlyStub } },
        }
      )
      try {
        await env.flush()
        const slots = Array.from(host.querySelectorAll<HTMLElement>('ins'))
        const hosts = Array.from(host.querySelectorAll<HTMLElement>('.ad-banner'))
        expect(slots).toHaveLength(3)
        const consumed: Array<{ order: number; intended: number; width: string; height: string }> =
          []
        env.push.mockImplementation(() => {
          // Same class/status/DOM-order predicate as the fetched SDK's au/bu.
          const actual = Array.from(document.getElementsByTagName('ins')).find(
            (el) =>
              /(^| )adsbygoogle($| )/.test(el.className) &&
              !['done', 'reserved'].includes(el.dataset.adsbygoogleStatus ?? '')
          )!
          const intent = window
            .__ilsangkitAdDebug!.snapshot()
            .filter((e) => e.kind === 'push-attempt')
            .at(-1)!
          consumed.push({
            order: slots.indexOf(actual) + 1,
            intended: intent.order ?? 0,
            width: actual.style.width,
            height: actual.style.height,
          })
          if (gate === 'throw' && consumed.length === 1) throw new TypeError('before SDK done')
          actual.dataset.adsbygoogleStatus = 'done'
          actual.classList.add('sdk-owned')
          actual.style.height = '120px'
        })
        if (gate === 'width') env.setElementWidth(hosts[0], 319)
        if (gate === 'display') slots[0].style.display = 'none'
        loader.value = { phase: 'ready', attempts: 1 }
        await env.flush()
        env.enterViewport(hosts[1])
        if (gate !== 'near') env.enterViewport(hosts[0])
        await env.flush()
        if (gate === 'visible') {
          expect(consumed).toEqual([])
          expect(slots[0].style.height).toBe('')
          // Both qualified, but make the header ineligible before visibility returns.
          slots[0].style.display = 'none'
          env.setVisibility('visible')
          await env.flush()
        }
        // Body must progress even though an earlier header and a later body are unprocessed.
        if (gate !== 'throw') {
          expect(consumed.map((r) => [r.intended, r.order])).toEqual([[2, 2]])
          expect(slots[0].style.height).toBe('')
          expect(slots[0].getAttribute('data-adsbygoogle-status')).toBeNull()
        }
        env.setElementWidth(hosts[0], 353)
        slots[0].style.display = 'block'
        env.triggerResize()
        env.enterViewport(hosts[0])
        await env.flush()
        const headerRequest = consumed.find((r) => r.order === 1)!
        expect(headerRequest).toMatchObject({ intended: 1, width: '320px', height: '100px' })
        if (gate !== 'throw') expect(consumed.map((r) => r.order)).toEqual([2, 1])
        env.enterViewport(hosts[2])
        await env.flush()
        expect(consumed).toHaveLength(3)
        expect(consumed.every((r) => r.order === r.intended)).toBe(true)
        expect(new Set(consumed.map((r) => r.order)).size).toBe(3)
        const events = window.__ilsangkitAdDebug!.snapshot()
        expect(events.filter((e) => e.kind === 'push-attempt').map((e) => e.order)).toEqual(
          consumed.map((r) => r.order)
        )
        expect(events.filter((e) => e.kind === 'push-error')).toHaveLength(gate === 'throw' ? 1 : 0)
        if (gate === 'throw') {
          const failed = slots[consumed[0].order - 1]
          expect(failed.getAttribute('data-adsbygoogle-status')).toBeNull()
        }
        for (const slot of slots) {
          expect(slot.classList.contains('adsbygoogle')).toBe(true)
          if (slot.dataset.adsbygoogleStatus === 'done') {
            expect(slot.classList.contains('sdk-owned')).toBe(true)
            expect(slot.style.height).toBe('120px')
          }
        }
        env.triggerResize()
        env.setVisibility('visible')
        await env.flush()
        expect(consumed).toHaveLength(3)
      } finally {
        group.unmount()
        host.remove()
        env.dispose()
      }
    }
  )
})
