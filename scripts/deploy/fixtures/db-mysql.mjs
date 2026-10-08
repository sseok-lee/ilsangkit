import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { readMigrationFiles } from '../db-contract.mjs'
import { createDbRuntime, readDbSnapshot } from '../db-schema.mjs'

const DB_PREFIX = 'ilsangkit_migration_test_'
const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1'])

const currentFile = fileURLToPath(import.meta.url)
const repoRoot = resolve(dirname(currentFile), '../../..')
const backendDir = join(repoRoot, 'backend')
const prismaCli = join(backendDir, 'node_modules/prisma/build/index.js')

export async function createMysqlFixture(t, label) {
  const adminUrl = parseAdminUrl(process.env.MIGRATION_TEST_ADMIN_URL)
  const dbName = `${DB_PREFIX}${safeLabel(label)}_${randomUUID().replaceAll('-', '').slice(0, 12)}`
  const url = databaseUrl(adminUrl, dbName)
  const root = mkdtempSync(join(tmpdir(), 'ilsangkit-migration-fixture-'))
  const fixtureBackend = join(root, 'backend')
  const prismaDir = join(fixtureBackend, 'prisma')
  const schemaPath = join(prismaDir, 'schema.prisma')

  cpSync(join(backendDir, 'prisma'), prismaDir, {
    recursive: true,
    dereference: true,
  })

  await checkedMysql(adminUrl, `CREATE DATABASE \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`)

  let closed = false
  async function close() {
    if (closed) return
    closed = true
    await checkedMysql(adminUrl, `DROP DATABASE IF EXISTS \`${dbName}\``)
    rmSync(root, { recursive: true, force: true })
  }

  t.after(close)

  return {
    root,
    backendDir: fixtureBackend,
    prismaDir,
    schemaPath,
    url,
    query(sql) {
      return query(adminUrl, dbName, sql)
    },
    exec(sql) {
      return mysql(adminUrl, sql, dbName)
    },
    prisma(args) {
      return prisma(fixtureBackend, url, args, schemaPath)
    },
    prismaRaw(args, env = {}) {
      return run(process.execPath, [prismaCli, ...args], {
        cwd: fixtureBackend,
        env: {
          ...process.env,
          DATABASE_URL: url,
          ...env,
        },
      })
    },
    async seedLegacyShape() {
      const deploy = await prisma(fixtureBackend, url, ['migrate', 'deploy'], schemaPath)
      if (deploy.code !== 0) throw new Error(`fixture migrate deploy failed: ${sanitizeMysqlOutput(deploy.stderr || deploy.stdout)}`)

      await checkedMysql(adminUrl, `
        INSERT INTO AffiliateBanner (id, provider, name, imageSourceType, targetUrl, altText, isEnabled, createdAt, updatedAt)
        VALUES ('11111111-1111-1111-1111-111111111111', 'coupang', 'fixture banner', 'url', 'https://example.com/banner', 'fixture alt', true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3));
        INSERT INTO WasteSchedule (city, district, targetRegion, emissionPlace, details, sourceId, updatedAt)
        VALUES ('서울', '중구', 'fixture region', 'fixture place', JSON_OBJECT('day', 'mon'), 'fixture-waste', CURRENT_TIMESTAMP(3));
        INSERT INTO Subscription (houseManageNo, pblancNo, sourceType, houseName, houseType, regionName, status, createdAt, updatedAt)
        VALUES ('HM-FIXTURE', 'PB-FIXTURE', 'APT', 'fixture house', 'APT', '서울', 'ongoing', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3));
      `, dbName)

      const files = readMigrationFiles(prismaDir)
      const runtime = createDbRuntime({ backendDir: fixtureBackend, databaseUrl: url })
      const snapshot = await readDbSnapshot(runtime)
      await runtime.close()

      const evidenceDir = join(root, 'evidence')
      const prefixDir = join(evidenceDir, 'prefixes', String(files.length).padStart(4, '0'))
      mkdirSync(prefixDir, { recursive: true })
      writeFileSync(join(prefixDir, 'structure.json'), `${JSON.stringify(snapshot.structure, null, 2)}\n`)
      writeFileSync(join(prefixDir, 'schema.prisma'), readFileSync(schemaPath, 'utf8'))

      const originalRows = await readRepresentativeRows()
      await checkedMysql(adminUrl, `
        DELETE FROM _prisma_migrations
         WHERE migration_name NOT IN (
           '202610060001_affiliate_banners',
           '202610070001_affiliate_disclosures',
           '202610080001_affiliate_banner_expiration'
         )
      `, dbName)
      const originalLedgerRows = await readLedgerRows()
      const stateRoot = join(root, 'state')
      mkdirSync(stateRoot, { recursive: true })
      const sha = 'a'.repeat(40)
      const runId = '1001'
      const runAttempt = '1'
      const expectedMissing = files.slice(0, 3).map((file) => file.name)

      return {
        context: {
          backendDir: fixtureBackend,
          prismaDir,
          stateRoot,
          evidenceDir,
          sha,
          runId,
          runAttempt,
          expectedDb: snapshot.identity,
          databaseUrl: url,
        },
        auditContext: {
          backendDir: fixtureBackend,
          prismaDir,
          stateRoot,
          evidenceDir,
          sha,
          runId,
          runAttempt,
          expectedDatabase: dbName,
          expectedServerUuid: null,
          databaseUrl: url,
        },
        originalRows,
        originalLedgerRows,
        expectedMissing,
      }
    },
    async readOriginalRows() {
      return readRepresentativeRows()
    },
    async readOriginalLedgerRows() {
      return readLedgerRows()
    },
    close,
  }

  async function readRepresentativeRows() {
    const [affiliate, waste, subscription] = await Promise.all([
      query(adminUrl, dbName, 'SELECT id, provider, name, imageSourceType, targetUrl, altText, isEnabled FROM AffiliateBanner ORDER BY id'),
      query(adminUrl, dbName, 'SELECT city, district, targetRegion, emissionPlace, sourceId FROM WasteSchedule ORDER BY id'),
      query(adminUrl, dbName, 'SELECT houseManageNo, pblancNo, sourceType, houseName, houseType, regionName, status FROM Subscription ORDER BY id'),
    ])
    return { affiliate, waste, subscription }
  }

  async function readLedgerRows() {
    return query(adminUrl, dbName, `SELECT migration_name AS migrationName, checksum, finished_at AS finishedAt, rolled_back_at AS rolledBackAt
      FROM _prisma_migrations
      WHERE migration_name IN (
        '202610060001_affiliate_banners',
        '202610070001_affiliate_disclosures',
        '202610080001_affiliate_banner_expiration'
      )
      ORDER BY migration_name`)
  }
}

