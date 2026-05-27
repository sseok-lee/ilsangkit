import { expect, test } from '@playwright/test'

// API에서 실제 parking 시설 1건 ID를 얻어 deterministic 테스트.
// 시드 데이터에 의존하지 않고, 현재 DB에서 좌표가 유효한 첫 시설을 사용.
const BACKEND_BASE = process.env.API_BASE ?? 'http://localhost:8000'

async function getParkingId(request: import('@playwright/test').APIRequestContext) {
  // 백엔드 리스트 API는 POST /api/facilities/search 형태.
  const res = await request.post(`${BACKEND_BASE}/api/facilities/search`, {
    data: { category: 'parking', city: '서울', limit: 5 },
  })
  if (!res.ok()) throw new Error(`parking 시설 조회 실패: ${res.status()}`)
  const body = await res.json() as {
    success: boolean
    data: { items: { id: string; lat: number; lng: number }[] }
  }
  const items = body?.data?.items ?? []
  // 좌표가 유효한 첫 시설 (lat=0, lng=0 데이터 회피)
  const first = items.find((i) => i.lat && i.lng) ?? items[0]
  if (!first?.id) throw new Error('parking 시설이 DB에 없습니다 (시드 또는 sync 필요)')
  return first.id
}

// 임계 0.15는 dev `data-adtest="on"` 환경의 현실을 반영한 catastrophic-regression 가드.
// 본 Phase 1 작업으로 fixed 4 슬롯의 shift는 사실상 0이 됐지만, 잔여 2 슬롯(`:190`,`:259`)이
// dev에서 항상 unfilled 응답을 받아 collapse하면서 ~0.10~0.12 shift가 누적된다.
// 프로덕션 fill rate가 ~90%이므로 실측 CLS는 0.01~0.02로 떨어질 것이며, 참 기준은 CrUX field
// p75 < 0.10이다 (spec 섹션 4.6 출시 신호). 본 단언은 0.30+ 같은 명백한 회귀만 차단.
test('시설 상세 페이지의 누적 CLS가 0.15 미만이다 (dev 회귀 가드)', async ({ page, request, browserName }) => {
  // `layout-shift` PerformanceObserver entry는 Chromium 전용. Firefox/WebKit에서는 항상 0 측정되어
  // 단언이 vacuously pass — 회귀 신호 가치 없음.
  test.skip(browserName !== 'chromium', 'layout-shift entries are Chromium-only')
  const id = await getParkingId(request)
  await page.goto(`/parking/${id}`, { waitUntil: 'networkidle' })

  const cls = await page.evaluate(() => new Promise<number>((resolve) => {
    let total = 0
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as unknown as Array<{ value: number; hadRecentInput: boolean }>) {
        if (!entry.hadRecentInput) total += entry.value
      }
    }).observe({ type: 'layout-shift', buffered: true })
    // 광고가 늦게 들어와 발생하는 shift까지 7초 관측 (dev adtest=on 환경에서 안정화 시간 확보)
    setTimeout(() => resolve(total), 7000)
  }))

  expect(cls).toBeLessThan(0.15)
})

test('상위 4 광고 슬롯의 ins 높이가 280px로 고정되어 있다', async ({ page, request }) => {
  const id = await getParkingId(request)
  await page.goto(`/parking/${id}`, { waitUntil: 'networkidle' })

  // AdBanner의 ins.adsbygoogle은 <ClientOnly> 안에 있어 hydration 후에야 DOM에 들어온다.
  // fixed 슬롯 4개가 모두 마운트될 때까지 대기.
  await page.waitForFunction(
    () => document.querySelectorAll('ins.adsbygoogle').length >= 4,
    null,
    { timeout: 10000 }
  )

  // fixed 슬롯은 컴포넌트가 인라인 style에 `display: inline-block; width: 100%; height: 280px`를 세팅한다.
  // 비fixed (sizing="min") 슬롯은 `display: block`이고 height는 AdSense가 런타임에 결정한다.
  // → display:inline-block 으로 fixed 슬롯만 deterministic 하게 식별.
  const fixedSlots = await page.locator('ins.adsbygoogle').evaluateAll((els) =>
    els
      .filter((el) => (el as HTMLElement).style.display === 'inline-block')
      .map((el) => (el as HTMLElement).style.height)
  )
  expect(fixedSlots.length).toBe(4)
  expect(fixedSlots.every((h) => h === '280px')).toBe(true)
})
