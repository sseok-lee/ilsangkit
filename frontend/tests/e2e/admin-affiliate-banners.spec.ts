import { mkdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test, type Page, type Route } from '@playwright/test'

type Provider = 'coupang' | 'ali' | 'toss'
type ImageSourceType = 'upload' | 'url'
type DisclosureSource = 'banner' | 'provider' | 'missing'

interface BannerDraft {
  provider: Provider
  name: string
  imageSourceType: ImageSourceType
  imageAssetId: string | null
  externalImageUrl: string | null
  targetUrl: string
  altText: string
  disclosureOverride: string | null
  endDate: string | null
}

interface StoredBanner extends BannerDraft {
  id: string
  imageUrl: string
  isEnabled: boolean
  createdAt: string
  updatedAt: string
  isExpired: boolean
}

interface BannerDto extends StoredBanner {
  disclosureText: string | null
  disclosureSource: DisclosureSource
}

interface DisclosureDto {
  provider: Provider
  defaultDisclosureText: string | null
  updatedAt: string | null
}

interface ApiState {
  banners: StoredBanner[]
  disclosures: Record<Provider, string | null>
  bannerIndex: number
  imageUploadIndex: number
  imageRequests: number
  externalPreviewRequests: number
  vendorRequests: number
  affiliatePublicRequests: number
  lastUploadBytes: Buffer | null
  lastUploadContentType: string | null
  createBodies: BannerDraft[]
  updateBodies: BannerDraft[]
  disclosureSaveBodies: DisclosureDto[]
  nextSaveFails: boolean
  nextStatusDelayMs: number
  nextDisclosureSaveFails: boolean
  nextDisclosureReadFails: boolean
  nextDisclosureReadFailures: number
  nextListFails: boolean
  nextListFailures: number
  nextDetailFails: boolean
  nextDetailFailures: number
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fixtureDir = path.resolve(__dirname, '../../../backend/__tests__/fixtures')
const uploadFixture = path.join(fixtureDir, 'affiliate-banner.png')
const finalVisualDir = path.resolve(__dirname, '../../../docs/superpowers/reviews/affiliate-expiration-assets/final')
const imageBytes = readFileSync(uploadFixture)
const now = '2026-10-06T00:00:00.000Z'
const later = '2026-10-06T00:01:00.000Z'
const fixedKstDate = '2026-10-06'
const externalImageUrl = 'https://cdn.example.test/affiliate/external.png'
const badExternalImageUrl = 'https://cdn.example.test/affiliate/missing.png'
const affiliateTargetUrl = 'https://vendor.example.test/click?sig=a%2Bb&sig=a+b&z=2&z=1'
const bannerIds = [
  '11111111-1111-4111-8111-111111111111',
  '44444444-4444-4444-8444-444444444444',
  '55555555-5555-4555-8555-555555555555',
]
const bannerId = bannerIds[0]
const assetIds = [
  '22222222-2222-4222-8222-222222222222',
  '33333333-3333-4333-8333-333333333333',
  '66666666-6666-4666-8666-666666666666',
]
const providers: Provider[] = ['coupang', 'ali', 'toss']
const draftKeys = [
  'provider',
  'name',
  'imageSourceType',
  'imageAssetId',
  'externalImageUrl',
  'targetUrl',
  'altText',
  'disclosureOverride',
  'endDate',
].sort()

function newState(): ApiState {
  return {
    banners: [],
    disclosures: { coupang: null, ali: null, toss: null },
    bannerIndex: 0,
    imageUploadIndex: 0,
    imageRequests: 0,
    externalPreviewRequests: 0,
    vendorRequests: 0,
    affiliatePublicRequests: 0,
    lastUploadBytes: null,
    lastUploadContentType: null,
    createBodies: [],
    updateBodies: [],
    disclosureSaveBodies: [],
    nextSaveFails: false,
    nextStatusDelayMs: 0,
    nextDisclosureSaveFails: false,
    nextDisclosureReadFails: false,
    nextDisclosureReadFailures: 0,
    nextListFails: false,
    nextListFailures: 0,
    nextDetailFails: false,
    nextDetailFailures: 0,
  }
}

function envelope(data: unknown) {
  return { success: true, data }
}

function normalizeDisclosureText(value: string | null): string | null {
  if (value === null) return null
  const normalized = value.replace(/\r\n?/g, '\n').trim()
  return normalized.length > 0 ? normalized : null
}

function isEndDateExpired(endDate: string | null): boolean {
  return endDate !== null && endDate < fixedKstDate
}

function resolveDisclosure(state: ApiState, draft: BannerDraft): Pick<BannerDto, 'disclosureText' | 'disclosureSource'> {
  const override = normalizeDisclosureText(draft.disclosureOverride)
  if (override !== null) return { disclosureText: override, disclosureSource: 'banner' }
  const providerDefault = state.disclosures[draft.provider]
  if (providerDefault !== null) return { disclosureText: providerDefault, disclosureSource: 'provider' }
  return { disclosureText: null, disclosureSource: 'missing' }
}

function nextBannerId(state: ApiState): string {
  const id = bannerIds[state.bannerIndex] ?? `77777777-7777-4777-8777-${String(state.bannerIndex).padStart(12, '7')}`
  state.bannerIndex += 1
  return id
}

function makeStoredBanner(state: ApiState, draft: BannerDraft, isEnabled = false): StoredBanner {
  const imageUrl = draft.imageSourceType === 'upload'
    ? `/api/images/affiliate-banners/${draft.imageAssetId}.png`
    : draft.externalImageUrl || ''

  return {
    ...draft,
    id: nextBannerId(state),
    imageUrl,
    isEnabled,
    createdAt: now,
    updatedAt: now,
    isExpired: isEndDateExpired(draft.endDate),
  }
}

function toBannerDto(state: ApiState, banner: StoredBanner): BannerDto {
  return {
    ...banner,
    ...resolveDisclosure(state, banner),
    isExpired: isEndDateExpired(banner.endDate),
  }
}

function makeDisclosureDto(state: ApiState, provider: Provider): DisclosureDto {
  return {
    provider,
    defaultDisclosureText: state.disclosures[provider],
    updatedAt: state.disclosures[provider] === null ? null : later,
  }
}

function assertValidUuid(value: string | null) {
  expect(value).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/)
}

