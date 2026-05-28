import { expect, test } from '@playwright/test'

const BACKEND_BASE = process.env.API_BASE ?? 'http://localhost:8000'

async function getParkingId(request: import('@playwright/test').APIRequestContext) {
  const res = await request.post(`${BACKEND_BASE}/api/facilities/search`, {
    data: { category: 'parking', city: '서울', limit: 5 },
  })
  if (!res.ok()) throw new Error(`parking 시설 조회 실패: ${res.status()}`)
  const body = await res.json() as {
    success: boolean
    data: { items: { id: string; lat: number; lng: number }[] }
  }
  const items = body?.data?.items ?? []
  // 좌표 없는 시설은 카카오맵 SSR/hydration에서 throw 가능 → 결정적으로 좌표 있는 시설만 사용
  const first = items.find((i) => i.lat && i.lng)
  if (!first?.id) throw new Error('좌표가 있는 parking 시설이 DB에 없습니다')
  return first.id
}

test('홈 페이지가 정상 200 + h1 렌더된다 (Phase 2 refactor smoke)', async ({ page }) => {
  const res = await page.goto('/', { waitUntil: 'domcontentloaded' })
  expect(res?.status()).toBe(200)
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
})

test('시설 상세 페이지가 정상 200 + h1 렌더된다 (Phase 2 refactor smoke)', async ({ page, request }) => {
  const id = await getParkingId(request)
  const res = await page.goto(`/parking/${id}`, { waitUntil: 'domcontentloaded' })
  expect(res?.status()).toBe(200)
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
})

test('부동산 상세 — 존재하지 않는 building에 대해 404 gate가 정확히 동작한다', async ({ page }) => {
  // 명백히 존재하지 않을 slug (timestamp) — 404 gate가 비활성화되면 200으로 통과해버리는 회귀 차단
  const slug = `__nonexistent-phase2-smoke-${Date.now()}__`
  const res = await page.goto(`/real-estate/apt-sale/seoul/gangnam-gu/${slug}`, { waitUntil: 'domcontentloaded' })
  expect(res?.status()).toBe(404)
})
