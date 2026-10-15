import { expect, type BrowserContext, type Page, type Route } from '@playwright/test'

export interface FakeAdRequest {
  order: number
  slot: string
  format: string
}
export interface FakeAds {
  pushCount: number
  throwNext: boolean
  requests: FakeAdRequest[]
  resize(index: number, height: number): void
  fill(index: number, status: string, height?: number): void
}
declare global {
  interface Window {
    __fakeAds: FakeAds
    __fakeAdInstrumentationErrors: string[]
    __adShift: number
    __adShifts: Array<{ at: number; value: number }>
  }
}

// Indices address recorded requests, never an arbitrary/unrequested DOM element.
// This verifies the app's push intent, not Google's internal element selection.
const sdk = `(() => {
  const queued = window.adsbygoogle;
  const requested = new WeakSet();
  const targets = [];
  function instrumentationFailure(message) {
    window.__fakeAdInstrumentationErrors.push(message);
    throw new Error(message);
  }
  function target(index) {
    const ins = targets[index];
    if (!ins || !requested.has(ins) || !ins.isConnected)
      instrumentationFailure('Fake SDK cannot mutate an unrequested slot');
    return ins;
  }
  window.__fakeAds = { pushCount: 0, throwNext: false, requests: [],
    resize(index, height) {
      const ins = target(index);
      ins.style.height = height + 'px';
    },
    fill(index, status, height = 280) {
      const ins = target(index);
      ins.setAttribute('data-ad-status', status);
      if (status !== 'unfilled') {
        this.resize(index, height);
        ins.style.background = '#cbd5e1';
      }
    }
  };
  window.adsbygoogle = { loaded: true, push() {
    window.__fakeAds.pushCount++;
    const events = window.__ilsangkitAdDebug?.snapshot() ?? [];
    const event = [...events].reverse().find((entry) => entry.kind === 'push-attempt');
    const ins = event?.order
      ? document.querySelectorAll('.ad-banner ins.adsbygoogle')[event.order - 1]
      : null;
    if (!ins) instrumentationFailure('Fake SDK cannot identify the requested slot');
    if (requested.has(ins)) instrumentationFailure('Fake SDK received a repeated request');
    requested.add(ins);
    targets.push(ins);
    window.__fakeAds.requests.push({ order: event.order,
      slot: ins.getAttribute('data-ad-slot'), format: ins.getAttribute('data-ad-format') });
    if (window.__fakeAds.throwNext) {
      window.__fakeAds.throwNext = false;
      throw new TypeError('fake SDK failure');
    }
    ins.setAttribute('data-adsbygoogle-status', 'done');
  }};
  if (Array.isArray(queued)) queued.forEach(() => window.adsbygoogle.push({}));
})()`

export async function installFakeAdSdk(
  context: BrowserContext,
  options: { hold?: boolean; failAfterMs?: number } = {}
) {
  let attempts = 0
  const pending: Route[] = []
  const blocked: string[] = []
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url())
    if (
      url.hostname === 'pagead2.googlesyndication.com' &&
      url.pathname === '/pagead/js/adsbygoogle.js'
    ) {
      attempts++
      if (options.failAfterMs !== undefined) {
        if (options.failAfterMs > 0)
          await new Promise((resolve) => setTimeout(resolve, options.failAfterMs))
        await route.abort('failed')
      } else if (options.hold) pending.push(route)
      else await route.fulfill({ contentType: 'application/javascript', body: sdk })
    } else if (url.origin === 'http://127.0.0.1:13010') await route.continue()
    else {
      blocked.push(url.origin)
      await route.abort()
    }
  })
  await context.addInitScript(() => {
    sessionStorage.setItem('ads:debug', '1')
    window.__fakeAdInstrumentationErrors = []
    window.__adShift = 0
    window.__adShifts = []
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as Array<
        PerformanceEntry & { hadRecentInput: boolean; value: number }
      >) {
        if (!entry.hadRecentInput) {
          window.__adShift += entry.value
          window.__adShifts.push({ at: entry.startTime, value: entry.value })
        }
      }
    }).observe({ type: 'layout-shift', buffered: true })
  })
  return {
    get attempts() {
      return attempts
    },
    get pending() {
      return pending.length
    },
    blocked,
    async releaseSdk() {
      await pending.shift()?.fulfill({ contentType: 'application/javascript', body: sdk })
    },
    async failSdk() {
      await pending.shift()?.abort('failed')
    },
  }
}

export async function assertNoFakeAdInstrumentationErrors(page: Page) {
  const errors = await page.evaluate(() => window.__fakeAdInstrumentationErrors)
  expect(errors, 'fake SDK instrumentation errors').toEqual([])
}
