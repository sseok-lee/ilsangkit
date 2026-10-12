import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

const IDENT = '(?:`[^`\\r\\n]+`|[A-Za-z_][A-Za-z0-9_$]*)'
const SET_LOCK_WAIT_TIMEOUT = /^SET\s+SESSION\s+lock_wait_timeout\s*=\s*5$/i
const DEFAULT_FROZEN_MIGRATIONS = [
  ['0_legacy_baseline', 'b038be2447a9fcea458672c86bf28ba3d28b689eb8684b8eb124ee477435e9fc'],
  ['202609280001_waste_area_discovery', 'c8a8814183fa044e2d1e44b1722106a61a5e966da303aa3d29ea1b8f266df70c'],
  ['202609290001_real_estate_public_url_registry', '257783a19b2a4a029c4de62fd501027fdb3a12377ba2eb9374e982d7aa1af312'],
  ['202610060001_affiliate_banners', 'e2f42f1b718366b426382ffffb74799ea54d818555bd45842fb4598b9a0ad5dc'],
  ['202610070001_affiliate_disclosures', 'ca4606fadcfdcf3b2c53625945fa2d6ac7b9ce701742398b8661670d9b3aa33d'],
  ['202610080001_affiliate_banner_expiration', 'd1f127bd13485902b53d04b5e4e1dd9b6ad288e4703875c69d76b622add64b35'],
].map(([name, checksum]) => ({ name, checksum }))

export function readMigrationFiles(prismaDir) {
  const migrationsDir = join(prismaDir, 'migrations')
  const files = readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const sqlPath = join(migrationsDir, entry.name, 'migration.sql')
      if (!existsSync(sqlPath)) throw new Error(`MIGRATION_SQL_MISSING:${entry.name}`)
      return { name: entry.name, checksum: sha256(readFileSync(sqlPath)), sqlPath }
    })
    .sort((a, b) => a.name.localeCompare(b.name))

  validateFrozenContract(prismaDir, files)
  return files
}

export function classifyHistory(files, rows, options = {}) {
  const allowBaselineGaps = options.allowBaselineGaps === true
  const byName = new Map(files.map((file, index) => [file.name, { file, index }]))
  const successByName = new Map()

  for (const row of rows) {
    const entry = byName.get(row.migrationName)
    if (!entry) throw new Error(`UNKNOWN_MIGRATION:${row.migrationName}`)
    if (row.checksum !== entry.file.checksum) throw new Error(`CHECKSUM:${row.migrationName}`)

    const finished = row.finishedAt != null
    const rolledBack = row.rolledBackAt != null
    if (!finished && !rolledBack) throw new Error(`UNFINISHED:${row.migrationName}`)

    if (rolledBack) {
      continue
    }

    if (successByName.has(row.migrationName)) throw new Error(`DUPLICATE:${row.migrationName}`)
    successByName.set(row.migrationName, row)
  }

  validateAppliedIndexes(files, successByName, options, allowBaselineGaps)

  const applied = files.filter((file) => successByName.has(file.name)).map((file) => file.name)
  const pending = files.filter((file) => !successByName.has(file.name)).map((file) => file.name)
  const prefixLength = contiguousPrefixLength(files, successByName)
  return { applied, pending, prefixLength }
}

export function validateExpansion(sql, policy) {
  validatePolicy(sql, policy)
  const statements = splitSqlStatements(sql)
  if (statements.length < 2 || !SET_LOCK_WAIT_TIMEOUT.test(statements[0])) {
    throw new Error('LOCK_WAIT_TIMEOUT')
  }

  const result = { creates: [], addsNullable: [] }
  for (const statement of statements.slice(1)) {
    if (/^SET\b/i.test(statement)) throw new Error('UNSUPPORTED_SQL')
    if (/^CREATE\b/i.test(statement)) {
      result.creates.push(parseCreateTable(statement))
      continue
    }
    if (/^ALTER\b/i.test(statement)) {
      result.addsNullable.push(parseAlterTableAddNullable(statement))
      continue
    }
    throw new Error('UNSUPPORTED_SQL')
  }

  assertMatchingTargets(result, policy)
  return result
}

