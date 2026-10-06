import * as crypto from 'node:crypto';
import path from 'node:path';
import { mkdir, rename, unlink, writeFile } from 'node:fs/promises';
import prisma from '../lib/prisma.js';
import { AppError, ValidationError } from '../lib/errors.js';
import { getImageRoot } from '../config/imageStorage.js';
import { detectRasterImage } from '../utils/rasterImage.js';
import type { UploadedAffiliateBannerImage } from '../types/affiliateBanner.js';

const STORAGE_PREFIX = 'affiliate-banners/';
const STAGING_DIR = '.affiliate-banner-staging';
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STORAGE_KEY_PATTERN =
  /^affiliate-banners\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.(jpg|png|webp|gif)$/i;

function storageError(stage: string, id?: string, cause?: unknown): AppError {
  const errorCode = cause instanceof Error && 'code' in cause ? String(cause.code) : 'unknown';
  console.error('affiliate-banner-asset-upload-failed', { stage, assetId: id, code: errorCode });
  return new AppError(500, '이미지 저장에 실패했습니다', 'IMAGE_STORAGE_ERROR');
}

async function unlinkIfExists(filePath: string): Promise<boolean> {
  try {
    await unlink(filePath);
    return true;
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return true;
    return false;
  }
}

export function getAffiliateAssetPaths(id: string, storageKey: string): { staging: string; final: string } {
  if (!UUID_PATTERN.test(id)) throw new AppError(422, '잘못된 이미지 자산 ID입니다', 'VALIDATION_ERROR');
  const match = STORAGE_KEY_PATTERN.exec(storageKey);
  if (!match || match[1].toLowerCase() !== id.toLowerCase()) {
    throw new AppError(422, '잘못된 이미지 저장 경로입니다', 'VALIDATION_ERROR');
  }

  const root = getImageRoot();
  const final = path.resolve(root, storageKey);
  const staging = path.resolve(root, STAGING_DIR, `${id}.part`);
  const expectedFinalDir = path.resolve(root, STORAGE_PREFIX.slice(0, -1));
  const expectedStagingDir = path.resolve(root, STAGING_DIR);
  if (path.dirname(final) !== expectedFinalDir || path.dirname(staging) !== expectedStagingDir) {
    throw new AppError(422, '잘못된 이미지 저장 경로입니다', 'VALIDATION_ERROR');
  }

  return { staging, final };
}

export async function uploadAffiliateBannerImage(bytes: Buffer): Promise<UploadedAffiliateBannerImage> {
  if (bytes.length === 0) throw new ValidationError('이미지를 선택하세요');
  if (bytes.length > MAX_IMAGE_BYTES) {
    throw new AppError(413, '이미지는 2MiB 이하만 업로드할 수 있습니다', 'PAYLOAD_TOO_LARGE');
  }

  const image = detectRasterImage(bytes);
  const id = crypto.randomUUID();
  const storageKey = `${STORAGE_PREFIX}${id}.${image.extension}`;
  const paths = getAffiliateAssetPaths(id, storageKey);
  let rowCreated = false;
  let movedToFinal = false;

  try {
    await mkdir(path.dirname(paths.staging), { recursive: true });
    await mkdir(path.dirname(paths.final), { recursive: true });
    await writeFile(paths.staging, bytes, { flag: 'wx', mode: 0o600 });
    await prisma.affiliateBannerAsset.create({
      data: {
        id,
        storageKey,
        mimeType: image.mimeType,
        byteSize: bytes.length,
        status: 'pending',
        unlinkedAt: new Date(),
      },
    });
    rowCreated = true;
    await rename(paths.staging, paths.final);
    movedToFinal = true;
    const ready = await prisma.affiliateBannerAsset.updateMany({
      where: { id, status: 'pending' },
      data: { status: 'ready', unlinkedAt: new Date() },
    });
    if (ready.count !== 1) {
      throw new Error('ready status CAS failed');
    }

    return {
      imageAssetId: id,
      imageUrl: `/api/images/${storageKey}`,
    };
  } catch (error) {
    const cleanedStaging = await unlinkIfExists(paths.staging);
    if (rowCreated && !movedToFinal && cleanedStaging) {
      try {
        await prisma.affiliateBannerAsset.deleteMany({ where: { id, status: 'pending' } });
      } catch (deleteError) {
        console.error('affiliate-banner-asset-cleanup-failed', {
          stage: 'delete-pending-row',
          assetId: id,
          code: deleteError instanceof Error && 'code' in deleteError ? String(deleteError.code) : 'unknown',
        });
      }
    }
    throw storageError(rowCreated ? 'persist-asset' : 'stage-before-row', id, error);
  }
}
