#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  buildEvidence,
  verifyEvidenceManifest,
} from './db-schema.mjs'

import { readMigrationFiles } from './db-contract.mjs'

const currentFile = fileURLToPath(import.meta.url)
const repoRoot = resolve(dirname(currentFile), '../..')

export {
  buildEvidence,
  verifyEvidenceManifest,
}

export function loadJsonEvidenceArray({ filePath, json, sourceName }) {
  if (filePath && json) throw new Error(`${sourceName}_SOURCE`)
  if (!filePath && !json) return []
  const parsed = JSON.parse(filePath ? readFileSync(filePath, 'utf8') : json)
  if (!Array.isArray(parsed)) throw new Error(`${sourceName}_FORMAT`)
  return parsed
}

export function loadCompatibilityEvidence({ filePath = process.env.COMPATIBILITY_EVIDENCE_FILE, json = process.env.COMPATIBILITY_EVIDENCE_JSON } = {}) {
  return loadJsonEvidenceArray({ filePath, json, sourceName: 'COMPATIBILITY_EVIDENCE' })
}

export function loadPreparationCompatibility({ filePath = process.env.PREPARATION_COMPATIBILITY_FILE, json = process.env.PREPARATION_COMPATIBILITY_JSON } = {}) {
  return loadJsonEvidenceArray({ filePath, json, sourceName: 'PREPARATION_COMPATIBILITY' })
}

export function assertPreparationCompatibilityPresent(prismaDir, records) {
  const contract = JSON.parse(readFileSync(join(prismaDir, 'migration-contract.json'), 'utf8'))
  const files = readMigrationFiles(prismaDir)
  if (files.length <= contract.migrations.length && records.length !== 2) {
    throw new Error('PREPARATION_COMPATIBILITY_REQUIRED')
  }
}

export async function buildEvidenceFromEnv(env = process.env) {
  const outputDir = requiredAnyEnv(env, ['MIGRATION_EVIDENCE_DIR', 'EVIDENCE_DIR'])
  const sha = requiredAnyEnv(env, ['GITHUB_SHA', 'TESTED_SHA'])
  const runId = requiredAnyEnv(env, ['RUN_ID', 'TEST_RUN_ID', 'GITHUB_RUN_ID'])
  const runAttempt = requiredAnyEnv(env, ['ATTEMPT', 'TEST_RUN_ATTEMPT', 'GITHUB_RUN_ATTEMPT'])
  const prismaDir = resolve(env.PRISMA_DIR || join(repoRoot, 'backend/prisma'))
  const compatibilityEvidence = loadCompatibilityEvidence({
    filePath: env.COMPATIBILITY_EVIDENCE_FILE,
    json: env.COMPATIBILITY_EVIDENCE_JSON,
  })
  const preparationCompatibility = loadPreparationCompatibility({
    filePath: env.PREPARATION_COMPATIBILITY_FILE,
    json: env.PREPARATION_COMPATIBILITY_JSON,
  })
  assertPreparationCompatibilityPresent(prismaDir, preparationCompatibility)
  const { createMysqlFixture } = await import('./fixtures/db-mysql.mjs')
  const cleanups = []
  const testHandle = {
    after(cleanup) {
      cleanups.push(cleanup)
    },
  }
  try {
    await buildEvidence({
      prismaDir,
      outputDir,
      sha,
      runId,
      runAttempt,
      compatibilityEvidence,
      preparationCompatibility,
      fixtureFactory: (label) => createMysqlFixture(testHandle, label),
    })
  } finally {
    for (const cleanup of cleanups.reverse()) {
      await cleanup()
    }
  }
  return { status: 'built', evidenceDir: outputDir, manifestPath: join(outputDir, 'manifest.json'), sha, runId, runAttempt }
}

export function verifyEvidenceFromEnv(env = process.env) {
  const evidenceDir = env.MIGRATION_EVIDENCE_DIR || env.EVIDENCE_DIR
  const manifestPath = resolve(env.EVIDENCE_MANIFEST || (evidenceDir ? join(evidenceDir, 'manifest.json') : ''))
  if (!env.EVIDENCE_MANIFEST && !evidenceDir) throw new Error('EVIDENCE_DIR_REQUIRED')
  if (!existsSync(manifestPath)) throw new Error('EVIDENCE_MANIFEST_MISSING')
  const prismaDir = env.PRISMA_DIR || (env.DB_BACKEND_DIR ? join(resolve(env.DB_BACKEND_DIR), 'prisma') : null)
  const manifest = verifyEvidenceManifest({
    manifestPath,
    sha: requiredAnyEnv(env, ['TESTED_SHA', 'GITHUB_SHA']),
    runId: requiredAnyEnv(env, ['TEST_RUN_ID', 'RUN_ID', 'GITHUB_RUN_ID']),
    runAttempt: requiredAnyEnv(env, ['TEST_RUN_ATTEMPT', 'ATTEMPT', 'GITHUB_RUN_ATTEMPT']),
    prismaDir,
  })
  return { status: 'verified', manifestPath, prefixes: (manifest.prefixes ?? []).length, sha: manifest.sha }
}

function requiredAnyEnv(env, keys) {
  for (const key of keys) {
    if (env[key]) return env[key]
  }
  throw new Error(`${keys[0]}_REQUIRED`)
}

async function main() {
  const command = process.argv[2]
  try {
    if (command === 'build') {
      const result = await buildEvidenceFromEnv(process.env)
      process.stdout.write(`${JSON.stringify(result)}\n`)
      return
    }
    if (command === 'verify') {
      const result = verifyEvidenceFromEnv(process.env)
      process.stdout.write(`${JSON.stringify(result)}\n`)
      return
    }
    process.stderr.write('Usage: node scripts/deploy/db-evidence.mjs build|verify\n')
    process.exitCode = 2
  } catch (error) {
    process.stderr.write(`${error.code || error.message}\n`)
    process.exitCode = 1
  }
}

if (process.argv[1] && resolve(process.argv[1]) === currentFile) {
  await main()
}