export function assertMatchingTargets(actual, declared) {
  const canonical = (values) => JSON.stringify([...values].sort())
  const creates = (values) => values ?? []
  const keys = (values) => (values ?? []).map((value) => `${value.table}.${value.column}`)
  if (canonical(creates(actual.creates)) !== canonical(creates(declared.creates))) throw new Error('TARGET_MISMATCH')
  if (canonical(keys(actual.addsNullable)) !== canonical(keys(declared.addsNullable))) throw new Error('TARGET_MISMATCH')
}

function validateFrozenContract(prismaDir, files) {
  const contractPath = join(prismaDir, 'migration-contract.json')
  if (!existsSync(contractPath)) throw new Error('CONTRACT_MISSING')

  const contract = JSON.parse(readFileSync(contractPath, 'utf8'))
  if (contract.format !== 1 || !Array.isArray(contract.migrations)) throw new Error('CONTRACT_FORMAT')

  const byName = new Map(files.map((file) => [file.name, file]))
  for (const frozen of contract.migrations) {
    const file = byName.get(frozen.name)
    if (!file) throw new Error(`FROZEN_MISSING:${frozen.name}`)
    if (file.checksum !== frozen.checksum) throw new Error(`FROZEN_CHECKSUM:${frozen.name}`)
  }
}

function validateAppliedIndexes(files, successByName, options, allowBaselineGaps) {
  const appliedIndexes = files
    .map((file, index) => successByName.has(file.name) ? index : -1)
    .filter((index) => index !== -1)
  if (!appliedIndexes.length) return

  const frozen = frozenIdentitySet(options.frozenMigrations)
  for (const appliedIndex of appliedIndexes) {
    for (let index = 0; index < appliedIndex; index += 1) {
      const file = files[index]
      if (successByName.has(file.name)) continue
      if (allowBaselineGaps && frozen.has(frozenKey(file))) continue
      throw new Error('HISTORY_GAP')
    }
  }
}

function frozenIdentitySet(frozenMigrations = DEFAULT_FROZEN_MIGRATIONS) {
  return new Set(frozenMigrations.map((file) => frozenKey(file)))
}

function frozenKey(file) {
  return `${file.name}:${file.checksum}`
}

function contiguousPrefixLength(files, successByName) {
  let prefixLength = 0
  for (const file of files) {
    if (!successByName.has(file.name)) break
    prefixLength += 1
  }
  return prefixLength
}

function validatePolicy(sql, policy) {
  if (!policy || typeof policy !== 'object') throw new Error('POLICY_REQUIRED')
  if (policy.sqlSha256 !== sha256(sql)) throw new Error('SQL_CHECKSUM')
  for (const testPath of policy.compatibilityTests ?? []) {
    if (typeof testPath !== 'string' || !existsSync(resolve(testPath)) || !statSync(resolve(testPath)).isFile()) {
      throw new Error('COMPATIBILITY_TEST')
    }
  }
}

function parseCreateTable(statement) {
  if (/^CREATE\s+(TEMPORARY\s+)?TABLE\s+(IF\s+NOT\s+EXISTS\s+)?/i.test(statement) && /\bTEMPORARY\b/i.test(statement)) {
    throw new Error('CREATE_TABLE_UNSUPPORTED')
  }
  if (/^CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\b/i.test(statement)) throw new Error('CREATE_TABLE_UNSUPPORTED')
  const createMatch = statement.match(new RegExp(String.raw`^CREATE\s+TABLE\s+(${IDENT})\s*\(([\s\S]+)\)\s*(.*)$`, 'i'))
  if (!createMatch) throw new Error('CREATE_TABLE_UNSUPPORTED')
  const [, tableName, body, options] = createMatch
  if (/\b(AS\s+SELECT|LIKE)\b/i.test(statement)) throw new Error('CREATE_TABLE_UNSUPPORTED')
  if (/\b(TRIGGER|PROCEDURE|FUNCTION)\b/i.test(statement)) throw new Error('UNSUPPORTED_SQL')
  validateCreateTableBody(body)
  validateCreateTableOptions(options)
  return unquoteIdentifier(tableName)
}

