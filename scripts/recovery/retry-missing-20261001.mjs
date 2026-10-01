import { spawn } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { hostname } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const expectedTargets = [
  'villaSale/26170/202609', 'villaSale/47940/202610', 'villaRent/52730/202610',
  'offitelSale/41800/202609', 'offitelSale/44825/202610',
  'offitelSale/47830/202610', 'offitelSale/51170/202609',
  'offitelRent/12840/202609', 'offitelRent/43750/202610',
  'offitelRent/47280/202610', 'offitelRent/48127/202610',
  'offitelRent/52210/202609', 'landSale/41220/202609',
]
const modelByKind = {
  villaSale: 'villaSaleTransaction',
  villaRent: 'villaRentTransaction',
  offitelSale: 'offitelSaleTransaction',
  offitelRent: 'offitelRentTransaction',
  landSale: 'landSaleTransaction',
}
const load = path => import(pathToFileURL(resolve(path)).href)
const targets = JSON.parse(await readFile(process.argv[2], 'utf8'))
const keys = targets.map(target => `${target.kind}/${target.lawd}/${target.ym}`)
if (JSON.stringify(keys) !== JSON.stringify(expectedTargets)) {
  throw new Error('Recovery targets differ from the reviewed 13 region-month pairs')
}
if (process.env.REAL_ESTATE_WRITE_LOCK_DIR !== '/home/project2/run/real-estate-locks') {
  throw new Error('Unexpected real estate write lock directory')
}

const { prisma } = await load('dist/lib/prisma.js')
const { recoverRealEstateWriteLock, withRealEstateWriteLock } = await load('dist/utils/realEstateWriteLock.js')
const { createSyncStats } = await load('dist/services/baseSyncService.js')
const key = process.env.OPENAPI_SERVICE_KEY
if (!key) throw new Error('Missing source API key')

async function countTarget(target) {
  return prisma[modelByKind[target.kind]].count({
    where: {
      bjdCode: { startsWith: target.lawd },
      dealYear: Number(target.ym.slice(0, 4)),
      dealMonth: Number(target.ym.slice(4)),
    },
  })
}

async function retryVillaRent(target) {
  await new Promise((resolvePromise, rejectPromise) => {
    let output = ''
    const child = spawn(process.execPath, [
      'dist/scripts/syncVillaRent.js', '--lawd', target.lawd, '--ym', target.ym,
    ], { stdio: ['ignore', 'pipe', 'pipe'], env: process.env })
    for (const stream of [child.stdout, child.stderr]) {
      stream.on('data', chunk => {
        const line = chunk.toString()
        output += line
        const destination = stream === child.stdout ? process.stdout : process.stderr
        destination.write(line)
      })
    }
    child.on('error', rejectPromise)
    child.on('close', code => {
      const failedRegion = output.includes(`[villaRent] ${target.lawd}/${target.ym} 실패:`)
      if (code === 0 && !failedRegion) resolvePromise()
      else rejectPromise(new Error(`Villa rent retry failed: exit=${code}, regionError=${failedRegion}`))
    })
  })
}

try {
  const ownerPath = join(process.env.REAL_ESTATE_WRITE_LOCK_DIR, 'real-estate-write.lock', 'owner.json')
  const owner = JSON.parse(await readFile(ownerPath, 'utf8'))
  if (owner.pid !== 3393128 || owner.hostname !== hostname() || typeof owner.token !== 'string') {
    throw new Error('Writer lock owner changed; inspect before recovery')
  }
  // The recovery helper rechecks the exact token, host, and owner process identity
  // under its recovery guard. The application DB account cannot inspect INNODB_TRX.
  const recovered = await recoverRealEstateWriteLock(owner.token)
  if (!recovered) throw new Error('Writer lock recovery refused by owner identity guard')
  console.info(JSON.stringify({ recoveredWriterLock: true, ownerPid: owner.pid }))

  await withRealEstateWriteLock('recoverMissingRegionMonths20261001', async () => {
    const regions = await prisma.region.findMany({ select: { bjdCode: true, city: true, district: true } })
    const regionMap = new Map(regions.map(region => [region.bjdCode, { city: region.city, district: region.district }]))
    for (const target of targets) {
      const before = await countTarget(target)
      console.info(JSON.stringify({ target, before, stage: 'start' }))
      if (target.kind === 'villaRent') {
        await retryVillaRent(target)
      } else {
        const kind = target.kind[0].toUpperCase() + target.kind.slice(1)
        const module = await load(`dist/scripts/sync${kind}.js`)
        const sync = module[`sync${kind}ByLawd`]
        if (typeof sync !== 'function') throw new Error(`Missing recovery function: ${kind}`)
        const stats = createSyncStats()
        await sync(target.lawd, target.ym, key, regionMap, stats)
        if (target.kind === 'landSale') await module.refreshLandAreaSummary()
        console.info(JSON.stringify({ target, stats, stage: 'source-complete' }))
      }
      const after = await countTarget(target)
      console.info(JSON.stringify({ target, before, after, stage: 'complete' }))
      await new Promise(resolvePromise => setTimeout(resolvePromise, 2000))
    }
  })
  console.info(`[recovery] completed ${targets.length}/${expectedTargets.length} reviewed targets`)
} finally {
  await prisma.$disconnect()
}
