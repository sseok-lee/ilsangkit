import { expect, test, type APIRequestContext, type Page, type Response } from '@playwright/test'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

type SameNameBuildingInfo = {
  buildingKey?: string | null
  buildingName: string
  bjdCode?: string | null
  dongName?: string | null
  jibun?: string | null
  roadName?: string | null
}

type SameNameSeed = {
  label?: string
  type?: string
  propertyType?: string
  citySlug: string
  districtSlug: string
  buildingName: string
  bjdCode: string
  dongName: string
  jibun: string
  url?: string
  buildingKey?: string
}

type SeedReport = {
  urls?: {
    health?: string
    realEstateDetails?: Record<string, Array<{ label?: string, url?: string, currentUrl?: string, oldReleaseUrl?: string, addressKey?: string, buildingKey?: string }>>
    land?: { queryA?: string, queryB?: string, page2?: string, transactionsPage2?: string }
  }
  sameNameBuildings?: SameNameSeed[] | Record<string, SameNameSeed>
  land?: { queryAPath?: string, queryBPath?: string, page2Path?: string, expectedA?: string, expectedB?: string, expectedPage2?: string }
}

const releaseBaseUrl = process.env.C3_RELEASE_BASE_URL
const releaseBackUrl = process.env.C3_RELEASE_BACK_URL
const seedReportPath = process.env.C3_RELEASE_SEED_REPORT
  || resolve(process.cwd(), '../.superpowers/sdd/2026-09-29-branch-review-fixes/c3-release-fixture-report.json')

function absoluteUrl(baseUrl: string, path: string): string {
  return new URL(path, baseUrl).toString()
}

function readSeedReport(): SeedReport {
  if (!existsSync(seedReportPath)) throw new Error(`C3 seed report is required at ${seedReportPath}`)
  return JSON.parse(readFileSync(seedReportPath, 'utf8')) as SeedReport
}

function sameName(seedReport: SeedReport, label: 'a' | 'b'): SameNameSeed {
  const source = seedReport.sameNameBuildings
  const identity = Array.isArray(source)
    ? source.find((item) => item.label === label || item.label === `address-${label}`)
    : source?.[label] ?? source?.[`address-${label}`]
  if (!identity) {
    const fallback = seedReport.urls?.realEstateDetails?.['apt-sale']?.[label === 'a' ? 0 : 1]
    if (!fallback?.currentUrl && !fallback?.url) throw new Error(`seed report missing same-name address ${label}`)
    return {
      label,
      type: 'apt-sale',
      propertyType: 'apt',
      citySlug: 'seoul',
      districtSlug: 'gangnam',
      buildingName: 'C3공통주택',
      bjdCode: '1168010100',
      dongName: '역삼동',
      jibun: label === 'a' ? '101-1' : '202-2',
      url: fallback.currentUrl ?? fallback.url,
      buildingKey: fallback.buildingKey,
    }
  }
  return identity
}

function buildingKey(identity: SameNameSeed): string {
  if (identity.buildingKey) return identity.buildingKey
  const propertyType = identity.propertyType ?? (identity.type?.startsWith('apt') ? 'apt' : identity.type ?? 'apt')
  return createHash('sha256').update([
    propertyType,
    identity.bjdCode,
    identity.buildingName,
    identity.dongName.trim(),
    identity.jibun.trim(),
  ].join('\x1f')).digest('hex')
}

function encodedPathPart(value: string): string {
  return encodeURIComponent(value.normalize('NFC'))
}

function detailPath(identity: SameNameSeed): string {
  if (identity.url && /\/[a-f0-9]{64}$/.test(identity.url)) return identity.url
  const type = identity.type ?? 'apt-sale'
  return `/real-estate/${type}/${identity.citySlug}/${identity.districtSlug}/${encodedPathPart(identity.buildingName)}/${buildingKey(identity)}`
}


