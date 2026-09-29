import type { Prisma } from '@prisma/client';
import prisma from '../lib/prisma.js';
import type { PublicRentalNotice, PublicRentalMetadata } from './publicRentalSources.js';
import type { SyncStats } from './baseSyncService.js';

interface StoredIdentity {
  id: number;
  houseManageNo: string;
  pblancNo: string;
  publicRental: unknown;
}

function sourceIds(value: unknown): PublicRentalMetadata['sourceIds'] {
  if (!value || typeof value !== 'object' || !('sourceIds' in value)) return { myhome: [], lh: [] };
  const ids = value.sourceIds as Partial<PublicRentalMetadata['sourceIds']> | null;
  return {
    myhome: Array.isArray(ids?.myhome) ? ids.myhome.filter((id): id is string => typeof id === 'string') : [],
    lh: Array.isArray(ids?.lh) ? ids.lh.filter((id): id is string => typeof id === 'string') : [],
  };
}

/** Preserve numeric detail URLs across source overlap and correction chains. Never match titles. */
export function buildPublicRentalWrite(notice: PublicRentalNotice, existing: StoredIdentity[]) {
  const houseManageNo = notice.publicRental.sourceIds.lh.length ? 'LH' : 'MYHOME';
  const myhome = new Set(notice.publicRental.sourceIds.myhome);
  const lh = new Set(notice.publicRental.sourceIds.lh);
  const matches = new Map<number, StoredIdentity>();
  let found = true;
  while (found) {
    found = false;
    for (const row of existing) {
      if (matches.has(row.id)) continue;
      const ids = sourceIds(row.publicRental);
      const sameKey = row.houseManageNo === houseManageNo && row.pblancNo === notice.canonicalId;
      if (!sameKey && !ids.myhome.some(id => myhome.has(id)) && !ids.lh.some(id => lh.has(id))) continue;
      matches.set(row.id, row);
      ids.myhome.forEach(id => myhome.add(id));
      ids.lh.forEach(id => lh.add(id));
      found = true;
    }
  }
  const owners = [...matches.values()].sort((a, b) => a.id - b.id);
  const owner = owners[0];
  const metadata: PublicRentalMetadata = {
    ...notice.publicRental,
    sourceIds: { myhome: [...myhome].sort(), lh: [...lh].sort() },
  };
  return {
    ownerId: owner?.id ?? null,
    supersededIds: owners.slice(1).map(row => row.id),
    data: {
      sourceType: 'PUBLIC_RENT',
      houseManageNo: owner?.houseManageNo ?? houseManageNo,
      pblancNo: owner?.pblancNo ?? notice.canonicalId,
      houseName: notice.houseName.slice(0, 200),
      houseType: notice.houseType.slice(0, 20),
      publicRentType: notice.publicRentType.slice(0, 20),
      rentType: '임대주택',
      regionName: notice.regionName.slice(0, 100),
      supplyLocation: notice.supplyLocation?.slice(0, 500) ?? null,
      totalSupplyCount: notice.totalSupplyCount,
      announcementDate: notice.announcementDate,
      receptionStartDate: notice.receptionStartDate,
      receptionEndDate: notice.receptionEndDate,
      winnerDate: notice.winnerDate,
      pblancUrl: notice.pblancUrl,
      inquiryTel: notice.inquiryTel?.slice(0, 50) ?? null,
      developerName: metadata.provider.slice(0, 200),
      status: notice.status,
      publicRental: metadata,
      supersededById: null,
      // A notice spanning several areas must not acquire one arbitrary map location.
      lat: null,
      lng: null,
    },
  };
}

export async function savePublicRentalNotices(notices: PublicRentalNotice[], stats: SyncStats): Promise<void> {
  let existing: StoredIdentity[] = await prisma.subscription.findMany({
    where: { sourceType: 'PUBLIC_RENT', supersededById: null },
    select: { id: true, houseManageNo: true, pblancNo: true, publicRental: true },
  });
  for (const notice of notices) {
    const plan = buildPublicRentalWrite(notice, existing);
    const data = { ...plan.data, publicRental: plan.data.publicRental as unknown as Prisma.InputJsonValue };
    const saved = await prisma.$transaction(async tx => {
      const row = plan.ownerId === null
        ? await tx.subscription.upsert({
          where: { houseManageNo_pblancNo_sourceType: { houseManageNo: data.houseManageNo, pblancNo: data.pblancNo, sourceType: 'PUBLIC_RENT' } },
          create: data,
          update: data,
        })
        : await tx.subscription.update({ where: { id: plan.ownerId }, data });
      if (plan.supersededIds.length) {
        await tx.subscription.updateMany({ where: { id: { in: plan.supersededIds } }, data: { supersededById: row.id } });
      }
      return row;
    });
    const replaced = new Set([saved.id, ...plan.supersededIds]);
    existing = existing.filter(row => !replaced.has(row.id));
    existing.push(saved);
    stats.totalRecords += 1;
    if (plan.ownerId === null) stats.newRecords += 1;
    else stats.updatedRecords += 1;
  }
}
