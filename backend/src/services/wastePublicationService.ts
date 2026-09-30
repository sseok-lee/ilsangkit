import { createHash, randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import prisma from '../lib/prisma.js';
import { ConflictError, NotFoundError, ValidationError } from '../lib/errors.js';
import type { ReferenceBundle } from '../types/wasteArea.js';
import {
  buildWasteCoverageKey,
  buildWasteGenerationPlan,
  type BuiltWasteRevision,
  type WasteGenerationEvidence,
  type WasteGenerationPlan,
  type PreviousWasteRevision,
  type PreviousWasteAreaSnapshot,
  type WasteGenerationSourceRow,
  type WasteScheduleProvenanceValue,
} from './wasteGenerationBuilder.js';

export interface PrepareWasteGenerationInput {
  baseGenerationId: string | null;
  references: ReferenceBundle;
  rows: unknown[];
  provenance: WasteScheduleProvenanceValue;
  sourceComplete: boolean;
  dryRun: boolean;
  evidence?: WasteGenerationEvidence;
}

export interface WasteGenerationReviewReport {
  generationId: string | null;
  baseGenerationId: string | null;
  referenceVersion: string;
  reportHash: string;
  inputHash: string;
  canPublish: boolean;
  counts: WasteGenerationPlan['report'];
  sourceChanges: Array<{
    scheduleId: number;
    sourceId: string;
    city: string;
    district: string;
    state: string;
    provenance: string;
    contentHash: string;
    missingCompleteRuns: number;
    sourceModifiedAt: string | null;
    observedAt: string;
    contentUpdatedAt: string;
  }>;
}

export interface PrepareWasteGenerationResult {
  generationId: string | null;
  reportHash: string;
  canPublish: boolean;
  reviewReport: WasteGenerationReviewReport;
}

type Tx = Prisma.TransactionClient;
const PUBLISH_TRANSACTION_ATTEMPTS = 2;

export async function prepareWasteGeneration(
  input: PrepareWasteGenerationInput
): Promise<PrepareWasteGenerationResult> {
  const normalizedRows = normalizePreparedRows(input.rows);
  const [previousRevisions, previousAreaSnapshots] = await Promise.all([
    readPreviousRevisions(input.baseGenerationId),
    readPreviousAreaSnapshots(input.baseGenerationId),
  ]);
  const missingStreakBroken = await hasFailedAttemptSinceBase(input.baseGenerationId);
  const plan = buildWasteGenerationPlan({
    baseGenerationId: input.baseGenerationId,
    references: input.references,
    rows: normalizedRows,
    provenance: input.provenance,
    sourceComplete: input.sourceComplete,
    previousRevisions,
    previousAreaSnapshots,
    missingStreakBroken,
    evidence: input.evidence,
  });

  if (input.dryRun) {
    return {
      generationId: null,
      reportHash: plan.reportHash,
      canPublish: plan.canPublish,
      reviewReport: buildReviewReport(plan, input.baseGenerationId, null),
    };
  }

  assertWasteAreaDiscoveryWriteEnabled();

  const generationId = randomUUID();
  const history = await prisma.syncHistory.create({
    data: {
      category: 'waste_schedule',
      status: 'running',
      totalRecords: plan.report.sourceCount,
    },
  });

  try {
    await prisma.wasteGeneration.create({
      data: {
        id: generationId,
        baseGenerationId: input.baseGenerationId,
        status: 'staging',
        referenceVersion: plan.referenceVersion,
        inputHash: plan.inputHash,
        reportHash: plan.reportHash,
        sourceComplete: input.sourceComplete,
      },
    });

    const areaIdByKey = await persistAreaEntries(generationId, plan.areaEntries);
    await persistAreaRelations(generationId, plan.areaRelations, areaIdByKey);
    await persistRevisions(generationId, plan.revisions, areaIdByKey);
    await prisma.wasteGeneration.update({
      where: { id: generationId },
      data: { status: plan.canPublish ? 'ready' : 'failed' },
    });

    await prisma.syncHistory.update({
      where: { id: history.id },
      data: {
        status: plan.canPublish ? 'success' : 'failed',
        totalRecords: plan.report.sourceCount,
        newRecords: plan.report.activeCount,
        updatedRecords: plan.report.carriedMissingCount,
        errorMessage: plan.canPublish ? null : 'waste generation is not publishable',
        completedAt: new Date(),
      },
    });

    return {
      generationId,
      reportHash: plan.reportHash,
      canPublish: plan.canPublish,
      reviewReport: buildReviewReport(plan, input.baseGenerationId, generationId),
    };
  } catch (error) {
    await prisma.syncHistory.update({
      where: { id: history.id },
      data: {
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : String(error),
        completedAt: new Date(),
      },
    });
    throw error;
  }
}


function buildReviewReport(
  plan: WasteGenerationPlan,
  baseGenerationId: string | null,
  generationId: string | null
): WasteGenerationReviewReport {
  return {
    generationId,
    baseGenerationId,
    referenceVersion: plan.referenceVersion,
    reportHash: plan.reportHash,
    inputHash: plan.inputHash,
    canPublish: plan.canPublish,
    counts: plan.report,
    sourceChanges: plan.revisions.map((revision) => ({
      scheduleId: revision.scheduleId,
      sourceId: revision.sourceId,
      city: revision.city,
      district: revision.district,
      state: revision.state,
      provenance: revision.provenance,
      contentHash: revision.contentHash,
      missingCompleteRuns: revision.missingCompleteRuns,
      sourceModifiedAt: revision.sourceModifiedAt?.toISOString() ?? null,
      observedAt: revision.observedAt.toISOString(),
      contentUpdatedAt: revision.contentUpdatedAt.toISOString(),
    })),
  };
}

export function assertWasteAreaDiscoveryWriteEnabled(): void {
  if (process.env.WASTE_AREA_DISCOVERY_ENABLED !== 'true') {
    throw new ConflictError('Waste area discovery writes require WASTE_AREA_DISCOVERY_ENABLED=true');
  }
}

export async function publishWasteGeneration(
  id: string,
  expectedBase: string | null,
  approvedReportHash: string
): Promise<void> {
  assertWasteAreaDiscoveryWriteEnabled();
  await runPublishTransactionWithDeadlockRetry(async () => {
    await prisma.$transaction(async (tx) => {
      const current = await ensurePublicationRowLocked(tx);
      if ((current?.activeGenerationId ?? null) !== expectedBase) {
        throw new ConflictError('Waste generation changed');
      }

      const generation = await tx.wasteGeneration.findUnique({ where: { id } });
      if (!generation) throw new NotFoundError('Waste generation not found');
      if (generation.status !== 'ready') throw new ConflictError('Waste generation is not ready');
      if (generation.baseGenerationId !== expectedBase) {
        throw new ConflictError('Waste generation base does not match expected publication base');
      }
      if (generation.reportHash !== approvedReportHash) {
        throw new ConflictError('Approved report hash does not match generation report');
      }

      await tx.wastePublication.update({
        where: { id: 1 },
        data: { activeGenerationId: id },
      });
      await tx.wasteGeneration.update({
        where: { id },
        data: { status: 'published', publishedAt: new Date() },
      });
    });
  });
}

export async function rollbackWasteGeneration(expectedCurrent: string, previous: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const current = await ensurePublicationRowLocked(tx);
    if ((current?.activeGenerationId ?? null) !== expectedCurrent) {
      throw new ConflictError('Waste generation changed');
    }
    const previousGeneration = await tx.wasteGeneration.findUnique({ where: { id: previous } });
    if (!previousGeneration) throw new NotFoundError('Previous waste generation not found');
    if (previousGeneration.status !== 'published' || previousGeneration.sourceComplete !== true) {
      throw new ConflictError('Rollback target is not a previously published complete generation');
    }

    await tx.wastePublication.update({
      where: { id: 1 },
      data: { activeGenerationId: previous },
    });
  });
}

