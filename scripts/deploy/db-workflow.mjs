import { appendFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export function evidenceArtifactName(sha, attempt) {
  if (!/^[a-f0-9]{40}$/.test(sha ?? '') || !/^[1-9][0-9]*$/.test(String(attempt ?? ''))) throw new Error('TEST_RUN_INPUT')
  return `db-evidence-${sha}-${attempt}`
}

export function assertTestRun(run, { repository, sha, runId, runAttempt }) {
  evidenceArtifactName(sha, run.run_attempt)
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository ?? '') || !/^[1-9][0-9]*$/.test(String(runId))) throw new Error('TEST_RUN_INPUT')
  if (String(run.id) !== String(runId) || run.head_sha !== sha || run.head_branch !== 'main' ||
      run.event !== 'push' || run.status !== 'completed' || run.conclusion !== 'success' ||
      run.name !== 'Test' || run.path !== '.github/workflows/test.yml' ||
      run.repository?.full_name !== repository || run.head_repository?.full_name !== repository ||
      (runAttempt !== undefined && String(run.run_attempt) !== String(runAttempt))) throw new Error('TEST_RUN_PROVENANCE')
  return { sha, runId: String(run.id), runAttempt: String(run.run_attempt), artifactName: evidenceArtifactName(sha, run.run_attempt) }
}

export async function loadTestRun(env = process.env) {
  const repository = env.GITHUB_REPOSITORY
  const runId = env.TEST_RUN_ID
  const sha = env.TESTED_SHA
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository ?? '') || !/^[1-9][0-9]*$/.test(runId ?? '')) throw new Error('TEST_RUN_INPUT')
  const response = await fetch(`https://api.github.com/repos/${repository}/actions/runs/${runId}`, {
    headers: { Authorization: `Bearer ${env.GH_TOKEN}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
    signal: AbortSignal.timeout(30_000),
  })
  if (!response.ok) throw new Error('TEST_RUN_API')
  return assertTestRun(await response.json(), { repository, sha, runId, runAttempt: env.TEST_RUN_ATTEMPT })
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv[2] !== 'verify-run') throw new Error('TEST_RUN_OPERATION')
    const result = await loadTestRun()
    if (!process.env.GITHUB_OUTPUT) throw new Error('TEST_RUN_OUTPUT')
    appendFileSync(process.env.GITHUB_OUTPUT, `sha=${result.sha}\nrun_id=${result.runId}\nrun_attempt=${result.runAttempt}\nartifact_name=${result.artifactName}\n`)
    process.stdout.write('TEST_RUN_VERIFIED\n')
  } catch (error) {
    process.stderr.write(`${/^TEST_RUN_[A-Z_]+$/.test(error.message) ? error.message : 'TEST_RUN_FAILED'}\n`)
    process.exitCode = 1
  }
}
