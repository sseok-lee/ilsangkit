import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test, type Page, type Route } from '@playwright/test'

type Provider = 'coupang' | 'ali' | 'toss'
type ImageSourceType = 'upload' | 'url'

interface BannerDraft {
  provider: Provider
  name: string
  imageSourceType: ImageSourceType
  imageAssetId: string | null
  externalImageUrl: string | null
  targetUrl: string
  altText: string
}

interface BannerDto extends BannerDraft {
  id: string
  imageUrl: string
  isEnabled: boolean
  createdAt: string
  updatedAt: string
}

interface ApiState {
  banners: BannerDto[]
  imageUploadIndex: number
  imageRequests: number
  externalPreviewRequests: number
  vendorRequests: number
  affiliatePublicRequests: number
  lastUploadBytes: Buffer | null
  lastUploadContentType: string | null
  createBodies: BannerDraft[]
  updateBodies: BannerDraft[]
  nextSaveFails: boolean
  nextStatusDelayMs: number
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fixtureDir = path.resolve(__dirname, '../../../backend/__tests__/fixtures')
const uploadFixture = path.join(fixtureDir, 'affiliate-banner.png')
const imageBytes = readFileSync(uploadFixture)
const now = '2026-10-06T00:00:00.000Z'
const externalImageUrl = 'https://cdn.example.test/affiliate/external.png'
const badExternalImageUrl = 'https://cdn.example.test/affiliate/missing.png'
const affiliateTargetUrl = 'https://vendor.example.test/click?sig=a%2Bb&sig=a+b&z=2&z=1'
const bannerId = '11111111-1111-4111-8111-111111111111'
const assetIds = [
  '22222222-2222-4222-8222-222222222222',
  '33333333-3333-4333-8333-333333333333',
]
const draftKeys = ['provider', 'name', 'imageSourceType', 'imageAssetId', 'externalImageUrl', 'targetUrl', 'altText'].sort()

function newState(): ApiState {
  return {
    banners: [],
    imageUploadIndex: 0,
    imageRequests: 0,
    externalPreviewRequests: 0,
    vendorRequests: 0,
    affiliatePublicRequests: 0,
    lastUploadBytes: null,
    lastUploadContentType: null,
    createBodies: [],
    updateBodies: [],
    nextSaveFails: false,
    nextStatusDelayMs: 0,
  }
}

function envelope(data: unknown) {
  return { success: true, data }
}

function makeBanner(id: string, draft: BannerDraft, isEnabled = false): BannerDto {
  const imageUrl = draft.imageSourceType === 'upload'
    ? `/api/images/affiliate-banners/${draft.imageAssetId}.png`
    : draft.externalImageUrl || ''

  return {
    ...draft,
    id,
    imageUrl,
    isEnabled,
    createdAt: now,
    updatedAt: now,
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

    if (pathName === '/api/admin/affiliate-banner-images' && request.method() === 'POST') {
      state.lastUploadContentType = request.headers()['content-type'] ?? null
      state.lastUploadBytes = request.postDataBuffer()
      expect(state.lastUploadContentType).toBe('application/octet-stream')
      expect(state.lastUploadBytes).not.toBeNull()
      if (state.lastUploadBytes === null) {
        throw new Error('Expected upload request body bytes')
      }
      expect(Buffer.compare(state.lastUploadBytes, imageBytes)).toBe(0)
      const id = assetIds[state.imageUploadIndex]
      assertValidUuid(id)
      state.imageUploadIndex += 1
      await fulfillJson(route, 201, envelope({ imageAssetId: id, imageUrl: `/api/images/affiliate-banners/${id}.png` }))
      return
    }

    if (pathName === '/api/admin/affiliate-banners' && request.method() === 'GET') {
      const provider = url.searchParams.get('provider')
      const isEnabled = url.searchParams.get('isEnabled')
      const items = state.banners.filter((banner) => {
        if (provider && banner.provider !== provider) return false
        if (isEnabled && banner.isEnabled !== (isEnabled === 'true')) return false
        return true
      })
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
      const dto = makeBanner(bannerId, draft, false)
      state.banners = [dto, ...state.banners]
      await fulfillJson(route, 201, envelope(dto))
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
      const dto = state.banners.find((banner) => banner.id === id)
      if (!dto) {
        await fulfillJson(route, 404, { success: false, error: { code: 'NOT_FOUND', message: 'not found' } })
        return
      }
      Object.assign(dto, { isEnabled: body.isEnabled, updatedAt: now })
      await fulfillJson(route, 200, envelope(dto))
      return
    }

    const bannerMatch = pathName.match(/^\/api\/admin\/affiliate-banners\/([^/]+)$/)
    if (bannerMatch && request.method() === 'GET') {
      const dto = state.banners.find((banner) => banner.id === bannerMatch[1])
      await fulfillJson(route, dto ? 200 : 404, dto ? envelope(dto) : { success: false, error: { code: 'NOT_FOUND', message: 'not found' } })
      return
    }

    if (bannerMatch && request.method() === 'PATCH') {
      if (state.nextSaveFails) {
        state.nextSaveFails = false
        await fulfillJson(route, 500, { success: false, error: { code: 'INJECTED_SAVE_FAILURE', message: 'save failed' } })
        return
      }
      const dto = state.banners.find((banner) => banner.id === bannerMatch[1])
      if (!dto) {
        await fulfillJson(route, 404, { success: false, error: { code: 'NOT_FOUND', message: 'not found' } })
        return
      }
      const patch = request.postDataJSON() as BannerDraft
      assertDraftContract(patch)
      state.updateBodies.push(patch)
      Object.assign(dto, patch, {
        imageUrl: patch.imageSourceType === 'upload'
          ? `/api/images/affiliate-banners/${patch.imageAssetId}.png`
          : patch.externalImageUrl || '',
        updatedAt: now,
      })
      await fulfillJson(route, 200, envelope(dto))
      return
    }

    await fulfillJson(route, 404, { success: false, error: { code: 'UNHANDLED', message: pathName } })
  })