async function ensurePublicationRowLocked(tx: Tx): Promise<{ activeGenerationId: string | null }> {
  await tx.$executeRaw`
    INSERT IGNORE INTO WastePublication (id, activeGenerationId, updatedAt) VALUES (1, NULL, NOW(3))
  `;
  const current = await lockedPublication(tx);
  if (!current) throw new ConflictError('Waste publication singleton unavailable');
  return current;
}

async function lockedPublication(tx: Tx): Promise<{ activeGenerationId: string | null } | null> {
  const rows = await tx.$queryRaw<Array<{ activeGenerationId: string | null }>>`
    SELECT activeGenerationId FROM WastePublication WHERE id = 1 FOR UPDATE
  `;
  return rows[0] ?? null;
}

async function runPublishTransactionWithDeadlockRetry(operation: () => Promise<void>): Promise<void> {
  let sawPublicationDeadlock = false;
  for (let attempt = 1; attempt <= PUBLISH_TRANSACTION_ATTEMPTS; attempt += 1) {
    try {
      await operation();
      return;
    } catch (error) {
      if (!isMysqlDeadlock(error)) throw error;
      sawPublicationDeadlock = true;
      if (attempt === PUBLISH_TRANSACTION_ATTEMPTS) break;
    }
  }

  if (sawPublicationDeadlock) {
    throw new ConflictError('Waste generation changed');
  }
}

