import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const expectedTypes = ['apt-sale', 'apt-rent', 'villa-sale', 'villa-rent', 'offitel-sale', 'offitel-rent']
const { prisma } = await import(pathToFileURL(resolve('dist/lib/prisma.js')).href)

try {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT type, COUNT(*) AS total, MAX(updatedAt) AS newest,
           TIMESTAMPDIFF(SECOND, MAX(updatedAt), NOW()) AS ageSeconds
    FROM RealEstateBuildingSummaryV2
    GROUP BY type
  `)
  const byType = new Map(rows.map(row => [row.type, row]))
  const counts = expectedTypes.map(type => {
    const row = byType.get(type)
    return {
      type,
      total: Number(row?.total ?? 0),
      newest: row?.newest?.toISOString() ?? null,
      ageSeconds: Number(row?.ageSeconds ?? NaN),
    }
  })
  console.info(JSON.stringify({ stage: 'summary-counts', counts }))
  if (counts.some(row => row.total <= 0 || !Number.isFinite(row.ageSeconds) || row.ageSeconds < 0 || row.ageSeconds > 2400)) {
    throw new Error('A summary type is empty or was not refreshed in the last 40 minutes')
  }

  const missing = await prisma.$queryRawUnsafe(`
    SELECT COUNT(*) AS total
    FROM RealEstateBuildingSummaryV2 s
    LEFT JOIN RealEstatePublicUrl u ON u.type = s.type AND u.buildingKey = s.buildingKey
    WHERE u.id IS NULL
  `)
  const missingUrls = Number(missing[0]?.total)
  console.info(JSON.stringify({ stage: 'summary-url-mapping', missingUrls }))
  if (!Number.isSafeInteger(missingUrls) || missingUrls !== 0) {
    throw new Error('Summary rows without public URL mappings remain')
  }
} finally {
  await prisma.$disconnect()
}
