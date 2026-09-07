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

for (const type of ['apt-sale', 'apt-rent', 'villa-sale', 'villa-rent', 'offitel-sale', 'offitel-rent']) {
  test(`부동산 상세 ${type} — 존재하지 않는 건물은 SSR 404`, async ({ request }) => {
    // 유효한 지역 slug를 써야 건물 조회까지 도달한다. gangnam-gu는 지역 검증에서 먼저 404가 난다.
    const slug = `__nonexistent-building-${Date.now()}__`
    const res = await request.get(`/real-estate/${type}/seoul/gangnam/${slug}`)
    expect(res.status()).toBe(404)
    const html = await res.text()
    expect(html).toContain('페이지를 찾을 수 없습니다')
    expect(html).toMatch(/<meta\b[^>]*name="robots"[^>]*content="noindex, nofollow"/)
    expect(html).not.toMatch(/<link\b[^>]*rel="canonical"/)
  })
}
