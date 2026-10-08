import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { createMysqlFixture } from './fixtures/db-mysql.mjs'

const repoRoot = new URL('../..', import.meta.url).pathname
const contractPath = join(repoRoot, 'backend/prisma/migration-contract.json')

test('fixture refuses unsafe admin URLs before shelling out', async (t) => {
  const original = process.env.MIGRATION_TEST_ADMIN_URL
  t.after(() => {
    if (original === undefined) {
      delete process.env.MIGRATION_TEST_ADMIN_URL
    } else {
      process.env.MIGRATION_TEST_ADMIN_URL = original
    }
  })

  process.env.MIGRATION_TEST_ADMIN_URL = 'mysql://root:secret@db.example.com:3306/mysql'

  await assert.rejects(
    () => createMysqlFixture(t, 'bad-host'),
    /loopback host/,
  )
})

test('fixture surfaces sanitized mysql failures', async (t) => {
  const db = await createMysqlFixture(t, 'failure')

  await assert.rejects(
    () => db.query('SELECT * FROM MissingTable'),
    (error) => {
      assert.match(error.message, /mysql command failed with exit/)
      assert.match(error.message, /MissingTable/)
      assert.doesNotMatch(error.message, /migration-test-only/)
      assert.doesNotMatch(error.message, /--password=/)
      return true
    },
  )
})

test('fresh replay creates the application schema', async (t) => {
  const db = await createMysqlFixture(t, 'baseline')
  const contract = JSON.parse(await readFile(contractPath, 'utf8'))

  const result = await db.prisma(['migrate', 'deploy'])

  assert.equal(result.code, 0, result.stderr || result.stdout)
  assert.equal((await db.prisma(['migrate', 'status'])).code, 0)

  const existingTables = await db.query(
    `SELECT table_name AS tableName
       FROM information_schema.tables
      WHERE table_schema = DATABASE()
        AND table_name IN ("AffiliateBanner", "WasteSchedule", "WasteScheduleCoverage", "RealEstatePublicUrl")`,
  )
  assert.deepEqual(existingTables.map((row) => row.tableName).sort(), [
    'AffiliateBanner',
    'RealEstatePublicUrl',
    'WasteSchedule',
    'WasteScheduleCoverage',
  ])

  const subscriptionColumns = await db.query(
    `SELECT column_name AS columnName, is_nullable AS nullable
       FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = "Subscription"
        AND column_name IN ("publicRental", "supersededById")`,
  )
  assert.deepEqual(subscriptionColumns.map((row) => [row.columnName, row.nullable]).sort(), [
    ['publicRental', 'YES'],
    ['supersededById', 'YES'],
  ])

  const fks = await db.query(
    `SELECT constraint_name AS constraintName
       FROM information_schema.referential_constraints
      WHERE constraint_schema = DATABASE()
        AND table_name = "WasteScheduleCoverage"
        AND referenced_table_name IN ("WasteScheduleRevision", "WasteAreaEntry")`,
  )
  assert.deepEqual(fks.map((row) => row.constraintName).sort(), [
    'WasteScheduleCoverage_areaEntry_fkey',
    'WasteScheduleCoverage_revision_fkey',
  ])

  const enumColumns = await db.query(
    `SELECT column_name AS columnName, column_type AS columnType
       FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = "WasteScheduleCoverage"
        AND column_name IN ("scope", "state")`,
  )
  assert.deepEqual(enumColumns.map((row) => [row.columnName, row.columnType]).sort(), [
    ['scope', "enum('whole','partial','conditional')"],
    ['state', "enum('verified','unresolved','conflict')"],
  ])

  const datamodelDiff = await db.prismaRaw([
    'migrate',
    'diff',
    '--from-schema-datasource',
    db.schemaPath,
    '--to-schema-datamodel',
    db.schemaPath,
    '--exit-code',
  ])
  assert.equal(datamodelDiff.code, 0, datamodelDiff.stderr || datamodelDiff.stdout)

  const expectedNgram = contract.ngram.map((entry) => ({
    tableName: entry.table,
    indexName: entry.index,
    columns: entry.columns.join(','),
    parser: entry.parser,
  })).sort(compareIndexRows)

  const fulltextIndexes = await db.query(
    `SELECT table_name AS tableName, index_name AS indexName, GROUP_CONCAT(column_name ORDER BY seq_in_index) AS columns
       FROM information_schema.statistics
      WHERE table_schema = DATABASE()
        AND index_type = "FULLTEXT"
      GROUP BY table_name, index_name
      ORDER BY table_name, index_name`,
  )
  assert.deepEqual(fulltextIndexes.map((row) => ({
    tableName: row.tableName,
    indexName: row.indexName,
    columns: row.columns,
    parser: 'ngram',
  })).sort(compareIndexRows), expectedNgram)

  for (const expected of expectedNgram) {
    const createTable = await db.exec(`SHOW CREATE TABLE \`${expected.tableName}\``)
    const fulltextLine = createTable.stdout
      .split('\n')
      .find((line) => line.includes(`FULLTEXT KEY \`${expected.indexName}\``))
    assert.ok(fulltextLine, `${expected.tableName}.${expected.indexName} should exist`)
    const normalizedLine = fulltextLine.replace(/\s+/g, '')
    assert.ok(
      normalizedLine.includes(`FULLTEXTKEY\`${expected.indexName}\`(${expected.columns.split(',').map((column) => `\`${column}\``).join(',')})`),
      `${expected.tableName}.${expected.indexName} should preserve column order`,
    )
    assert.ok(
      normalizedLine.includes(`WITHPARSER\`${expected.parser}\``),
      `${expected.tableName}.${expected.indexName} should use ${expected.parser}`,
    )
  }

  const insertToilet = await db.exec(
    `INSERT INTO Toilet (id, name, address, roadAddress, city, district, sourceId, updatedAt)
     VALUES ("toilet-fixture", "서울역 화장실", "서울 중구 세종대로", "서울특별시 중구 세종대로", "서울", "중구", "toilet-fixture", CURRENT_TIMESTAMP(3))`,
  )
  assert.equal(insertToilet.code, 0, insertToilet.stderr || insertToilet.stdout)
  const insertWasteSchedule = await db.exec(
    `INSERT INTO WasteSchedule (city, district, targetRegion, emissionPlace, details, sourceId, updatedAt)
     VALUES ("서울", "중구", "서울역 주변", "공동주택 배출장", JSON_OBJECT("day", "월"), "waste-fixture", CURRENT_TIMESTAMP(3))`,
  )
  assert.equal(insertWasteSchedule.code, 0, insertWasteSchedule.stderr || insertWasteSchedule.stdout)
  const toiletMatches = await db.query(
    'SELECT COUNT(*) AS n FROM Toilet WHERE MATCH(name, address, roadAddress) AGAINST (\'"서울역"\' IN BOOLEAN MODE)',
  )
  const wasteMatches = await db.query(
    'SELECT COUNT(*) AS n FROM WasteSchedule WHERE MATCH(targetRegion, emissionPlace) AGAINST (\'"서울역"\' IN BOOLEAN MODE)',
  )
  assert.equal(Number(toiletMatches[0].n), 1)
  assert.equal(Number(wasteMatches[0].n), 1)
})

function compareIndexRows(a, b) {
  return `${a.tableName}.${a.indexName}`.localeCompare(`${b.tableName}.${b.indexName}`)
}
