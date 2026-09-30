import { prisma } from '../lib/prisma.js';
import { readSummaryMode, type SummaryReadMode } from '../lib/realEstateSummaryStore.js';
import { assertRealEstateUrlsReady } from './realEstateUrlRegistry.js';

export interface SummaryReadinessResult {
  mode: SummaryReadMode;
  table: 'RealEstateBuildingSummaryV2';
  ready: boolean;
  reason?: string;
  runId?: string;
  validatedAt?: Date | null;
  rowCount?: number;
}

interface StateRow {
  status: string;
  runId: string;
  validatedAt: Date | null;
}

type SummaryReadinessEnv = typeof process.env;

export async function checkActiveSummaryReadiness(env: SummaryReadinessEnv = process.env): Promise<SummaryReadinessResult> {
  const mode = readSummaryMode(env);
  const table = 'RealEstateBuildingSummaryV2' as const;
  const stateRows = await prisma.$queryRaw<StateRow[]>`
    SELECT status, runId, validatedAt
    FROM RealEstateSummaryState
    WHERE id = 1
    LIMIT 1
  `;
  const state = stateRows[0];
  if (!state) return { mode, table, ready: false, reason: 'missing-summary-state' };
  if (state.status !== 'ready') {
    return { mode, table, ready: false, reason: `summary-state-${state.status}`, runId: state.runId, validatedAt: state.validatedAt };
  }
  if (!state.validatedAt) {
    return { mode, table, ready: false, reason: 'summary-not-validated', runId: state.runId, validatedAt: state.validatedAt };
  }

  const countRows = await prisma.$queryRaw<[{ cnt: bigint }]>`
    SELECT COUNT(*) AS cnt
    FROM RealEstateBuildingSummaryV2
  `;
  const rowCount = Number(countRows[0]?.cnt ?? 0);
  if (rowCount <= 0) {
    return { mode, table, ready: false, reason: 'summary-v2-empty', runId: state.runId, validatedAt: state.validatedAt, rowCount };
  }
  try {
    await assertRealEstateUrlsReady(env);
  } catch {
    return { mode, table, ready: false, reason: 'public-url-registry-not-ready', runId: state.runId, validatedAt: state.validatedAt, rowCount };
  }
  return { mode, table, ready: true, runId: state.runId, validatedAt: state.validatedAt, rowCount };
}

export async function assertActiveSummaryReady(env: SummaryReadinessEnv = process.env): Promise<SummaryReadinessResult> {
  const result = await checkActiveSummaryReadiness(env);
  if (!result.ready) {
    throw new Error(`RealEstateBuildingSummaryV2 is not ready for ${result.mode} mode: ${result.reason ?? 'unknown'}`);
  }
  return result;
}
