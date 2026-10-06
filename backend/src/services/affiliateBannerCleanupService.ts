import { lstat, readdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import { Prisma } from '@prisma/client';
import prisma from '../lib/prisma.js';
import { getImageRoot } from '../config/imageStorage.js';
import { getAffiliateAssetPaths } from './affiliateBannerAssetService.js';
import { lockAffiliateAssets } from './adminAffiliateBannerService.js';

const BATCH_SIZE = 100;
const EXPIRATION_MS = 24 * 60 * 60 * 1000;
const STAGING_DIR = '.affiliate-banner-staging';
const STAGING_FILE_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.part$/i;

type AffiliateAssetStatus = 'pending' | 'ready' | 'deleting';

type AffiliateBannerAssetRow = {
  id: string;
  storageKey: string;
  mimeType: string;
  byteSize: number;
  status: AffiliateAssetStatus;
  unlinkedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  banner?: { id: string } | null;
};

type CleanupResult = { deleted: number; failed: number };

type CleanupTransaction = Prisma.TransactionClient & {
  affiliateBannerAsset: {
    findUnique: (args: unknown) => Promise<AffiliateBannerAssetRow | null>;
    updateMany: (args: unknown) => Promise<{ count: number }>;
  };
};

type RemovalResult = 'removed' | 'missing' | 'failed';

function cutoffFrom(now: Date): Date {
  return new Date(now.getTime() - EXPIRATION_MS);
}

function isExpiredReady(row: AffiliateBannerAssetRow, cutoff: Date): boolean {
  return row.status === 'ready' && row.unlinkedAt !== null && row.unlinkedAt <= cutoff;
}

function isExpiredPending(row: AffiliateBannerAssetRow, cutoff: Date): boolean {
  return row.status === 'pending' && row.createdAt <= cutoff;
}

function isEligible(row: AffiliateBannerAssetRow, cutoff: Date): boolean {
  if (row.banner) return false;
  return row.status === 'deleting' || isExpiredReady(row, cutoff) || isExpiredPending(row, cutoff);
}

async function removeIfPresent(filePath: string): Promise<RemovalResult> {
  try {
    await unlink(filePath);
    return 'removed';
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return 'missing';
    return 'failed';
  }
}

function logCleanupFailure(stage: string, assetId: string, error?: unknown): void {
  const code = error instanceof Error && 'code' in error ? String(error.code) : undefined;
  const message = error instanceof Error ? error.message : String(error);
  console.error('affiliate-banner-cleanup-asset-failed', { stage, assetId, code, message });
}

async function claimDeleting(rowId: string, cutoff: Date): Promise<AffiliateBannerAssetRow | null> {
  return prisma.$transaction(async (tx) => {
    const cleanupTx = tx as CleanupTransaction;
    await lockAffiliateAssets(cleanupTx, [rowId]);
    const current = await cleanupTx.affiliateBannerAsset.findUnique({
      where: { id: rowId },
      include: { banner: { select: { id: true } } },
    });
    if (!current || !isEligible(current, cutoff)) return null;
    if (current.status === 'deleting') return current;

    const claimed = await cleanupTx.affiliateBannerAsset.updateMany({
      where: { id: current.id, status: current.status },
      data: { status: 'deleting' },
    });
    return claimed.count === 1 ? { ...current, status: 'deleting' } : null;
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
    maxWait: 5000,
    timeout: 5000,
  });
}

async function deleteClaimedFiles(row: AffiliateBannerAssetRow): Promise<boolean> {
  const paths = getAffiliateAssetPaths(row.id, row.storageKey);
  const [staging, final] = await Promise.all([
    removeIfPresent(paths.staging),
    removeIfPresent(paths.final),
  ]);
  return staging !== 'failed' && final !== 'failed';
}

async function cleanupRow(row: AffiliateBannerAssetRow, cutoff: Date): Promise<CleanupResult> {
  let claimed: AffiliateBannerAssetRow | null;
  try {
    claimed = await claimDeleting(row.id, cutoff);
  } catch (error) {
    logCleanupFailure('claim-deleting', row.id, error);
    return { deleted: 0, failed: 1 };
  }
  if (!claimed) return { deleted: 0, failed: 0 };

  let filesGone = false;
  try {
    filesGone = await deleteClaimedFiles(claimed);
  } catch (error) {
    logCleanupFailure('resolve-paths', claimed.id, error);
    return { deleted: 0, failed: 1 };
  }
  if (!filesGone) return { deleted: 0, failed: 1 };

  try {
    await prisma.affiliateBannerAsset.deleteMany({ where: { id: claimed.id, status: 'deleting' } });
    return { deleted: 1, failed: 0 };
  } catch (error) {
    logCleanupFailure('delete-row', claimed.id, error);
    return { deleted: 0, failed: 1 };
  }
}

async function listAssetCandidates(cutoff: Date, lastId: string | null): Promise<AffiliateBannerAssetRow[]> {
  const and: Prisma.AffiliateBannerAssetWhereInput[] = [];
  if (lastId) and.push({ id: { gt: lastId } });
  and.push({
    OR: [
      { status: 'deleting' },
      { status: 'ready', unlinkedAt: { lte: cutoff } },
      { status: 'pending', createdAt: { lte: cutoff } },
    ],
  });
  const where: Prisma.AffiliateBannerAssetWhereInput = {
    AND: and,
  };
  return prisma.affiliateBannerAsset.findMany({
    where,
    orderBy: { id: 'asc' },
    take: BATCH_SIZE,
  }) as Promise<AffiliateBannerAssetRow[]>;
}

async function scanExpiredStaging(cutoff: Date): Promise<CleanupResult> {
  const stagingDir = path.join(getImageRoot(), STAGING_DIR);
  let names: string[];
  try {
    names = await readdir(stagingDir);
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return { deleted: 0, failed: 0 };
    return { deleted: 0, failed: 1 };
  }

  const result = { deleted: 0, failed: 0 };
  for (const name of names) {
    if (!STAGING_FILE_PATTERN.test(name)) continue;
    const filePath = path.join(stagingDir, name);
    let info;
    try {
      info = await lstat(filePath);
    } catch {
      continue;
    }
    if (!info.isFile() || info.mtime > cutoff) continue;

    const id = name.slice(0, -'.part'.length);
    let row: AffiliateBannerAssetRow | null;
    try {
      row = await prisma.affiliateBannerAsset.findUnique({
        where: { id },
        include: { banner: { select: { id: true } } },
      }) as AffiliateBannerAssetRow | null;
    } catch (error) {
      logCleanupFailure('check-orphan-staging', id, error);
      result.failed += 1;
      continue;
    }

    if (row) {
      const cleanup = await cleanupRow(row, cutoff);
      result.deleted += cleanup.deleted;
      result.failed += cleanup.failed;
      continue;
    }

    const removed = await removeIfPresent(filePath);
    if (removed === 'failed') {
      result.failed += 1;
    } else {
      result.deleted += 1;
    }
  }
  return result;
}

export async function cleanupAffiliateBannerAssets(now = new Date()): Promise<CleanupResult> {
  const cutoff = cutoffFrom(now);
  const result = { deleted: 0, failed: 0 };
  let lastId: string | null = null;

  for (;;) {
    const batch = await listAssetCandidates(cutoff, lastId);
    if (batch.length === 0) break;
    for (const row of batch) {
      const cleanup = await cleanupRow(row, cutoff);
      result.deleted += cleanup.deleted;
      result.failed += cleanup.failed;
    }
    lastId = batch[batch.length - 1].id;
    if (batch.length < BATCH_SIZE) break;
  }

  const staging = await scanExpiredStaging(cutoff);
  result.deleted += staging.deleted;
  result.failed += staging.failed;
  return result;
}