function parseAlterTableAddNullable(statement) {
  const alterMatch = statement.match(new RegExp(String.raw`^ALTER\s+TABLE\s+(${IDENT})\s+ADD\s+COLUMN\s+(${IDENT})\s+([\s\S]+)$`, 'i'))
  if (!alterMatch) throw new Error('ALTER_TABLE_UNSUPPORTED')
  const [, tableName, columnName, definition] = alterMatch
  if (splitTopLevelComma(definition).length !== 1) throw new Error('ALTER_TABLE_UNSUPPORTED')
  validateColumnDefinition(definition, 'ADD_COLUMN')
  if (/\bNOT\s+NULL\b/i.test(definition)) throw new Error('ADD_COLUMN_NOT_NULL')
  if (!/\bNULL\b/i.test(definition)) throw new Error('ADD_COLUMN_NOT_NULL')
  return { table: unquoteIdentifier(tableName), column: unquoteIdentifier(columnName) }
}

function validateCreateTableBody(body) {
  for (const part of splitTopLevelComma(body)) {
    const trimmed = part.trim()
    if (!trimmed) throw new Error('CREATE_TABLE_UNSUPPORTED')
    if (isSupportedTableConstraint(trimmed)) continue
    const columnMatch = trimmed.match(new RegExp(String.raw`^${IDENT}\s+([\s\S]+)$`, 'i'))
    if (!columnMatch) throw new Error('CREATE_TABLE_UNSUPPORTED')
    validateColumnDefinition(columnMatch[1], 'CREATE_TABLE')
  }
}

function isSupportedTableConstraint(value) {
  const namedPrefix = String.raw`(?:CONSTRAINT\s+${IDENT}\s+)?`
  const patterns = [
    String.raw`^PRIMARY\s+KEY\s*\([\s\S]+\)$`,
    String.raw`^UNIQUE\s+(?:KEY|INDEX)\s+${IDENT}?\s*\([\s\S]+\)$`,
    String.raw`^(?:KEY|INDEX)\s+${IDENT}?\s*\([\s\S]+\)$`,
    String.raw`^FULLTEXT\s+(?:KEY|INDEX)\s+${IDENT}?\s*\([\s\S]+\)$`,
    String.raw`^${namedPrefix}FOREIGN\s+KEY\s*\([\s\S]+\)\s+REFERENCES\s+${IDENT}\s*\([\s\S]+\)(?:\s+ON\s+DELETE\s+(?:RESTRICT|CASCADE|SET\s+NULL|NO\s+ACTION))?(?:\s+ON\s+UPDATE\s+(?:RESTRICT|CASCADE|SET\s+NULL|NO\s+ACTION))?$`,
  ]
  return patterns.some((pattern) => new RegExp(pattern, 'i').test(value))
}

function validateColumnDefinition(definition, code) {
  if (code === 'ADD_COLUMN' && /\b(UNIQUE|PRIMARY\s+KEY|KEY|INDEX|AUTO_INCREMENT|REFERENCES|CHECK|GENERATED|VIRTUAL|STORED|CONSTRAINT)\b/i.test(definition)) {
    throw new Error('ADD_COLUMN_UNSUPPORTED')
  }
  if (/\b(REFERENCES|CHECK|GENERATED|VIRTUAL|STORED)\b/i.test(definition)) throw new Error(`${code}_UNSUPPORTED`)
  const typeMatch = definition.trim().match(/^([A-Za-z]+)(?:\s*\([^)]*\))?/)
  if (!typeMatch) throw new Error(`${code}_UNSUPPORTED`)
  const type = typeMatch[1].toUpperCase()
  const allowed = new Set([
    'BIGINT',
    'BOOLEAN',
    'CHAR',
    'DATE',
    'DATETIME',
    'DECIMAL',
    'DOUBLE',
    'ENUM',
    'FLOAT',
    'INT',
    'INTEGER',
    'JSON',
    'LONGTEXT',
    'MEDIUMTEXT',
    'SMALLINT',
    'TEXT',
    'TIMESTAMP',
    'TINYINT',
    'VARCHAR',
  ])
  if (!allowed.has(type)) throw new Error(`${code}_UNSUPPORTED`)
}

