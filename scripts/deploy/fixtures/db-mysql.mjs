import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { cpSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

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
    close,
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