function assertDraftContract(draft: BannerDraft) {
  expect(Object.keys(draft).sort()).toEqual(draftKeys)
  expect(['coupang', 'ali', 'toss']).toContain(draft.provider)
  expect(['upload', 'url']).toContain(draft.imageSourceType)
  expect(draft.targetUrl).toBe(affiliateTargetUrl)
  expect(draft.disclosureOverride === null || typeof draft.disclosureOverride === 'string').toBe(true)
  expect(draft.endDate === null || /^\d{4}-\d{2}-\d{2}$/.test(draft.endDate)).toBe(true)

  if (draft.imageSourceType === 'upload') {
    assertValidUuid(draft.imageAssetId)
    expect(draft.externalImageUrl).toBeNull()
    return
  }

  expect(draft.imageAssetId).toBeNull()
  expect(draft.externalImageUrl).toMatch(/^https:\/\//)
}

async function fulfillJson(route: Route, status: number, data: unknown) {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(data),
    headers: { 'Cache-Control': 'no-store' },
  })
}

async function installFixtureRoutes(page: Page, state: ApiState) {
  await page.route('https://vendor.example.test/**', async (route) => {
    state.vendorRequests += 1
    await route.abort('blockedbyclient')
  })

  await page.route('https://cdn.example.test/**', async (route) => {
    state.externalPreviewRequests += 1
    if (route.request().url() === badExternalImageUrl) {
      await route.fulfill({ status: 404, body: 'missing' })
      return
    }
    await route.fulfill({ status: 200, contentType: 'image/png', body: imageBytes })
  })

  await page.route('**/api/images/**', async (route) => {
    state.imageRequests += 1
    await route.fulfill({ status: 200, contentType: 'image/png', body: imageBytes })
  })

  await page.route('**/api/admin/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const pathName = url.pathname

    if (pathName === '/api/admin/session') {
      await fulfillJson(route, 200, envelope({ authenticated: true }))
      return
    }

    if (pathName === '/api/admin/articles') {
      await fulfillJson(route, 200, envelope({ items: [], total: 0, page: 1, totalPages: 1 }))
      return
    }

    if (pathName === '/api/admin/guides') {
      await fulfillJson(route, 200, envelope({ items: [], total: 0, page: 1, totalPages: 1 }))
      return
    }

    if (pathName === '/api/admin/affiliate-provider-disclosures' && request.method() === 'GET') {
      if (state.nextDisclosureReadFails || state.nextDisclosureReadFailures > 0) {
        state.nextDisclosureReadFails = false
        state.nextDisclosureReadFailures = Math.max(0, state.nextDisclosureReadFailures - 1)
        await fulfillJson(route, 500, { success: false, error: { code: 'INJECTED_DISCLOSURE_READ_FAILURE', message: 'read failed' } })
        return
      }
      await fulfillJson(route, 200, envelope(providers.map((provider) => makeDisclosureDto(state, provider))))
      return
    }

    const disclosureMatch = pathName.match(/^\/api\/admin\/affiliate-provider-disclosures\/([^/]+)$/)
    if (disclosureMatch && request.method() === 'PUT') {
      if (state.nextDisclosureSaveFails) {
        state.nextDisclosureSaveFails = false
        await fulfillJson(route, 500, { success: false, error: { code: 'INJECTED_DISCLOSURE_SAVE_FAILURE', message: 'save failed' } })
        return
      }
      const provider = disclosureMatch[1] as Provider
      expect(providers).toContain(provider)
      const body = request.postDataJSON() as { defaultDisclosureText: string }
      const text = normalizeDisclosureText(body.defaultDisclosureText)
      if (text === null || text.length > 1000) {
        await fulfillJson(route, 422, { success: false, error: { code: 'VALIDATION_ERROR', message: '문구는 1~1,000자로 입력하세요' } })
        return
      }
      state.disclosures[provider] = text
      const dto = makeDisclosureDto(state, provider)
      state.disclosureSaveBodies.push(dto)
      await fulfillJson(route, 200, envelope(dto))
      return
    }

    if (pathName === '/api/admin/affiliate-banner-images' && request.method() === 'POST') {
      state.lastUploadContentType = request.headers()['content-type'] ?? null
      state.lastUploadBytes = request.postDataBuffer()
      expect(state.lastUploadContentType).toBe('application/octet-stream')
      expect(state.lastUploadBytes).not.toBeNull()
      if (state.lastUploadBytes === null) throw new Error('Expected upload request body bytes')
      expect(Buffer.compare(state.lastUploadBytes, imageBytes)).toBe(0)
      const id = assetIds[state.imageUploadIndex]
      assertValidUuid(id)
      state.imageUploadIndex += 1
      await fulfillJson(route, 201, envelope({ imageAssetId: id, imageUrl: `/api/images/affiliate-banners/${id}.png` }))
      return
    }

    if (pathName === '/api/admin/affiliate-banners' && request.method() === 'GET') {
      if (state.nextListFails || state.nextListFailures > 0) {
        state.nextListFails = false
        state.nextListFailures = Math.max(0, state.nextListFailures - 1)
        await fulfillJson(route, 500, { success: false, error: { code: 'INJECTED_LIST_FAILURE', message: 'list failed' } })
        return
      }
      const provider = url.searchParams.get('provider')
      const isEnabled = url.searchParams.get('isEnabled')
      const items = state.banners.filter((banner) => {
        if (provider && banner.provider !== provider) return false
        if (isEnabled && banner.isEnabled !== (isEnabled === 'true')) return false
        return true
      }).map((banner) => toBannerDto(state, banner))
      await fulfillJson(route, 200, envelope({ items, total: items.length, page: 1, totalPages: 1 }))
      return
    }

    if (pathName === '/api/admin/affiliate-banners' && request.method() === 'POST') {
      if (state.nextSaveFails) {
        state.nextSaveFails = false
        await fulfillJson(route, 500, { success: false, error: { code: 'INJECTED_SAVE_FAILURE', message: 'save failed' } })
        return
      }
      const draft = request.postDataJSON() as BannerDraft
      assertDraftContract(draft)
      state.createBodies.push(draft)
      const stored = makeStoredBanner(state, draft, false)
      state.banners = [stored, ...state.banners]
      await fulfillJson(route, 201, envelope(toBannerDto(state, stored)))
      return
    }

    const statusMatch = pathName.match(/^\/api\/admin\/affiliate-banners\/([^/]+)\/status$/)
    if (statusMatch && request.method() === 'PATCH') {
      const id = statusMatch[1]
      const body = request.postDataJSON() as { isEnabled: boolean }
      if (state.nextStatusDelayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, state.nextStatusDelayMs))
        state.nextStatusDelayMs = 0
      }
      const stored = state.banners.find((banner) => banner.id === id)
      if (!stored) {
        await fulfillJson(route, 404, { success: false, error: { code: 'NOT_FOUND', message: 'not found' } })
        return
      }
      if (body.isEnabled && resolveDisclosure(state, stored).disclosureText === null) {
        await fulfillJson(route, 422, { success: false, error: { code: 'VALIDATION_ERROR', message: '수익 고지 문구를 등록한 뒤 사용으로 설정하세요' } })
        return
      }
      Object.assign(stored, { isEnabled: body.isEnabled, updatedAt: now, isExpired: isEndDateExpired(stored.endDate) })
      await fulfillJson(route, 200, envelope(toBannerDto(state, stored)))
      return
    }

    const bannerMatch = pathName.match(/^\/api\/admin\/affiliate-banners\/([^/]+)$/)
    if (bannerMatch && request.method() === 'GET') {
      if (state.nextDetailFails || state.nextDetailFailures > 0) {
        state.nextDetailFails = false
        state.nextDetailFailures = Math.max(0, state.nextDetailFailures - 1)
        await fulfillJson(route, 500, { success: false, error: { code: 'INJECTED_DETAIL_FAILURE', message: 'detail failed' } })
        return
      }
      const stored = state.banners.find((banner) => banner.id === bannerMatch[1])
      await fulfillJson(route, stored ? 200 : 404, stored ? envelope(toBannerDto(state, stored)) : { success: false, error: { code: 'NOT_FOUND', message: 'not found' } })
      return
    }

    if (bannerMatch && request.method() === 'PATCH') {
      if (state.nextSaveFails) {
        state.nextSaveFails = false
        await fulfillJson(route, 500, { success: false, error: { code: 'INJECTED_SAVE_FAILURE', message: 'save failed' } })
        return
      }
      const stored = state.banners.find((banner) => banner.id === bannerMatch[1])
      if (!stored) {
        await fulfillJson(route, 404, { success: false, error: { code: 'NOT_FOUND', message: 'not found' } })
        return
      }
      const patch = request.postDataJSON() as BannerDraft
      assertDraftContract(patch)
      if (stored.isEnabled && resolveDisclosure(state, patch).disclosureText === null) {
        await fulfillJson(route, 422, {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: '수익 고지 문구는 1~1,000자로 입력하세요',
            details: [{ path: ['disclosureOverride'] }],
          },
        })
        return
      }
      state.updateBodies.push(patch)
      Object.assign(stored, patch, {
        imageUrl: patch.imageSourceType === 'upload'
          ? `/api/images/affiliate-banners/${patch.imageAssetId}.png`
          : patch.externalImageUrl || '',
        updatedAt: now,
        isExpired: isEndDateExpired(patch.endDate),
      })
      await fulfillJson(route, 200, envelope(toBannerDto(state, stored)))
      return
    }

    await fulfillJson(route, 404, { success: false, error: { code: 'UNHANDLED', message: pathName } })
  })

  await page.route('**/api/affiliate-banners**', async (route) => {
    state.affiliatePublicRequests += 1
    await fulfillJson(route, 200, envelope(null))
  })
}

