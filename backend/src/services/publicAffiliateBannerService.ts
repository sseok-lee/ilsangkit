import { stat } from 'node:fs/promises';
import prisma from '../lib/prisma.js';
import { affiliateBannerCreateSchema } from '../schemas/affiliateBanner.js';
import { expiresAtToEndDate } from '../utils/affiliateBannerExpiration.js';
import { resolveAffiliateDisclosure } from '../utils/affiliateDisclosure.js';
import { getAffiliateAssetPaths } from './affiliateBannerAssetService.js';
import { loadAffiliateDisclosureDefaults } from './adminAffiliateDisclosureService.js';
import type { AffiliateBannerDraft, AffiliateProvider } from '../types/affiliateBanner.js';
import type { PublicAffiliateBanner, PublicAffiliateBannerSelection } from '../types/publicAffiliateBanner.js';

type AffiliateBannerAssetRow = {
  id: string;
  storageKey: string;
  status: string;
};

type AffiliateBannerRow = Omit<AffiliateBannerDraft, 'endDate'> & {
  id: string;
  expiresAt: Date | null;
  isEnabled: boolean;
  imageAsset?: AffiliateBannerAssetRow | null;
};

function isValidExpiresAt(value: Date | null): boolean {
  return value === null || Number.isFinite(value.getTime());
}

function parseEnabledDraft(row: AffiliateBannerRow): AffiliateBannerDraft | null {
  if (!row.isEnabled) return null;
  if (!isValidExpiresAt(row.expiresAt)) return null;

  const parsed = affiliateBannerCreateSchema.safeParse({
    provider: row.provider,
    name: row.name,
    imageSourceType: row.imageSourceType,
    imageAssetId: row.imageAssetId,
    externalImageUrl: row.externalImageUrl,
    targetUrl: row.targetUrl,
    altText: row.altText,
    disclosureOverride: row.disclosureOverride ?? null,
    endDate: expiresAtToEndDate(row.expiresAt),
  });

  return parsed.success ? parsed.data : null;
}

async function getPublicImageUrl(row: AffiliateBannerRow, draft: AffiliateBannerDraft): Promise<string | null> {
  if (draft.imageSourceType === 'url') {
    return draft.externalImageUrl;
  }

  if (!draft.imageAssetId || !row.imageAsset || row.imageAsset.status !== 'ready') {
    return null;
  }

  try {
    const paths = getAffiliateAssetPaths(row.imageAsset.id, row.imageAsset.storageKey);
    const info = await stat(paths.final);
    if (!info.isFile()) return null;
  } catch {
    return null;
  }

  return `/api/images/${row.imageAsset.storageKey}`;
}

async function toPublicBanner(
  row: AffiliateBannerRow,
  defaults: ReadonlyMap<AffiliateProvider, string>,
): Promise<PublicAffiliateBanner | null> {
  const draft = parseEnabledDraft(row);
  if (!draft) return null;

  const resolved = resolveAffiliateDisclosure(
    draft.disclosureOverride,
    defaults.get(draft.provider) ?? null,
  );
  if (resolved.disclosureText === null) return null;

  const imageUrl = await getPublicImageUrl(row, draft);
  if (!imageUrl) return null;

  return {
    id: row.id,
    provider: draft.provider,
    imageUrl,
    targetUrl: draft.targetUrl,
    altText: draft.altText,
    disclosureText: resolved.disclosureText,
    expiresAt: row.expiresAt?.toISOString() ?? null,
  };
}

function isEligibleAtSelectionTime(banner: PublicAffiliateBanner, time: Date): boolean {
  return banner.expiresAt === null || Date.parse(banner.expiresAt) > time.getTime();
}

export async function getRandomAffiliateBanner(): Promise<PublicAffiliateBannerSelection> {
  const queryTime = new Date();
  const rows = await prisma.affiliateBanner.findMany({
    where: {
      isEnabled: true,
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: queryTime } },
      ],
    },
    orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    include: { imageAsset: true },
  }) as unknown as AffiliateBannerRow[];

  const defaults = await loadAffiliateDisclosureDefaults(rows.map((row) => row.provider));
  const candidates = (await Promise.all(rows.map((row) => toPublicBanner(row, defaults))))
    .filter((banner): banner is PublicAffiliateBanner => banner !== null);

  const finalTime = new Date();
  const eligible = candidates.filter((banner) => isEligibleAtSelectionTime(banner, finalTime));
  if (eligible.length === 0) {
    return { data: null, serverTime: finalTime.toISOString() };
  }

  const selectedIndex = Math.floor(Math.random() * eligible.length);
  return {
    data: eligible[selectedIndex] ?? null,
    serverTime: finalTime.toISOString(),
  };
}
