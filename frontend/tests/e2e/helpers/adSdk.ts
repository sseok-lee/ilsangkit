import type { BrowserContext, Route } from '@playwright/test'

export interface FakeAds {
  pushCount: number
  throwNext: boolean
  fill(index: number, status: string, height?: number): void
}
declare global {
  interface Window {
    __fakeAds: FakeAds
    __adShift: number
  }
}

const sdk = `(() => {
  const queued = window.adsbygoogle;
  window.__fakeAds = { pushCount: 0, throwNext: false, fill(index, status, height = 280) {
    const ins = document.querySelectorAll('.ad-banner ins.adsbygoogle')[index];
    ins.setAttribute('data-ad-status', status);
    if (status === 'filled' || status === 'unfill-optimized') { ins.style.height = height + 'px'; ins.style.background = '#cbd5e1'; }
  }};
  window.adsbygoogle = { loaded: true, push() {
    window.__fakeAds.pushCount++;
    if (window.__fakeAds.throwNext) throw new TypeError('fake SDK failure');
    const ins = document.querySelector('.ad-banner ins.adsbygoogle:not([data-adsbygoogle-status])');
    if (ins) ins.setAttribute('data-adsbygoogle-status', 'done');
  }};
  if (Array.isArray(queued)) queued.forEach(() => window.adsbygoogle.push({}));
})()`

export async function installFakeAdSdk(context: BrowserContext, options: { hold?: boolean } = {}) {
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
      if (options.hold) pending.push(route)
      else await route.fulfill({ contentType: 'application/javascript', body: sdk })
    } else if (url.origin === 'http://127.0.0.1:13010') await route.continue()
    else {
      blocked.push(url.origin)
      await route.abort()
    }
  })
  await context.addInitScript(() => {
    window.__adShift = 0
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as Array<
        PerformanceEntry & { hadRecentInput: boolean; value: number }
      >) {
        if (!entry.hadRecentInput) window.__adShift += entry.value
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