async function openAffiliateTab(page: Page) {
  const sessionResponse = page.waitForResponse((response) => response.url().includes('/api/admin/session'))
  const articlesResponse = page.waitForResponse((response) => response.url().includes('/api/admin/articles'))
  await page.goto('/admin')
  await sessionResponse
  await articlesResponse
  await expect(page).toHaveURL(/\/admin$/)
  await expect(page.getByText('글이 없습니다')).toBeVisible()
  await page.getByTestId('tab-affiliate').click()
  await expect(page.getByText('고지 문구가 등록된 사용 가능 배너는 모바일 광고 영역에 무작위로 노출됩니다.')).toBeVisible()
}


async function reloadAffiliateTab(page: Page) {
  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(page.getByTestId('tab-affiliate')).toBeVisible()
  await page.getByTestId('tab-affiliate').click()
  await expect(page.getByTestId('affiliate-section-banners')).toBeVisible()
}

async function pushRouteFromPage(page: Page, pathName: string) {
  await page.waitForFunction(() => {
    const app = (window as Window & {
      useNuxtApp?: () => { $router?: { push?: (path: string) => Promise<unknown> } }
    }).useNuxtApp?.()
    return Boolean(app?.$router?.push)
  })
  await page.evaluate((nextPath) => {
    const app = (window as Window & {
      useNuxtApp?: () => { $router?: { push?: (path: string) => Promise<unknown> } }
    }).useNuxtApp?.()
    const router = app?.$router as { push?: (path: string) => Promise<unknown> } | undefined
    if (!router?.push) throw new Error('Nuxt router is not available on window.useNuxtApp().$router')
    void router.push(nextPath)
    return true
  }, pathName)
}

