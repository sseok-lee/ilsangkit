import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma.js';
import { AppError } from '../lib/errors.js';
import type { CreateReviewInput, UpdateReviewInput } from '../schemas/review.js';

const SALT_ROUNDS = 10;

// 카테고리별 Prisma 모델 매핑 (시설명 조회용)
const modelMap: Record<string, () => { findUnique: (args: { where: { id: string }; select: { name: boolean } }) => Promise<{ name: string } | null> }> = {
  toilet: () => prisma.toilet as never,
  wifi: () => prisma.wifi as never,
  clothes: () => prisma.clothes as never,
  kiosk: () => prisma.kiosk as never,
  parking: () => prisma.parking as never,
  aed: () => prisma.aed as never,
  library: () => prisma.library as never,
  hospital: () => prisma.hospital as never,
  pharmacy: () => prisma.pharmacy as never,
};

/**
 * 리뷰 생성
 */
export async function createReview(input: CreateReviewInput) {
  const { password, ...rest } = input;
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const review = await prisma.review.create({
    data: {
      ...rest,
      passwordHash,
    },
    select: {
      id: true,
      facilityCategory: true,
      facilityId: true,
      nickname: true,
      content: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return review;
}

/**
 * 시설별 리뷰 목록 조회 (페이지네이션)
 */
export async function getReviewsByFacility(
  category: string,
  facilityId: string,
  { page, limit }: { page: number; limit: number }
) {
  const where = { facilityCategory: category, facilityId };

  const [items, total] = await Promise.all([
    prisma.review.findMany({
      where,
      select: {
        id: true,
        nickname: true,
        content: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.review.count({ where }),
  ]);

  return {
    items,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * 최근 리뷰 목록 조회 (홈페이지용)
 */
export async function getRecentReviews(limit: number) {
  const reviews = await prisma.review.findMany({
    select: {
      id: true,
      facilityCategory: true,
      facilityId: true,
      nickname: true,
      content: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  // 시설명 조회
  const reviewsWithFacilityName = await Promise.all(
    reviews.map(async (review) => {
      let facilityName = '알 수 없는 시설';
      const getModel = modelMap[review.facilityCategory];
      if (getModel) {
        try {
          const facility = await getModel().findUnique({
            where: { id: review.facilityId },
            select: { name: true },
          });
          if (facility) {
            facilityName = facility.name;
          }
        } catch {
          // trash 등 좌표 없는 카테고리는 무시
        }
      }
      return {
        ...review,
        facilityName,
      };
    })
  );

  return reviewsWithFacilityName;
}

/**
 * 비밀번호 확인 후 리뷰 수정
 */
export async function verifyPasswordAndUpdate(id: number, input: UpdateReviewInput) {
  const review = await prisma.review.findUnique({
    where: { id },
    select: { passwordHash: true },
  });

  if (!review) {
    throw new AppError(404, '리뷰를 찾을 수 없습니다', 'NOT_FOUND');
  }

  const isValid = await bcrypt.compare(input.password, review.passwordHash);
  if (!isValid) {
    throw new AppError(403, '비밀번호가 일치하지 않습니다', 'INVALID_PASSWORD');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password, ...updateData } = input;
  const updated = await prisma.review.update({
    where: { id },
    data: updateData,
    select: {
      id: true,
      facilityCategory: true,
      facilityId: true,
      nickname: true,
      content: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return updated;
}

/**
 * 비밀번호 확인 후 리뷰 삭제
 */
export async function verifyPasswordAndDelete(id: number, password: string) {
  const review = await prisma.review.findUnique({
    where: { id },
    select: { passwordHash: true },
  });

  if (!review) {
    throw new AppError(404, '리뷰를 찾을 수 없습니다', 'NOT_FOUND');
  }

  const isValid = await bcrypt.compare(password, review.passwordHash);
  if (!isValid) {
    throw new AppError(403, '비밀번호가 일치하지 않습니다', 'INVALID_PASSWORD');
  }

  await prisma.review.delete({ where: { id } });
}