async function fetchBuildingInfo(request: APIRequestContext, identity: SameNameSeed): Promise<SameNameBuildingInfo> {
  const type = identity.type ?? 'apt-sale'
  const url = new URL(`/api/real-estate/${type}/building-info`, releaseBaseUrl)
  url.searchParams.set('bjdCode', identity.bjdCode)
  url.searchParams.set('buildingName', identity.buildingName)
  url.searchParams.set('buildingKey', buildingKey(identity))
  const response = await request.get(url.toString())
  expect(response.ok()).toBe(true)
  const body = await response.json() as { success?: boolean, data?: SameNameBuildingInfo }
  expect(body.success).toBe(true)
  expect(body.data?.buildingKey).toBe(buildingKey(identity))
  expect(body.data?.buildingName).toBe(identity.buildingName)
  expect(body.data?.jibun).toBe(identity.jibun)
  return body.data!
}

function visibleAddress(info: SameNameBuildingInfo): string {
  return info.roadName || info.jibun || ''
}

function expectVisibleSameNameBody(body: string, info: SameNameBuildingInfo): void {
  expect(body).toContain(info.buildingName)
  const address = visibleAddress(info)
  expect(address).not.toBe('')
  expect(body).toContain(address)
}

function releaseMarker(response: Response | null): string {
  const marker = response?.headers()['x-ilsangkit-release-id'] ?? ''
  expect(marker).not.toBe('')
  return marker
}

function expectNavigationResponseWhenPresent(response: Response | null, expectedReleaseMarker: string): void {
  if (!response) return
  expect(response.ok()).toBe(true)
  expect(releaseMarker(response)).toBe(expectedReleaseMarker)
}

function expectedBrowserUrl(pathOrUrl: string): string {
  return absoluteUrl(releaseBaseUrl!, pathOrUrl)
}

async function hydrated(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const root = document.querySelector('#__nuxt') as Element & { __vue_app__?: { config: { globalProperties: { $nuxt?: { isHydrating: boolean } } } } }
    return root?.__vue_app__?.config.globalProperties.$nuxt?.isHydrating === false
  })
}

async function visibleBody(page: Page): Promise<string> {
  await hydrated(page)
  return (await page.locator('body').innerText()).replace(/\s+/g, ' ')
}

async function expectLandQuery(page: Page, expectedText: string): Promise<string> {
  const body = await visibleBody(page)
  expect(body).toContain('역삼동')
  expect(body).toContain(expectedText)
  const transactions = page.locator('section').filter({ has: page.locator('#land-tx-keyword') })
  await expect(transactions.getByRole('columnheader', { name: '거래금액', exact: true })).toBeVisible()
  await expect(transactions.getByRole('cell').first()).toBeVisible()
  return body
}