async function fillBaseDraft(page: Page, name: string) {
  await page.getByTestId('name').fill(name)
  await page.getByTestId('target-url').fill(affiliateTargetUrl)
  await page.getByTestId('alt-text').fill(`${name} 대체 텍스트`)
}

async function waitForPreviewLoaded(page: Page) {
  await expect(page.getByTestId('preview-state')).toHaveText('이미지를 불러왔습니다')
  await expect(page.getByTestId('preview-image')).toBeVisible()
  await expect.poll(async () => page.getByTestId('preview-image').evaluate((element) => {
    const image = element as HTMLImageElement
    return image.complete && image.naturalWidth > 0
  })).toBe(true)
}

async function saveProviderDisclosure(page: Page, text: string) {
  await page.getByTestId('provider-disclosure-text').fill(text)
  const response = page.waitForResponse((result) =>
    result.request().method() === 'PUT'
    && result.url().includes('/api/admin/affiliate-provider-disclosures/')
  )
  await page.getByTestId('provider-disclosure-save').click()
  await response
  await expect(page.getByTestId('provider-disclosure-text')).toHaveValue(normalizeDisclosureText(text) ?? '')
  await expect(page.getByTestId('provider-disclosure-save')).toHaveText('저장')
  await expect(page.getByTestId('provider-disclosure-status')).toHaveText('기본 문구 등록됨')
}

async function attachScreenshot(page: Page, testInfo: { outputPath: (name: string) => string, attach: (name: string, options: { path: string, contentType: string }) => Promise<void> }, name: string) {
  const pathName = testInfo.outputPath(`${name}.png`)
  await page.screenshot({ path: pathName, fullPage: true })
  await testInfo.attach(name, { path: pathName, contentType: 'image/png' })
}

async function captureFinalVisual(page: Page, projectName: string, name: string) {
  mkdirSync(finalVisualDir, { recursive: true })
  await page.screenshot({ path: path.join(finalVisualDir, `${name}-${projectName}.png`), fullPage: true })
}

function adminCspImageSources(value: string): string[] {
  return value.match(/img-src[^;]*/)?.[0].split(/\s+/) ?? []
}

