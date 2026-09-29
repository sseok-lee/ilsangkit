import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import prisma from '../lib/prisma.js';
import {
  prepareWasteGeneration,
  publishWasteGeneration,
} from '../services/wastePublicationService.js';
import type { ReferenceBundle } from '../types/wasteArea.js';
import { assertWasteAreaDiscoveryWriteEnabled } from '../services/wastePublicationService.js';
import { loadValidatedWasteReferences, type WasteReferenceInput, type WasteReferenceMetadata } from '../services/wasteReferenceLoader.js';

interface BackfillOptions {
  dryRun?: boolean;
  publish?: boolean;
  expectedBaseGenerationId?: string | null;
  approvalReportHash?: string;
  references?: ReferenceBundle;
  referenceMetadata?: WasteReferenceMetadata;
  referenceInput?: WasteReferenceInput;
  reportOut?: string;
}

interface BackfillResult {
  sourceRows: number;
  generationId: string | null;
  reportHash: string;
  canPublish: boolean;
  reviewReport?: unknown;
}

export async function backfillWasteAreas(options: BackfillOptions = {}): Promise<BackfillResult> {
  const dryRun = options.dryRun ?? true;
  const expectedBaseGenerationId = options.expectedBaseGenerationId ?? null;
  if (!dryRun || options.publish) {
    assertWasteAreaDiscoveryWriteEnabled();
  }
  const rows = await prisma.wasteSchedule.findMany({
    where: { sourceId: { not: { startsWith: 'seed-waste-schedule-' } } },
    orderBy: { id: 'asc' },
  });
  const loadedReferences = await resolveWasteReferences(options, dryRun);
  const prepared = await prepareWasteGeneration({
    baseGenerationId: expectedBaseGenerationId,
    references: loadedReferences.references,
    rows: rows.map((row) => ({
      scheduleId: row.id,
      city: row.city,
      district: row.district,
      sourceId: row.sourceId,
      targetRegion: row.targetRegion,
      emissionPlace: row.emissionPlace,
      details: row.details,
      sourceUrl: row.sourceUrl,
      govCode: row.govCode,
      rawPayload: null,
    })),
    provenance: 'legacy',
    sourceComplete: true,
    dryRun,
    evidence: { reference: loadedReferences.metadata },
  });

  if (options.reportOut) {
    await writeReviewReport(options.reportOut, prepared.reviewReport);
  }

  if (options.publish) {
    if (!prepared.generationId) {
      throw new Error('Backfill publish requires a persisted prepared generation');
    }
    if (!options.approvalReportHash) {
      throw new Error('approvalReportHash is required to publish waste backfill');
    }
    await publishWasteGeneration(prepared.generationId, expectedBaseGenerationId, options.approvalReportHash);
  }

  return {
    sourceRows: rows.length,
    generationId: prepared.generationId,
    reportHash: prepared.reportHash,
    canPublish: prepared.canPublish,
    reviewReport: prepared.reviewReport,
  };
}


export function redactBackfillResultForLog(result: BackfillResult): Omit<BackfillResult, 'reviewReport'> {
  const loggedResult: BackfillResult = { ...result };
  delete loggedResult.reviewReport;
  return loggedResult;
}

async function writeReviewReport(reportOut: string, report: unknown): Promise<void> {
  const resolved = path.resolve(reportOut);
  await mkdir(path.dirname(resolved), { recursive: true });
  await writeFile(resolved, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

async function resolveWasteReferences(
  options: Pick<BackfillOptions, 'references' | 'referenceMetadata' | 'referenceInput'>,
  dryRun: boolean
): Promise<{ references: ReferenceBundle; metadata?: WasteReferenceMetadata }> {
  if (options.references) {
    return { references: options.references, metadata: options.referenceMetadata };
  }
  if (!options.referenceInput) {
    if (dryRun) {
      return { references: { version: 'dry-run-empty-reference', areas: [], relations: [], sourceAreaKinds: {} } };
    }
    throw new Error('Explicit validated reference input is required before waste backfill writes');
  }
  return loadValidatedWasteReferences(options.referenceInput);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const dryRun = process.argv.includes('--dry-run') || !process.argv.includes('--write');
  const publish = process.argv.includes('--publish');
  const approvalReportHashArg = process.argv.find((arg) => arg.startsWith('--approval-report-hash='));
  const expectedBaseArg = process.argv.find((arg) => arg.startsWith('--expected-base='));
  const referencePath = process.argv.find((arg) => arg.startsWith('--reference-path='))?.split('=')[1];
  const manifestPath = process.argv.find((arg) => arg.startsWith('--reference-manifest-path='))?.split('=')[1];
  const checksumsPath = process.argv.find((arg) => arg.startsWith('--reference-checksums-path='))?.split('=')[1];
  const referenceInput = referencePath && manifestPath && checksumsPath
    ? { referencePath, manifestPath, checksumsPath }
    : undefined;
  const reportOut = process.argv.find((arg) => arg.startsWith('--report-out='))?.split('=')[1];

  backfillWasteAreas({
    dryRun,
    publish,
    approvalReportHash: approvalReportHashArg?.split('=')[1],
    expectedBaseGenerationId: expectedBaseArg ? expectedBaseArg.split('=')[1] || null : null,
    referenceInput,
    reportOut,
  })
    .then((result) => {
      console.info('[backfillWasteAreas] completed', redactBackfillResultForLog(result));
      process.exit(0);
    })
    .catch((error) => {
      console.error('[backfillWasteAreas] failed:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    });
}