test.describe('release transition browser probes', () => {
  test.skip(!releaseBaseUrl, 'C3 preliminary stage only: set C3_RELEASE_BASE_URL after C2/B4 gates to run real proxy acceptance')

  test('land query route proves cold, warm, query change, page 2, and back content', async ({ page }) => {
    const seedReport = readSeedReport()
    const queryA = seedReport.urls?.land?.queryA ?? seedReport.land?.queryAPath
    const queryB = seedReport.urls?.land?.queryB ?? seedReport.land?.queryBPath
    const page2 = seedReport.urls?.land?.page2 ?? seedReport.urls?.land?.transactionsPage2 ?? seedReport.land?.page2Path ?? process.env.C3_RELEASE_LAND_PAGE2_URL
    if (!queryA || !queryB || !page2) throw new Error('C3 land probes require queryA, queryB, and page2 paths from the seed report or C3_RELEASE_LAND_PAGE2_URL')

    const coldResponse = await page.goto(queryA, { waitUntil: 'domcontentloaded' })
    expect(coldResponse?.ok()).toBe(true)
    const coldMarker = releaseMarker(coldResponse)
    const coldBody = await expectLandQuery(page, seedReport.land?.expectedA ?? 'A')

    const warmResponse = await page.goto(queryA, { waitUntil: 'domcontentloaded' })
    expect(warmResponse?.ok()).toBe(true)
    expect(releaseMarker(warmResponse)).toBe(coldMarker)
    await expectLandQuery(page, seedReport.land?.expectedA ?? 'A')

    const queryBResponse = await page.goto(queryB, { waitUntil: 'domcontentloaded' })
    expect(queryBResponse?.ok()).toBe(true)
    expect(releaseMarker(queryBResponse)).toBe(coldMarker)
    const queryBBody = await expectLandQuery(page, seedReport.land?.expectedB ?? 'B')
    expect(queryBBody).not.toBe(coldBody)

    const page2Response = await page.goto(page2, { waitUntil: 'domcontentloaded' })
    expect(page2Response?.ok()).toBe(true)
    expect(releaseMarker(page2Response)).toBe(coldMarker)
    const page2Body = await expectLandQuery(page, seedReport.land?.expectedPage2 ?? seedReport.land?.expectedA ?? 'A')
    expect(page2Body).not.toBe(queryBBody)

    const backResponse = await page.goBack({ waitUntil: 'domcontentloaded' })
    expectNavigationResponseWhenPresent(backResponse, coldMarker)
    await expect(page).toHaveURL(expectedBrowserUrl(queryB))
    const restoredQueryBBody = await expectLandQuery(page, seedReport.land?.expectedB ?? 'B')
    expect(restoredQueryBBody).toContain(seedReport.land?.expectedB ?? 'B')
    expect(restoredQueryBBody).not.toBe(page2Body)

    if (releaseBackUrl) {
      const rollbackResponse = await page.goto(absoluteUrl(releaseBackUrl, page2), { waitUntil: 'domcontentloaded' })
      expect(rollbackResponse?.ok()).toBe(true)
      releaseMarker(rollbackResponse)
      await expectLandQuery(page, seedReport.land?.expectedPage2 ?? seedReport.land?.expectedA ?? 'A')
    }
  })

  test('same-name keyed details A and B remain distinct and expose retained assets', async ({ page, request }) => {
    const seedReport = readSeedReport()
    const addressA = sameName(seedReport, 'a')
    const addressB = sameName(seedReport, 'b')
    const pathA = detailPath(addressA)
    const pathB = detailPath(addressB)
    expect(pathA).not.toBe(pathB)

    const [infoA, infoB] = await Promise.all([
      fetchBuildingInfo(request, addressA),
      fetchBuildingInfo(request, addressB),
    ])
    expect(infoA.buildingKey).not.toBe(infoB.buildingKey)
    expect(`${infoA.dongName ?? ''} ${infoA.jibun ?? ''}`).not.toBe(`${infoB.dongName ?? ''} ${infoB.jibun ?? ''}`)
    expect(visibleAddress(infoA)).not.toBe(visibleAddress(infoB))

    const responseA = await page.goto(pathA, { waitUntil: 'domcontentloaded' })
    expect(responseA?.ok()).toBe(true)
    const marker = releaseMarker(responseA)
    const bodyA = await visibleBody(page)
    expectVisibleSameNameBody(bodyA, infoA)

    const responseB = await page.goto(pathB, { waitUntil: 'domcontentloaded' })
    expect(responseB?.ok()).toBe(true)
    expect(releaseMarker(responseB)).toBe(marker)
    const bodyB = await visibleBody(page)
    expectVisibleSameNameBody(bodyB, infoB)
    expect(bodyB).not.toBe(bodyA)

    const backResponse = await page.goBack({ waitUntil: 'domcontentloaded' })
    expectNavigationResponseWhenPresent(backResponse, marker)
    await expect(page).toHaveURL(new RegExp(buildingKey(addressA)))
    const restoredBodyA = await visibleBody(page)
    expectVisibleSameNameBody(restoredBodyA, infoA)
    expect(restoredBodyA).not.toBe(bodyB)

    const assetPath = await page.locator('script[src^="/_nuxt/"], link[href^="/_nuxt/"]').first().evaluate((node) => {
      if (node instanceof HTMLScriptElement) return node.src
      if (node instanceof HTMLLinkElement) return node.href
      return ''
    })
    expect(assetPath).toContain('/_nuxt/')
    const assetResponse = await request.get(assetPath)
    expect(assetResponse.ok()).toBe(true)
  })
})
