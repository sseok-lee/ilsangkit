import { onBeforeUnmount, onMounted, type Ref } from 'vue'

/*
 * 진단 instrumentation. 광고 push 라이프사이클에서 다음 stage 분포를 GA4 custom event 로 수집:
 *  A: window.adsbygoogle 미정의 (script 미로드)
 *  B: container 내 ins.adsbygoogle 미발견 (ClientOnly race)
 *  C: push 호출되었으나 RESPONSE_TIMEOUT_MS 내 data-ad-status 미설정
 *  D: data-ad-status='unfilled'
 *  E: data-ad-status='filled' (정상)
 * "빈 박스 예약 공간만 남는" 증상의 원인 stage 가 A/B/C 중 어디인지 판별 후 회수 예정.
 */
const RESPONSE_TIMEOUT_MS = 10_000
const EVENT_PREFIX = 'adsense_diag_'

type EventName =
  | 'init'
  | 'script_check'
  | 'container_check'
  | 'push_called'
  | 'status_observed'
  | 'render_check'

type EventPayload = Record<string, string | number | boolean | undefined>

type GtagFn = (command: 'event', eventName: string, params: EventPayload) => void

function emit(name: EventName, payload: EventPayload) {
  if (!import.meta.client) return
  try {
    const gtag = (window as unknown as { gtag?: GtagFn }).gtag
    if (typeof gtag !== 'function') return
    gtag('event', `${EVENT_PREFIX}${name}`, payload)
  } catch {
    // 진단용 dispatch 실패는 광고 동작에 영향 주지 않도록 silent.
  }
}

let instanceCounter = 0

export interface AdDiagnosticsOptions {
  slot: string
  format: string
  routePath: string
  surface: 'inline' | 'anchor'
}

export interface AdDiagnosticsApi {
  recordScriptCheck: (present: boolean) => void
  recordContainerCheck: (present: boolean) => void
  recordPushCalled: () => void
}

export function useAdDiagnostics(
  container: Ref<HTMLElement | null>,
  options: AdDiagnosticsOptions,
): AdDiagnosticsApi {
  const instanceIndex = ++instanceCounter
  const device: 'mobile' | 'desktop' =
    import.meta.client && typeof window !== 'undefined' && window.innerWidth < 768 ? 'mobile' : 'desktop'

  const baseDims = (): EventPayload => ({
    ad_slot: options.slot,
    ad_format: options.format,
    surface: options.surface,
    route_path: options.routePath,
    instance_index: instanceIndex,
    device,
  })

  let observer: MutationObserver | null = null
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  let statusObservedFor: string | null = null
  let pushedAt: number | null = null

  function teardown() {
    if (observer) {
      observer.disconnect()
      observer = null
    }
    if (timeoutId !== null) {
      clearTimeout(timeoutId)
      timeoutId = null
    }
  }

  function observeStatus(ins: HTMLElement) {
    if (statusObservedFor === options.slot && observer) return
    teardown()
    statusObservedFor = options.slot

    const handle = (status: string) => {
      emit('status_observed', {
        ...baseDims(),
        status,
        elapsed_ms: pushedAt !== null ? Date.now() - pushedAt : -1,
      })
      teardown()
    }

    observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === 'attributes' && m.attributeName === 'data-ad-status') {
          const status = ins.getAttribute('data-ad-status') || ''
          if (status) {
            handle(status)
            return
          }
        }
      }
    })
    observer.observe(ins, { attributes: true, attributeFilter: ['data-ad-status'] })

    timeoutId = setTimeout(() => {
      const finalStatus = ins.getAttribute('data-ad-status') || ''
      if (finalStatus) {
        handle(finalStatus)
      } else {
        emit('status_observed', {
          ...baseDims(),
          status: 'no_response',
          elapsed_ms: pushedAt !== null ? Date.now() - pushedAt : -1,
        })
        teardown()
      }
    }, RESPONSE_TIMEOUT_MS)
  }

  onMounted(() => {
    if (!import.meta.client) return
    emit('init', baseDims())
  })

  onBeforeUnmount(() => {
    if (!import.meta.client) return
    const ins = container.value?.querySelector('ins.adsbygoogle') as HTMLElement | null
    emit('render_check', {
      ...baseDims(),
      final_status: ins?.getAttribute('data-ad-status') || 'none',
      ins_present: !!ins,
    })
    teardown()
  })

  return {
    recordScriptCheck(present: boolean) {
      emit('script_check', { ...baseDims(), adsbygoogle_defined: present })
    },
    recordContainerCheck(present: boolean) {
      emit('container_check', { ...baseDims(), ins_in_dom: present })
      if (present) {
        const ins = container.value?.querySelector('ins.adsbygoogle') as HTMLElement | null
        if (ins) observeStatus(ins)
      }
    },
    recordPushCalled() {
      pushedAt = Date.now()
      emit('push_called', baseDims())
    },
  }
}