  await page.route('**/api/affiliate-banners**', async (route) => {
    state.affiliatePublicRequests += 1
    await route.abort('blockedbyclient')
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
  await expect(page.getByText('사용 가능으로 설정해도 아직 사이트에는 노출되지 않습니다.')).toBeVisible()
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

function adminCspImageSources(value: string): string[] {
  return value.match(/img-src[^;]*/)?.[0].split(/\s+/) ?? []
}

test.describe('admin affiliate banner integration harness', () => {
  test('admin document permits external image previews without loosening public CSP', async ({ request }) => {
    const admin = await request.get('/admin')
    const home = await request.get('/')
    const adminCsp = admin.headers()['content-security-policy'] ?? ''
    const homeCsp = home.headers()['content-security-policy'] ?? ''

    expect(admin.headers()['cache-control']).toContain('no-store')
    expect(adminCspImageSources(adminCsp)).toContain('https:')
    expect(adminCspImageSources(homeCsp)).not.toContain('https:')
  })

  test('banner management works through upload, URL preview, dirty navigation, persistence, clipboard, and public absence', async ({ page }, testInfo) => {
    const state = newState()
    await installFixtureRoutes(page, state)
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write'], { origin: 'http://localhost:3001' })

    await openAffiliateTab(page)
    await expect(page.getByText('등록된 배너가 없습니다')).toBeVisible()

    await page.getByTestId('affiliate-new').click()
    await fillBaseDraft(page, '업로드 배너')
    await page.getByTestId('source-upload').check()
    await page.getByTestId('upload-file').setInputFiles(uploadFixture)
    await waitForPreviewLoaded(page)
    await expect(page.getByTestId('preview-image')).toHaveAttribute('alt', '업로드 배너 대체 텍스트')
    await page.getByTestId('save-button').click()

    await expect(page.getByTestId(`affiliate-row-${bannerId}`)).toContainText('업로드 배너')
    await expect(page.getByTestId(`affiliate-row-${bannerId}`)).toContainText('사용 안 함')
    expect(state.imageUploadIndex).toBe(1)
    expect(state.banners[0]).toMatchObject({ id: bannerId, isEnabled: false, imageSourceType: 'upload', imageAssetId: assetIds[0] })
    expect(state.createBodies).toHaveLength(1)

    await page.reload()
    await page.getByTestId('tab-affiliate').click()
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
    await page.getByTestId('save-button').click()
    await expect(page.getByTestId(`affiliate-row-${bannerId}`)).toContainText('URL')
    expect(state.banners[0]).toMatchObject({ imageSourceType: 'url', externalImageUrl })
    expect(state.updateBodies.at(-1)).toMatchObject({ imageSourceType: 'url', imageAssetId: null, externalImageUrl })

    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await testInfo.attach(`admin-affiliate-editor-${testInfo.project.name}`, {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    })

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
    await expect(page.getByText('사용 가능으로 설정해도 아직 사이트에는 노출되지 않습니다.')).toBeVisible()
    await expect(page.getByTestId('name')).toHaveValue('이동 취소 초안')

    let publicDocumentRequests = 0
    page.on('request', (request) => {
      if (request.resourceType() === 'document' && new URL(request.url()).pathname === '/') {
        publicDocumentRequests += 1
      }
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
    expect(adminCspImageSources(publicResponse.headers()['content-security-policy'] ?? '')).not.toContain('https:')
    expect(publicDocumentRequests).toBe(1)
    await expect(page.locator('[data-testid^="affiliate-row-"]')).toHaveCount(0)
    await expect(page.locator('a[href*="vendor.example.test"]')).toHaveCount(0)
    expect(state.affiliatePublicRequests).toBe(0)

    let adminDocumentRequests = 0
    page.on('request', (request) => {
      if (request.resourceType() === 'document' && new URL(request.url()).pathname === '/admin') {
        adminDocumentRequests += 1
      }
    })
    const adminDocumentResponse = page.waitForResponse((response) =>
      response.request().resourceType() === 'document'
      && new URL(response.url()).pathname === '/admin'
    )
    await pushRouteFromPage(page, '/admin')
    await page.waitForURL(/\/admin$/)
    const adminResponse = await adminDocumentResponse
    expect(adminDocumentRequests).toBe(1)
    expect(adminResponse.headers()['cache-control']).toContain('no-store')
    expect(adminCspImageSources(adminResponse.headers()['content-security-policy'] ?? '')).toContain('https:')
  })
})