function isMysqlDeadlock(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError
    && error.code === 'P2010'
    && String(error.meta?.code) === '1213';
}

function normalizePreparedRows(rows: unknown[]): WasteGenerationSourceRow[] {
  return rows.map((row) => {
    if (!row || typeof row !== 'object') {
      throw new ValidationError('Waste generation row must be an object');
    }
    const candidate = row as Partial<WasteGenerationSourceRow> & { id?: number };
    const scheduleId = candidate.scheduleId ?? candidate.id;
    if (!Number.isInteger(scheduleId)) {
      throw new ValidationError('Waste generation row requires scheduleId');
    }
    if (!candidate.city || !candidate.district || !candidate.sourceId) {
      throw new ValidationError('Waste generation row requires city, district and sourceId');
    }
    const safeScheduleId = scheduleId as number;
    return {
      scheduleId: safeScheduleId,
      city: candidate.city,
      district: candidate.district,
      sourceId: candidate.sourceId,
      targetRegion: candidate.targetRegion ?? null,
      emissionPlace: candidate.emissionPlace ?? null,
      details: candidate.details ?? null,
      sourceUrl: candidate.sourceUrl ?? null,
      govCode: candidate.govCode ?? null,
      rawPayload: candidate.rawPayload ?? null,
    };
  });
}

async function readPreviousRevisions(baseGenerationId: string | null): Promise<PreviousWasteRevision[]> {
  if (!baseGenerationId) return [];
  const rows = await prisma.wasteScheduleRevision.findMany({
    where: { generationId: baseGenerationId },
  });
  return rows.map((row) => ({
    scheduleId: row.scheduleId,
    city: row.city,
    district: row.district,
    sourceId: row.sourceId,
    targetRegion: row.targetRegion,
    emissionPlace: row.emissionPlace,
    details: row.details,
    sourceUrl: row.sourceUrl,
    govCode: row.govCode,
    rawPayload: row.rawPayload,
    contentHash: row.contentHash,
    provenance: row.provenance,
    sourceModifiedAt: row.sourceModifiedAt,
    observedAt: row.observedAt,
    contentUpdatedAt: row.contentUpdatedAt,
    state: row.state,
    missingCompleteRuns: row.missingCompleteRuns,
    terminationEvidence: row.terminationEvidence,
  }));
}


