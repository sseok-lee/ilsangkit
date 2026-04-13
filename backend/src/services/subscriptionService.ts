import prisma from '../lib/prisma.js';
import { NotFoundError } from '../lib/errors.js';
import type { SubscriptionListParams } from '../schemas/subscription.js';
import type { Prisma } from '@prisma/client';

export async function getSubscriptionList(params: SubscriptionListParams) {
  const { status, region, houseType, rentType, page, limit } = params;

  const where: Prisma.SubscriptionWhereInput = {};
  if (status) where.status = status;
  if (region) where.regionName = { contains: region };
  if (houseType) where.houseType = houseType;
  if (rentType) where.rentType = rentType;

  const [items, total] = await Promise.all([
    prisma.subscription.findMany({
      where,
      orderBy: { announcementDate: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.subscription.count({ where }),
  ]);

  return {
    items,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

export async function getSubscriptionDetail(id: number) {
  const subscription = await prisma.subscription.findUnique({
    where: { id },
    include: { unitTypes: true },
  });

  if (!subscription) {
    throw new NotFoundError('청약 공고를 찾을 수 없습니다');
  }

  return subscription;
}

export async function getUpcomingSubscriptions(limit = 5) {
  return prisma.subscription.findMany({
    where: { status: 'upcoming' },
    orderBy: { receptionStartDate: 'asc' },
    take: limit,
  });
}