function parseAdminUrl(raw) {
  if (!raw) throw new Error('MIGRATION_TEST_ADMIN_URL is required')
  const parsed = new URL(raw)
  if (parsed.protocol !== 'mysql:') throw new Error('MIGRATION_TEST_ADMIN_URL must use mysql://')
  if (!LOOPBACK_HOSTS.has(parsed.hostname)) {
    throw new Error('MIGRATION_TEST_ADMIN_URL must target a loopback host')
  }
  if (parsed.pathname !== '/mysql') {
    throw new Error('MIGRATION_TEST_ADMIN_URL must target the mysql admin database')
  }
  return parsed
}

function safeLabel(label) {
  const safe = String(label ?? 'db').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 16)
  return safe || 'db'
}

function databaseUrl(adminUrl, dbName) {
  const url = new URL(adminUrl)
  url.pathname = `/${dbName}`
  return url.toString()
}

async function query(adminUrl, dbName, sql) {
  const output = await checkedMysql(adminUrl, sql, dbName, ['--batch', '--raw'])
  return parseTabular(output.stdout)
}

function mysql(adminUrl, sql, database = null, flags = []) {
  const password = decodeURIComponent(adminUrl.password)
  const args = [
    '--protocol=TCP',
    `--host=${adminUrl.hostname}`,
    `--port=${adminUrl.port || '3306'}`,
    `--user=${decodeURIComponent(adminUrl.username)}`,
    '--default-character-set=utf8mb4',
    ...flags,
  ]
  if (database) args.push(`--database=${database}`)
  args.push('--execute', sql)
  return run('mysql', args, {
    env: {
      ...process.env,
      MYSQL_PWD: password,
    },
  })
}

async function checkedMysql(adminUrl, sql, database = null, flags = []) {
  const result = await mysql(adminUrl, sql, database, flags)
  if (result.code !== 0) {
    throw new Error(`mysql command failed with exit ${result.code}: ${sanitizeMysqlOutput(result.stderr || result.stdout)}`)
  }
  return result
}

function prisma(fixtureBackend, databaseUrl, args, schemaPath) {
  return run(process.execPath, [
    prismaCli,
    ...args,
    '--schema',
    join(fixtureBackend, 'prisma/schema.prisma'),
  ], {
    cwd: fixtureBackend,
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
    },
  })
}

function sanitizeMysqlOutput(output) {
  return String(output)
    .replace(/mysql:\/\/[^@\s]+@/g, 'mysql://<redacted>@')
    .replace(/--password=[^\s]+/g, '--password=<redacted>')
    .replace(/using a password on the command line interface can be insecure\.?/gi, '')
    .trim()
}

function run(command, args, options) {
  return new Promise((resolvePromise) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? repoRoot,
      env: options.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', (chunk) => {
      stdout += chunk
    })
    child.stderr.on('data', (chunk) => {
      stderr += chunk
    })
    child.on('error', (error) => {
      resolvePromise({ code: 127, stdout, stderr: `${stderr}${error.message}` })
    })
    child.on('close', (code) => {
      resolvePromise({ code: code ?? 1, stdout, stderr })
    })
  })
}

function parseTabular(stdout) {
  const lines = stdout.trimEnd().split('\n')
  if (lines.length === 0 || lines[0] === '') return []
  const headers = lines[0].split('\t').map(unescapeMysql)
  return lines.slice(1).map((line) => {
    const values = line.split('\t').map(unescapeMysql)
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? null]))
  })
}

function unescapeMysql(value) {
  if (value === 'NULL') return null
  return value
    .replaceAll('\\t', '\t')
    .replaceAll('\\n', '\n')
    .replaceAll('\\\\', '\\')
}
