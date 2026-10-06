import { stat } from 'node:fs/promises';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import prisma from '../lib/prisma.js';
import { ConflictError, NotFoundError, ValidationError } from '../lib/errors.js';
import { affiliateBannerCreateSchema } from '../schemas/affiliateBanner.js';
import { getAffiliateAssetPaths } from './affiliateBannerAssetService.js';
import type {
  AffiliateBannerDto,
  AffiliateBannerDraft,
  AffiliateBannerPage,
  AffiliateBannerPatch,
  AffiliateBannerQuery,
} from '../types/affiliateBanner.js';

const TRANSACTION_OPTIONS = {
  isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
  maxWait: 5000,
  timeout: 5000,
};

const RETRYABLE_TRANSACTION_CODE = 'P2034';
const CONFLICT_PRISMA_CODES = new Set(['P2002', 'P2003']);

type AffiliateBannerRow = AffiliateBannerDraft & {
  id: string;
  isEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
  imageAsset?: AffiliateBannerAssetRow | null;
};

type AffiliateBannerAssetRow = {
  id: string;
  storageKey: string;
  status: string;
  banner?: { id: string } | null;
};

type BannerTransaction = Prisma.TransactionClient & {
  affiliateBanner: {
    create: (args: unknown) => Promise<AffiliateBannerRow>;
    update: (args: unknown) => Promise<AffiliateBannerRow>;
    findUnique: (args: unknown) => Promise<AffiliateBannerRow | null>;
  };
  affiliateBannerAsset: {
    findUnique: (args: unknown) => Promise<AffiliateBannerAssetRow | null>;
    updateMany: (args: unknown) => Promise<{ count: number }>;
  };
};

function isPrismaKnownRequestError(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError;
}

function mapPrismaWriteError(error: unknown): never {
  if (isPrismaKnownRequestError(error) && CONFLICT_PRISMA_CODES.has(error.code)) {
    throw new ConflictError('이미지 자산을 배너에 연결할 수 없습니다');
  }
  throw error;
}

function parseBannerDraft(value: unknown): AffiliateBannerDraft {
  try {
    return affiliateBannerCreateSchema.parse(value);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new ValidationError('배너 입력값이 올바르지 않습니다', error.flatten());
    }
    throw error;
  }
}

async function withBannerTransaction<T>(work: (tx: BannerTransaction) => Promise<T>): Promise<T> {
  let conflicts = 0;
  for (;;) {
    try {
      return await prisma.$transaction(
        (tx) => work(tx as unknown as BannerTransaction),
        TRANSACTION_OPTIONS,
      );
    } catch (error) {
      if (isPrismaKnownRequestError(error) && error.code === RETRYABLE_TRANSACTION_CODE && conflicts < 3) {
        conflicts += 1;
        continue;
      }
      mapPrismaWriteError(error);
    }
  }
}