test.describe('admin affiliate banner integration harness', () => {
  test('admin previews and public affiliate images permit HTTPS sources', async ({ request }) => {
    const admin = await request.get('/admin')
    const home = await request.get('/')
    const adminCsp = admin.headers()['content-security-policy'] ?? ''
    const homeCsp = home.headers()['content-security-policy'] ?? ''

    expect(admin.headers()['cache-control']).toContain('no-store')
    expect(adminCspImageSources(adminCsp)).toContain('https:')
    expect(adminCspImageSources(homeCsp)).toContain('https:')
  })

  test('banner management covers provider disclosure, upload, URL preview, dirty navigation, persistence, clipboard, screenshots, and empty public inventory', async ({ page }, testInfo) => {
    const state = newState()
    await installFixtureRoutes(page, state)
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write'], { origin: 'http://localhost:3001' })

    await openAffiliateTab(page)
    await page.getByTestId('affiliate-section-disclosures').click()
    await expect(page.getByTestId('provider-disclosure-provider')).toHaveValue('coupang')
    await saveProviderDisclosure(page, ' 쿠팡 테스트 기본 문구\n')
    await expect(page.getByTestId('provider-disclosure-status')).toHaveText('기본 문구 등록됨')
    await expect.poll(() => state.disclosures.coupang).toBe('쿠팡 테스트 기본 문구')
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await attachScreenshot(page, testInfo, `admin-affiliate-settings-${testInfo.project.name}`)

    await page.getByTestId('affiliate-section-banners').click()
    await expect(page.getByText('등록된 배너가 없습니다')).toBeVisible()

    await page.getByTestId('affiliate-new').click()
    await fillBaseDraft(page, '업로드 배너')
    await expect(page.getByTestId('disclosure-preview')).toHaveText('쿠팡 테스트 기본 문구')
    await page.getByTestId('source-upload').check()
    await page.getByTestId('upload-file').setInputFiles(uploadFixture)
    await waitForPreviewLoaded(page)
    await expect(page.getByTestId('preview-image')).toHaveAttribute('alt', '업로드 배너 대체 텍스트')
    await expect(page.getByTestId('affiliate-end-date-hint')).toContainText('한국 시간')
    await page.getByTestId('affiliate-end-date').fill('2026-10-15')
    await page.getByTestId('save-button').click()

    await expect(page.getByTestId(`affiliate-row-${bannerId}`)).toContainText('업로드 배너')
    await expect(page.getByTestId(`affiliate-row-${bannerId}`)).toContainText('사용 안 함')
    expect(state.imageUploadIndex).toBe(1)
    expect(state.banners[0]).toMatchObject({ id: bannerId, isEnabled: false, imageSourceType: 'upload', imageAssetId: assetIds[0], disclosureOverride: null })
    expect(state.createBodies).toHaveLength(1)
    expect(state.createBodies[0].disclosureOverride).toBeNull()
    expect(state.createBodies[0].endDate).toBe('2026-10-15')
    await expect(page.getByTestId(`affiliate-row-${bannerId}`)).toContainText('종료일 2026-10-15')

    await reloadAffiliateTab(page)
    await expect(page.getByTestId(`affiliate-row-${bannerId}`)).toContainText('업로드 배너')

    await page.getByTestId(`affiliate-row-${bannerId}`).click()
    await expect(page.getByTestId('status-enable')).toBeVisible()
    state.nextStatusDelayMs = 350
    const enablePromise = page.waitForResponse((response) => response.url().includes('/status') && response.request().method() === 'PATCH')
    await page.getByTestId('status-enable').click()
    await expect(page.locator('form').first()).toContainText('사용 안 함')
    await enablePromise
    await expect(page.locator('form').first()).toContainText('사용 중')
    await expect(page.getByTestId(`affiliate-row-${bannerId}`)).toContainText('사용 중')

    await page.getByTestId('status-disable').click()
    await expect(page.locator('form').first()).toContainText('사용 안 함')
    await expect(page.getByTestId(`affiliate-row-${bannerId}`)).toContainText('사용 안 함')

    const beforeUrlPreviewRequests = state.externalPreviewRequests
    await page.getByTestId('source-url').check()
    await page.getByTestId('external-image-url').fill(externalImageUrl)
    await expect.poll(() => state.externalPreviewRequests).toBe(beforeUrlPreviewRequests)
    await page.getByTestId('preview-button').click()
    await waitForPreviewLoaded(page)
    expect(state.externalPreviewRequests - beforeUrlPreviewRequests).toBe(1)
    await page.getByTestId('affiliate-end-date-clear').click()
    await page.getByTestId('save-button').click()
    await expect(page.getByTestId(`affiliate-row-${bannerId}`)).toContainText('URL')
    expect(state.banners[0]).toMatchObject({ imageSourceType: 'url', externalImageUrl })
    expect(state.updateBodies.at(-1)).toMatchObject({ imageSourceType: 'url', imageAssetId: null, externalImageUrl, disclosureOverride: null, endDate: null })
    await expect(page.getByTestId(`affiliate-row-${bannerId}`)).toContainText('종료일 없음')

    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await attachScreenshot(page, testInfo, `admin-affiliate-editor-${testInfo.project.name}`)

    state.nextSaveFails = true
    await page.getByTestId('name').fill('저장 실패 후 보존')
    await page.getByTestId('save-button').click()
    await expect(page.getByTestId('editor-message')).toHaveText('저장하지 못했습니다')
    await expect(page.getByTestId('name')).toHaveValue('저장 실패 후 보존')

    await page.getByTestId('source-url').check()
    await page.getByTestId('external-image-url').fill(badExternalImageUrl)
    await page.getByTestId('preview-button').click()
    await expect(page.getByTestId('preview-state')).toHaveText('이미지를 불러올 수 없습니다')
    await page.getByTestId('save-button').click()
    await expect(page.getByTestId(`affiliate-row-${bannerId}`)).toContainText('저장 실패 후 보존')
    await page.getByTestId('status-enable').click()
    await expect(page.getByTestId('editor-message')).toHaveText('이미지를 불러올 수 없습니다')
    expect(state.banners[0].isEnabled).toBe(false)

    await page.getByTestId('target-url').fill(affiliateTargetUrl)
    await page.getByTestId('copy-target-url').click()
    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(affiliateTargetUrl)
    expect(state.vendorRequests).toBe(0)

    await page.getByTestId('name').fill('이동 취소 초안')
    page.once('dialog', async (dialog) => {
      expect(dialog.message()).toContain('저장하지 않은 제휴 배너 변경 내용')
      await dialog.dismiss()
    })
    await page.getByTestId('tab-guide').click()
    await expect(page.getByText('고지 문구가 등록된 사용 가능 배너는 모바일 광고 영역에 무작위로 노출됩니다.')).toBeVisible()
    await expect(page.getByTestId('name')).toHaveValue('이동 취소 초안')

    let publicDocumentRequests = 0
    page.on('request', (request) => {
      if (request.resourceType() === 'document' && new URL(request.url()).pathname === '/') publicDocumentRequests += 1
    })
    let dialogCount = 0
    page.once('dialog', async (dialog) => {
      dialogCount += 1
      await dialog.dismiss()
    })
    await pushRouteFromPage(page, '/')
    await expect(page).toHaveURL(/\/admin$/)
    await expect(page.getByTestId('name')).toHaveValue('이동 취소 초안')
    expect(dialogCount).toBe(1)
    expect(publicDocumentRequests).toBe(0)
    expect(state.affiliatePublicRequests).toBe(0)

    page.once('dialog', async (dialog) => {
      await dialog.accept()
    })
    const publicDocumentResponse = page.waitForResponse((response) =>
      response.request().resourceType() === 'document'
      && new URL(response.url()).pathname === '/'
    )
    await pushRouteFromPage(page, '/')
    await page.waitForURL('/')
    const publicResponse = await publicDocumentResponse
    expect(adminCspImageSources(publicResponse.headers()['content-security-policy'] ?? '')).toContain('https:')
    expect(publicDocumentRequests).toBe(1)
    await expect(page.locator('[data-testid^="affiliate-row-"]')).toHaveCount(0)
    await expect(page.locator('a[href*="vendor.example.test"]')).toHaveCount(0)
    await expect(page.getByTestId('affiliate-banner')).toHaveCount(0)
    if ((page.viewportSize()?.width ?? 1280) >= 768) expect(state.affiliatePublicRequests).toBe(0)
  })

  test('provider disclosures follow provider changes, survive reload, and escape HTML text', async ({ page }) => {
    const state = newState()
    state.disclosures.coupang = '쿠팡 기본 문구'
    await installFixtureRoutes(page, state)

    await openAffiliateTab(page)
    await page.getByTestId('affiliate-new').click()
    await fillBaseDraft(page, '문구 전환 배너')
    await page.getByTestId('source-url').check()
    await page.getByTestId('external-image-url').fill(externalImageUrl)
    await page.getByTestId('preview-button').click()
    await waitForPreviewLoaded(page)
    await expect(page.getByTestId('disclosure-preview')).toHaveText('쿠팡 기본 문구')

    await page.getByTestId('provider').selectOption('ali')
    await expect(page.getByTestId('disclosure-help')).toHaveText('업체 기본 문구를 등록하거나 이 배너의 문구를 입력하세요')
    await expect(page.getByText('출처: 문구 미등록')).toBeVisible()
    await expect(page.getByTestId('disclosure-preview')).toHaveCount(0)

    await page.getByTestId('disclosure-mode-banner').check()
    await page.getByTestId('disclosure-override').fill(' <strong>광고</strong>\n별도 문구 ')
    await expect(page.getByTestId('disclosure-preview')).toHaveText('<strong>광고</strong>\n별도 문구')
    await expect(page.getByTestId('disclosure-preview').locator('strong')).toHaveCount(0)
    await page.getByTestId('save-button').click()

    const id = bannerIds[0]
    await expect(page.getByTestId(`affiliate-row-${id}`)).toContainText('문구 전환 배너')
    expect(state.createBodies[0].disclosureOverride).toBe('<strong>광고</strong>\n별도 문구')
    expect(toBannerDto(state, state.banners[0])).toMatchObject({ disclosureSource: 'banner', disclosureText: '<strong>광고</strong>\n별도 문구' })

    await reloadAffiliateTab(page)
    await page.getByTestId(`affiliate-row-${id}`).click()
    await expect(page.getByTestId('disclosure-mode-banner')).toBeChecked()
    await expect(page.getByTestId('disclosure-override')).toHaveValue('<strong>광고</strong>\n별도 문구')
  })

  test('end date saves, dirty cancel, clearing, and past-date expired warnings are preserved', async ({ page }, testInfo) => {
    const state = newState()
    state.disclosures.coupang = '쿠팡 기본 문구'
    await installFixtureRoutes(page, state)

    await openAffiliateTab(page)
    await page.getByTestId('affiliate-new').click()
    await fillBaseDraft(page, '기간 배너')
    await page.getByTestId('source-url').check()
    await page.getByTestId('external-image-url').fill(externalImageUrl)
    await page.getByTestId('preview-button').click()
    await waitForPreviewLoaded(page)

    const endDateInput = page.getByLabel('종료일 (선택)')
    await expect(endDateInput).toHaveAttribute('type', 'date')
    await expect(page.getByTestId('affiliate-end-date-hint')).toContainText('한국 시간')
    await endDateInput.fill('2026-10-15')
    await page.getByTestId('save-button').click()

    await expect(page.getByTestId(`affiliate-row-${bannerId}`)).toContainText('기간 배너')
    await expect(page.getByTestId(`affiliate-row-${bannerId}`)).toContainText('종료일 2026-10-15')
    expect(state.createBodies.at(-1)?.endDate).toBe('2026-10-15')

    await reloadAffiliateTab(page)
    await page.getByTestId(`affiliate-row-${bannerId}`).click()
    await expect(endDateInput).toHaveValue('2026-10-15')
    await captureFinalVisual(page, testInfo.project.name, 'admin-populated-date')

    await endDateInput.fill('2026-10-16')
    page.once('dialog', async (dialog) => {
      expect(dialog.message()).toContain('저장하지 않은 제휴 배너 변경 내용')
      await dialog.dismiss()
    })
    await page.getByTestId('tab-guide').click()
    await expect(page.getByText('고지 문구가 등록된 사용 가능 배너는 모바일 광고 영역에 무작위로 노출됩니다.')).toBeVisible()
    await expect(endDateInput).toHaveValue('2026-10-16')
    await page.getByTestId('cancel-button').click()
    await expect(endDateInput).toHaveValue('2026-10-15')
    expect(state.updateBodies).toHaveLength(0)

    await endDateInput.fill('2026-10-16')
    await page.getByTestId('save-button').click()
    await expect(page.getByTestId(`affiliate-row-${bannerId}`)).toContainText('종료일 2026-10-16')
    expect(state.updateBodies.at(-1)?.endDate).toBe('2026-10-16')

    await page.getByTestId('affiliate-end-date-clear').click()
    await page.getByTestId('save-button').click()
    await expect(page.getByTestId(`affiliate-row-${bannerId}`)).toContainText('종료일 없음')
    expect(state.updateBodies.at(-1)?.endDate).toBeNull()

    await endDateInput.fill('2026-10-05')
    await expect(page.getByTestId('affiliate-end-date-warning')).toHaveText('이미 지난 종료일입니다. 저장하면 광고가 노출되지 않습니다.')
    await captureFinalVisual(page, testInfo.project.name, 'admin-past-date-warning')
    await page.getByTestId('save-button').click()
    await expect(page.getByTestId(`affiliate-row-${bannerId}`)).toContainText('종료일 2026-10-05')
    await expect(page.getByTestId(`affiliate-expired-${bannerId}`)).toHaveText('기간 종료')
    expect(state.updateBodies.at(-1)?.endDate).toBe('2026-10-05')
    expect(state.banners[0]).toMatchObject({ isEnabled: false, isExpired: true, endDate: '2026-10-05' })

    await page.getByTestId('status-enable').click()
    await expect(page.getByTestId('editor-message')).toHaveText('종료일이 지나 사용 설정을 켜도 광고가 노출되지 않습니다.')
    await captureFinalVisual(page, testInfo.project.name, 'admin-expired-enabled-warning')
    expect(state.banners[0]).toMatchObject({ isEnabled: true, isExpired: true, endDate: '2026-10-05' })
  })

  test('provider settings handle read retry, PUT failure preservation, and dirty section guard', async ({ page }) => {
    const state = newState()
    state.nextDisclosureReadFailures = 2
    await installFixtureRoutes(page, state)

    await openAffiliateTab(page)
    await page.getByTestId('affiliate-section-disclosures').click()
    await expect(page.getByTestId('provider-disclosure-load-error')).toHaveText('문구 설정을 불러오지 못했습니다')
    await page.getByTestId('provider-disclosure-retry').click()
    await expect(page.getByTestId('provider-disclosure-provider')).toHaveValue('coupang')

    state.nextDisclosureSaveFails = true
    await page.getByTestId('provider-disclosure-text').fill('실패 후 유지 문구')
    await page.getByTestId('provider-disclosure-save').click()
    await expect(page.getByTestId('provider-disclosure-error')).toHaveText('문구를 저장하지 못했습니다')
    await expect(page.getByTestId('provider-disclosure-text')).toHaveValue('실패 후 유지 문구')

    page.once('dialog', async (dialog) => {
      expect(dialog.message()).toContain('저장하지 않은 업체별 문구 변경 내용')
      await dialog.dismiss()
    })
    await page.getByTestId('affiliate-section-banners').click()
    await expect(page.getByTestId('provider-disclosure-text')).toBeVisible()

    await page.getByTestId('provider-disclosure-save').click()
    await expect.poll(() => state.disclosures.coupang).toBe('실패 후 유지 문구')
    await page.getByTestId('affiliate-section-banners').click()
    await expect(page.getByTestId('affiliate-new')).toBeVisible()
  })

  test('disclosure saves report list and selected-detail refresh failures separately', async ({ page }) => {
    const state = newState()
    state.disclosures.coupang = '초기 문구'
    await installFixtureRoutes(page, state)

    await openAffiliateTab(page)
    await page.getByTestId('affiliate-new').click()
    await fillBaseDraft(page, '새로고침 배너')
    await page.getByTestId('source-url').check()
    await page.getByTestId('external-image-url').fill(externalImageUrl)
    await page.getByTestId('preview-button').click()
    await waitForPreviewLoaded(page)
    await page.getByTestId('save-button').click()
    await expect(page.getByTestId(`affiliate-row-${bannerId}`)).toBeVisible()
    await page.getByTestId(`affiliate-row-${bannerId}`).click()

    await page.getByTestId('affiliate-section-disclosures').click()
    state.nextListFailures = 2
    await saveProviderDisclosure(page, '목록 새로고침 실패 문구')
    await expect.poll(() => state.disclosures.coupang).toBe('목록 새로고침 실패 문구')
    await page.getByTestId('affiliate-section-banners').click()
    await expect.poll(() => state.nextListFailures < 2).toBe(true)
    await expect(page.getByTestId('affiliate-error')).toHaveText('문구는 저장됐지만 목록을 새로 불러오지 못했습니다')
    state.nextListFailures = 0
    await page.getByTestId('affiliate-retry').click()
    await expect(page.getByTestId('affiliate-error')).toHaveCount(0)

    await page.getByTestId(`affiliate-row-${bannerId}`).click()
    await page.getByTestId('affiliate-section-disclosures').click()
    state.nextDetailFailures = 2
    await saveProviderDisclosure(page, '상세 새로고침 실패 문구')
    await expect.poll(() => state.disclosures.coupang).toBe('상세 새로고침 실패 문구')
    await page.getByTestId('affiliate-section-banners').click()
    await expect(page.getByTestId('affiliate-error')).toHaveText('문구는 저장됐지만 선택한 배너를 새로 불러오지 못했습니다')
    state.nextDetailFailures = 0
    await page.getByTestId('affiliate-retry').click()
    await expect(page.getByTestId('affiliate-error')).toHaveCount(0)
  })

  test('missing provider default marks the row and blocks enable', async ({ page }) => {
    const state = newState()
    await installFixtureRoutes(page, state)

    await openAffiliateTab(page)
    await page.getByTestId('affiliate-new').click()
    await fillBaseDraft(page, '문구 없는 배너')
    await page.getByTestId('source-url').check()
    await page.getByTestId('external-image-url').fill(externalImageUrl)
    await page.getByTestId('preview-button').click()
    await waitForPreviewLoaded(page)
    await expect(page.getByTestId('disclosure-help')).toHaveText('업체 기본 문구를 등록하거나 이 배너의 문구를 입력하세요')
    await page.getByTestId('save-button').click()
    await expect(page.getByTestId(`affiliate-row-${bannerId}`)).toContainText('문구 미등록')
    await page.getByTestId('status-enable').click()
    await expect(page.getByTestId('editor-message')).toHaveText('수익 고지 문구를 등록한 뒤 사용으로 설정하세요')
    expect(state.banners[0].isEnabled).toBe(false)
    expect(state.vendorRequests).toBe(0)
  })

  test('enabled banners reject image and missing-disclosure edits atomically', async ({ page }) => {
    const state = newState()
    state.disclosures.coupang = '쿠팡 기본 문구'
    await installFixtureRoutes(page, state)

    await openAffiliateTab(page)
    await page.getByTestId('affiliate-new').click()
    await fillBaseDraft(page, '활성 배너')
    await page.getByTestId('source-url').check()
    await page.getByTestId('external-image-url').fill(externalImageUrl)
    await page.getByTestId('preview-button').click()
    await waitForPreviewLoaded(page)
    await page.getByTestId('save-button').click()
    await page.getByTestId('status-enable').click()
    await expect(page.locator('form').first()).toContainText('사용 중')

    const before = { ...state.banners[0] }
    state.disclosures.coupang = null
    await page.getByTestId('source-upload').check()
    await page.getByTestId('upload-file').setInputFiles(uploadFixture)
    await waitForPreviewLoaded(page)
    await page.getByTestId('save-button').click()
    await expect(page.getByTestId('editor-message')).toHaveText('수익 고지 문구는 1~1,000자로 입력하세요')
    expect(state.banners[0]).toEqual(before)
    expect(state.updateBodies).toHaveLength(0)
    expect(state.imageUploadIndex).toBe(1)
  })
})