async function readPreviousAreaSnapshots(baseGenerationId: string | null): Promise<PreviousWasteAreaSnapshot[]> {
  if (!baseGenerationId) return [];
  const entries = await prisma.wasteAreaEntry.findMany({
    where: { generationId: baseGenerationId },
    select: {
      areaId: true,
      level: true,
      city: true,
      district: true,
      districtCode: true,
      name: true,
      validFrom: true,
      validTo: true,
      contentFingerprint: true,
      contentUpdatedAt: true,
      area: { select: { kind: true, code: true } },
    },
  });
  if (entries.length === 0) return [];

  const keyByAreaId = new Map(entries.map((entry) => [
    entry.areaId,
    `${entry.area.kind}:${entry.area.code}`,
  ]));
  const relationKeysByAreaKey = new Map<string, string[]>();
  const relations = await prisma.wasteAreaRelation.findMany({
    where: { generationId: baseGenerationId },
    select: { fromAreaId: true, toAreaId: true, relationKey: true },
  });
  for (const relation of relations) {
    for (const areaId of [relation.fromAreaId, relation.toAreaId]) {
      if (areaId == null) continue;
      const areaKey = keyByAreaId.get(areaId);
      if (!areaKey) continue;
      const keys = relationKeysByAreaKey.get(areaKey) ?? [];
      keys.push(relation.relationKey);
      relationKeysByAreaKey.set(areaKey, keys);
    }
  }

  return entries.map((entry) => {
    const areaKey = `${entry.area.kind}:${entry.area.code}`;
    return {
      areaKey,
      metadataFingerprint: hashPreviousAreaMetadata({
        reference: {
          key: areaKey,
          kind: entry.area.kind,
          level: entry.level,
          code: entry.area.code,
          city: entry.city,
          district: entry.district,
          districtCode: entry.districtCode,
          name: entry.name,
          effectiveFrom: entry.validFrom.toISOString().slice(0, 10),
          effectiveTo: entry.validTo?.toISOString().slice(0, 10) ?? null,
        },
        relationKeys: [...(relationKeysByAreaKey.get(areaKey) ?? [])].sort(),
      }),
      contentFingerprint: entry.contentFingerprint,
      contentUpdatedAt: entry.contentUpdatedAt,
    };
  });
}

function hashPreviousAreaMetadata(value: unknown): string {
  return createHash('sha256').update(stableStringify(value)).digest('hex');
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (!value || typeof value !== 'object' || value instanceof Date) return JSON.stringify(value);
  const entries = Object.entries(value as Record<string, unknown>)
    .sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`).join(',')}}`;
}

async function hasFailedAttemptSinceBase(baseGenerationId: string | null): Promise<boolean> {
  if (!baseGenerationId) return false;
  const base = await prisma.wasteGeneration.findUnique({
    where: { id: baseGenerationId },
    select: { createdAt: true, publishedAt: true },
  });
  if (!base) return false;
  const after = base.publishedAt ?? base.createdAt;
  const failed = await prisma.syncHistory.findFirst({
    where: {
      category: 'waste_schedule',
      status: 'failed',
      completedAt: { gt: after },
    },
    orderBy: { completedAt: 'desc' },
  });
  return Boolean(failed);
}