function validateCreateTableOptions(options) {
  const rest = options.trim()
  if (!rest) return
  const withoutAllowed = rest
    .replace(/\bDEFAULT\s+CHARACTER\s+SET\s+[A-Za-z0-9_]+\b/ig, '')
    .replace(/\bCHARACTER\s+SET\s+[A-Za-z0-9_]+\b/ig, '')
    .replace(/\bCOLLATE\s+[A-Za-z0-9_]+\b/ig, '')
    .trim()
  if (withoutAllowed) throw new Error('CREATE_TABLE_UNSUPPORTED')
}

export function splitSqlStatements(sql) {
  const statements = []
  let current = ''
  let quote = null
  let inLineComment = false
  let inBlockComment = false

  for (let i = 0; i < sql.length; i += 1) {
    const char = sql[i]
    const next = sql[i + 1]

    if (inLineComment) {
      if (char === '\n' || char === '\r') inLineComment = false
      continue
    }
    if (inBlockComment) {
      if (char === '*' && next === '/') {
        inBlockComment = false
        i += 1
      }
      continue
    }
    if (!quote && char === '-' && next === '-') {
      const after = sql[i + 2]
      if (after === undefined || /\s/.test(after)) {
        inLineComment = true
        i += 1
        continue
      }
    }
    if (!quote && char === '#') {
      inLineComment = true
      continue
    }
    if (!quote && char === '/' && next === '*') {
      if (sql[i + 2] === '!') throw new Error('EXECUTABLE_COMMENT')
      inBlockComment = true
      i += 1
      continue
    }
    if (!quote && startsWithDelimiter(sql, i)) throw new Error('DELIMITER')

    if (quote) {
      current += char
      if (char === '\\' && next === quote) throw new Error('BACKSLASH_ESCAPE')
      if (char === quote) {
        if (next === quote) {
          current += next
          i += 1
          continue
        }
        quote = null
      }
      continue
    }

    if (char === '"') throw new Error('ANSI_QUOTES')
    if (char === '\'') {
      quote = char
      current += char
      continue
    }
    if (char === ';') {
      pushStatement(statements, current)
      current = ''
      continue
    }
    current += char
  }

  if (quote) throw new Error('UNTERMINATED_STRING')
  if (inBlockComment) throw new Error('UNTERMINATED_COMMENT')
  pushStatement(statements, current)
  return statements
}

function pushStatement(statements, value) {
  const trimmed = value.trim()
  if (trimmed) statements.push(trimmed)
}

function splitTopLevelComma(value) {
  const parts = []
  let current = ''
  let quote = null
  let depth = 0
  for (let i = 0; i < value.length; i += 1) {
    const char = value[i]
    const next = value[i + 1]
    if (quote) {
      current += char
      if (char === quote) {
        if (next === quote) {
          current += next
          i += 1
          continue
        }
        quote = null
      }
      continue
    }
    if (char === '\'' || char === '"') {
      quote = char
      current += char
      continue
    }
    if (char === '(') depth += 1
    if (char === ')') depth -= 1
    if (char === ',' && depth === 0) {
      parts.push(current.trim())
      current = ''
      continue
    }
    current += char
  }
  if (quote) throw new Error('UNTERMINATED_STRING')
  parts.push(current.trim())
  return parts
}

function startsWithDelimiter(sql, index) {
  if (index > 0 && /[A-Za-z0-9_]/.test(sql[index - 1])) return false
  return sql.slice(index, index + 9).toUpperCase() === 'DELIMITER'
}

function unquoteIdentifier(value) {
  return value.startsWith('`') ? value.slice(1, -1).replace(/``/g, '`') : value
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}
