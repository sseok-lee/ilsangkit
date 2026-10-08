import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { join, resolve } from 'node:path'

const backendDir = process.env.MIGRATION_COMPAT_BACKEND_DIR
const databaseUrl = process.env.DATABASE_URL
const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1'])

if (!backendDir) throw new Error('MIGRATION_COMPAT_BACKEND_DIR_REQUIRED')
if (!databaseUrl) throw new Error('DATABASE_URL_REQUIRED')
assertIsIsolatedDatabaseUrl(databaseUrl)

const requireFromBackend = createRequire(join(resolve(backendDir), 'package.json'))
const { PrismaClient } = requireFromBackend('@prisma/client')

test('application compatibility reads, writes, and public-query tables through target backend client and service', async () => {
  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } })
  const id = `compat-${Date.now()}-${Math.random().toString(16).slice(2)}`
  const previousDatabaseUrl = process.env.DATABASE_URL
  process.env.DATABASE_URL = databaseUrl
  try {
    await prisma.affiliateBanner.create({
      data: {
        id,
        provider: 'coupang',
        name: 'compat banner',
        imageSourceType: 'url',
        externalImageUrl: 'https://example.com/compat.png',
        targetUrl: 'https://example.com/compat',
        altText: 'compat alt',
        isEnabled: true,
      },
    })
    const banner = await prisma.affiliateBanner.findUnique({
      where: { id },
      select: { id: true, provider: true, name: true, isEnabled: true },
    })
    assert.equal(banner?.provider, 'coupang')

    const [wasteRows, subscriptionRows] = await Promise.all([
      prisma.wasteSchedule.findMany({ select: { city: true, district: true, targetRegion: true }, take: 5 }),
      prisma.subscription.findMany({ select: { houseManageNo: true, pblancNo: true, houseName: true }, take: 5 }),
    ])
    assert.ok(Array.isArray(wasteRows))
    assert.ok(Array.isArray(subscriptionRows))

    const serviceUrl = pathToFileURL(join(resolve(backendDir), 'dist/services/publicAffiliateBannerService.js'))
    serviceUrl.searchParams.set('compat', `${process.pid}-${Date.now()}`)
    const { getRandomAffiliateBanner } = await import(serviceUrl.href)
    const publicSelection = await getRandomAffiliateBanner()
    assert.equal(typeof publicSelection.serverTime, 'string')
    assert.ok(Object.hasOwn(publicSelection, 'data'))
    assert.ok(publicSelection.data === null || publicSelection.data.id)
  } finally {
    process.env.DATABASE_URL = previousDatabaseUrl
    await prisma.affiliateBanner.deleteMany({ where: { id } }).catch(() => {})
    await prisma.$disconnect()
  }
})

function assertIsIsolatedDatabaseUrl(raw) {
  const parsed = new URL(raw)
  if (parsed.protocol !== 'mysql:') throw new Error('DATABASE_URL_PROTOCOL')
  if (!LOOPBACK_HOSTS.has(parsed.hostname)) throw new Error('DATABASE_URL_LOOPBACK')
  const database = decodeURIComponent(parsed.pathname.slice(1))
  if (!database.startsWith('ilsangkit_migration_test_')) throw new Error('DATABASE_URL_ISOLATED_DB')
}