async function persistAreaEntries(
  generationId: string,
  entries: ReturnType<typeof buildWasteGenerationPlan>['areaEntries']
): Promise<Map<string, number>> {
  const areaIdByKey = new Map<string, number>();
  if (entries.length === 0) return areaIdByKey;
  for (const batch of chunks(entries, 500)) {
    await prisma.wasteArea.createMany({
      data: batch.map((entry) => ({ kind: entry.reference.kind, code: entry.reference.code })),
      skipDuplicates: true,
    });
  }

  const areas = await prisma.wasteArea.findMany({
    where: {
      OR: entries.map((entry) => ({ kind: entry.reference.kind, code: entry.reference.code })),
    },
  });
  const keyByIdentity = new Map(entries.map((entry) => [
    `${entry.reference.kind}\u0000${entry.reference.code}`,
    entry.reference.key,
  ]));
  for (const area of areas) {
    const key = keyByIdentity.get(`${area.kind}\u0000${area.code}`);
    if (key) areaIdByKey.set(key, area.id);
  }

  for (const batch of chunks(entries, 500)) {
    await prisma.wasteAreaEntry.createMany({
      data: batch.map((entry) => ({
        generationId,
        areaId: areaIdByKey.get(entry.reference.key)!,
        level: entry.reference.level,
        city: entry.reference.city,
        district: entry.reference.district,
        districtCode: entry.reference.districtCode,
        name: entry.reference.name,
        validFrom: new Date(entry.reference.evidence.effectiveFrom),
        validTo: entry.reference.evidence.effectiveTo ? new Date(entry.reference.evidence.effectiveTo) : null,
        evidence: entry.reference.evidence as unknown as Prisma.InputJsonValue,
        indexEligible: entry.indexEligible,
        indexReason: entry.indexReason,
        contentFingerprint: entry.contentFingerprint,
        contentUpdatedAt: entry.contentUpdatedAt,
      })),
    });
  }

  return areaIdByKey;
}

async function persistAreaRelations(
  generationId: string,
  relations: ReturnType<typeof buildWasteGenerationPlan>['areaRelations'],
  areaIdByKey: Map<string, number>
): Promise<void> {
  const rows = relations.map(({ relation, relationKey }) => ({
    generationId,
    relationKey,
    fromAreaId: relation.fromKey ? areaIdByKey.get(relation.fromKey) ?? null : null,
    alias: relation.alias,
    toAreaId: areaIdByKey.get(relation.toKey)!,
    evidence: relation.evidence as unknown as Prisma.InputJsonValue,
    validFrom: new Date(relation.evidence.effectiveFrom),
    validTo: relation.evidence.effectiveTo ? new Date(relation.evidence.effectiveTo) : null,
  })).filter((row) => row.toAreaId);

  for (const batch of chunks(rows, 500)) {
    await prisma.wasteAreaRelation.createMany({ data: batch });
  }
}

async function persistRevisions(
  generationId: string,
  revisions: BuiltWasteRevision[],
  areaIdByKey: Map<string, number>
): Promise<void> {
  for (const batch of chunks(revisions, 500)) {
    await prisma.wasteScheduleRevision.createMany({
      data: batch.map((revision) => ({
        generationId,
        scheduleId: revision.scheduleId,
        city: revision.city,
        district: revision.district,
        sourceId: revision.sourceId,
        targetRegion: revision.targetRegion,
        emissionPlace: revision.emissionPlace,
        details: revision.details as Prisma.InputJsonValue,
        sourceUrl: revision.sourceUrl,
        govCode: revision.govCode,
        rawPayload: revision.rawPayload as Prisma.InputJsonValue,
        provenance: revision.provenance,
        contentHash: revision.contentHash,
        sourceModifiedAt: revision.sourceModifiedAt,
        observedAt: revision.observedAt,
        contentUpdatedAt: revision.contentUpdatedAt,
        state: revision.state,
        missingCompleteRuns: revision.missingCompleteRuns,
        terminationEvidence: revision.terminationEvidence as Prisma.InputJsonValue,
      })),
    });
  }

  const coverageRows = revisions.flatMap((revision) => revision.coverageCandidates.map((candidate) => ({
    generationId,
    scheduleId: revision.scheduleId,
    coverageKey: buildWasteCoverageKey(candidate),
    areaId: candidate.areaKey ? areaIdByKey.get(candidate.areaKey) ?? null : null,
    districtCode: candidate.areaKey ? null : candidate.districtCode,
    scope: candidate.scope,
    conditionText: candidate.conditionText,
    state: candidate.state,
    reason: candidate.reason,
    evidence: candidate.evidence as unknown as Prisma.InputJsonValue,
  })));
  for (const batch of chunks(coverageRows, 500)) {
    await prisma.wasteScheduleCoverage.createMany({ data: batch });
  }
}

function chunks<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
}