function toDto(row: AffiliateBannerRow): AffiliateBannerDto {
  const imageUrl = row.imageSourceType === 'upload'
    ? `/api/images/${row.imageAsset?.storageKey ?? ''}`
    : row.externalImageUrl ?? '';

  return {
    id: row.id,
    provider: row.provider,
    name: row.name,
    imageSourceType: row.imageSourceType,
    imageAssetId: row.imageAssetId,
    externalImageUrl: row.externalImageUrl,
    targetUrl: row.targetUrl,
    altText: row.altText,
    imageUrl,
    isEnabled: row.isEnabled,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function assertPatchSourceFields(patch: AffiliateBannerPatch): void {
  if (patch.imageSourceType === 'url' && patch.imageAssetId !== undefined && patch.imageAssetId !== null) {
    throw new ValidationError('외부 이미지 URL 배너에는 업로드 자산을 함께 지정할 수 없습니다');
  }
  if (patch.imageSourceType === 'upload' && patch.externalImageUrl !== undefined && patch.externalImageUrl !== null) {
    throw new ValidationError('업로드 배너에는 외부 이미지 URL을 함께 지정할 수 없습니다');
  }
}

function mergeBannerPatch(existing: AffiliateBannerRow, patch: AffiliateBannerPatch): AffiliateBannerDraft {
  assertPatchSourceFields(patch);
  const base: AffiliateBannerDraft = {
    provider: existing.provider,
    name: existing.name,
    imageSourceType: existing.imageSourceType,
    imageAssetId: existing.imageAssetId,
    externalImageUrl: existing.externalImageUrl,
    targetUrl: existing.targetUrl,
    altText: existing.altText,
  };

  if (patch.imageSourceType === 'url') {
    base.imageAssetId = null;
  } else if (patch.imageSourceType === 'upload') {
    base.externalImageUrl = null;
  }

  return parseBannerDraft({ ...base, ...patch });
}

async function lockBanner(tx: BannerTransaction, id: string): Promise<AffiliateBannerRow> {
  await tx.$queryRaw`SELECT id FROM AffiliateBanner WHERE id = ${id} FOR UPDATE`;
  const banner = await tx.affiliateBanner.findUnique({
    where: { id },
    include: { imageAsset: true },
  });
  if (!banner) throw new NotFoundError('배너를 찾을 수 없습니다');
  return banner;
}

export async function lockAffiliateAssets(tx: Prisma.TransactionClient, ids: string[]): Promise<void> {
  for (const id of [...new Set(ids)].sort()) {
    await tx.$queryRaw`SELECT id FROM AffiliateBannerAsset WHERE id = ${id} FOR UPDATE`;
  }
}

async function loadUsableAsset(tx: BannerTransaction, assetId: string, currentBannerId?: string): Promise<AffiliateBannerAssetRow> {
  const asset = await tx.affiliateBannerAsset.findUnique({
    where: { id: assetId },
    include: { banner: { select: { id: true } } },
  });
  if (!asset || asset.status !== 'ready') {
    throw new ConflictError('사용할 수 없는 이미지 자산입니다');
  }
  if (asset.banner && asset.banner.id !== currentBannerId) {
    throw new ConflictError('이미 다른 배너에 연결된 이미지 자산입니다');
  }
  try {
    const paths = getAffiliateAssetPaths(asset.id, asset.storageKey);
    const info = await stat(paths.final);
    if (!info.isFile()) throw new Error('not a regular file');
  } catch {
    throw new ConflictError('이미지 파일을 확인할 수 없습니다');
  }
  return asset;
}

async function assertBannerCanBeEnabled(tx: BannerTransaction, banner: AffiliateBannerRow): Promise<void> {
  const draft = parseBannerDraft({
    provider: banner.provider,
    name: banner.name,
    imageSourceType: banner.imageSourceType,
    imageAssetId: banner.imageAssetId,
    externalImageUrl: banner.externalImageUrl,
    targetUrl: banner.targetUrl,
    altText: banner.altText,
  });
  if (draft.imageSourceType === 'upload' && draft.imageAssetId) {
    await lockAffiliateAssets(tx, [draft.imageAssetId]);
    await loadUsableAsset(tx, draft.imageAssetId, banner.id);
  }
}

export async function listAffiliateBanners(query: AffiliateBannerQuery): Promise<AffiliateBannerPage> {
  const { page, limit, provider, isEnabled } = query;
  const skip = (page - 1) * limit;
  const where = {
    ...(provider ? { provider } : {}),
    ...(isEnabled !== undefined ? { isEnabled } : {}),
  };

  const [total, items] = await Promise.all([
    prisma.affiliateBanner.count({ where }),
    prisma.affiliateBanner.findMany({
      where,
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      skip,
      take: limit,
      include: { imageAsset: true },
    }),
  ]);

  return {
    items: items.map((item) => toDto(item as unknown as AffiliateBannerRow)),
    total,
    page,
    totalPages: total === 0 ? 0 : Math.ceil(total / limit),
  };
}

export async function getAffiliateBanner(id: string): Promise<AffiliateBannerDto> {
  const banner = await prisma.affiliateBanner.findUnique({
    where: { id },
    include: { imageAsset: true },
  });
  if (!banner) throw new NotFoundError('배너를 찾을 수 없습니다');
  return toDto(banner as unknown as AffiliateBannerRow);
}

export async function createAffiliateBanner(input: AffiliateBannerDraft): Promise<AffiliateBannerDto> {
  const draft = parseBannerDraft(input);
  return withBannerTransaction(async (tx) => {
    let asset: AffiliateBannerAssetRow | null = null;
    if (draft.imageSourceType === 'upload' && draft.imageAssetId) {
      await lockAffiliateAssets(tx, [draft.imageAssetId]);
      asset = await loadUsableAsset(tx, draft.imageAssetId);
    }

    const row = await tx.affiliateBanner.create({
      data: { ...draft, isEnabled: false },
      include: { imageAsset: true },
    });
    if (asset) {
      await tx.affiliateBannerAsset.updateMany({
        where: { id: asset.id, status: 'ready' },
        data: { unlinkedAt: null },
      });
    }
    return toDto(row);
  });
}

export async function updateAffiliateBanner(id: string, patch: AffiliateBannerPatch): Promise<AffiliateBannerDto> {
  return withBannerTransaction(async (tx) => {
    const existing = await lockBanner(tx, id);
    const draft = mergeBannerPatch(existing, patch);
    const assetIds = [existing.imageAssetId, draft.imageAssetId].filter((value): value is string => Boolean(value));
    await lockAffiliateAssets(tx, assetIds);

    let newAsset: AffiliateBannerAssetRow | null = null;
    if (draft.imageSourceType === 'upload' && draft.imageAssetId) {
      newAsset = await loadUsableAsset(tx, draft.imageAssetId, id);
    }

    const oldAssetId = existing.imageAssetId;
    const row = await tx.affiliateBanner.update({
      where: { id },
      data: draft,
      include: { imageAsset: true },
    });
    if (newAsset) {
      await tx.affiliateBannerAsset.updateMany({
        where: { id: newAsset.id, status: 'ready' },
        data: { unlinkedAt: null },
      });
    }
    if (oldAssetId && oldAssetId !== draft.imageAssetId) {
      await tx.affiliateBannerAsset.updateMany({
        where: { id: oldAssetId },
        data: { unlinkedAt: new Date() },
      });
    }
    return toDto(row);
  });
}

export async function setAffiliateBannerStatus(id: string, isEnabled: boolean): Promise<AffiliateBannerDto> {
  return withBannerTransaction(async (tx) => {
    const existing = await lockBanner(tx, id);
    if (isEnabled) {
      await assertBannerCanBeEnabled(tx, existing);
    }
    const row = await tx.affiliateBanner.update({
      where: { id },
      data: { isEnabled },
      include: { imageAsset: true },
    });
    return toDto(row);
  });
}
