import { describe, it, expect, vi, beforeEach } from 'vitest';

// prisma mock
vi.mock('../../src/lib/prisma.js', () => ({
  prisma: {
    review: {
      findMany: vi.fn(),
    },
    toilet: { findUnique: vi.fn() },
    wifi: { findUnique: vi.fn() },
    clothes: { findUnique: vi.fn() },
    parking: { findUnique: vi.fn() },
    aed: { findUnique: vi.fn() },
    library: { findUnique: vi.fn() },
    hospital: { findUnique: vi.fn() },
    pharmacy: { findUnique: vi.fn() },
    park: { findUnique: vi.fn() },
    school: { findUnique: vi.fn() },
    market: { findUnique: vi.fn() },
    childcare: { findUnique: vi.fn() },
    evCharger: { findUnique: vi.fn() },
    sports: { findUnique: vi.fn() },
  },
}));

import { prisma } from '../../src/lib/prisma.js';
import { getRecentReviews } from '../../src/services/reviewService.js';

const mockPrisma = prisma as unknown as {
  review: { findMany: ReturnType<typeof vi.fn> };
  childcare: { findUnique: ReturnType<typeof vi.fn> };
  evCharger: { findUnique: ReturnType<typeof vi.fn> };
  sports: { findUnique: ReturnType<typeof vi.fn> };
  toilet: { findUnique: ReturnType<typeof vi.fn> };
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getRecentReviews', () => {
  it('시설 카테고리 리뷰에 시설명을 포함해야 한다', async () => {
    mockPrisma.review.findMany.mockResolvedValue([
      { id: 1, facilityCategory: 'toilet', facilityId: 'toilet-1', nickname: '유저', content: '깨끗해요', createdAt: new Date() },
    ]);
    mockPrisma.toilet.findUnique.mockResolvedValue({ name: '강남역 공공화장실' });

    const result = await getRecentReviews(1);
    expect(result[0].facilityName).toBe('강남역 공공화장실');
  });

  it('childcare 카테고리 리뷰에 시설명을 조회해야 한다', async () => {
    mockPrisma.review.findMany.mockResolvedValue([
      { id: 2, facilityCategory: 'childcare', facilityId: 'cc-1', nickname: '부모', content: '좋은 어린이집', createdAt: new Date() },
    ]);
    mockPrisma.childcare.findUnique.mockResolvedValue({ name: '해피 어린이집' });

    const result = await getRecentReviews(1);
    expect(result[0].facilityName).toBe('해피 어린이집');
  });

  it('ev-charger 카테고리 리뷰에 시설명을 조회해야 한다', async () => {
    mockPrisma.review.findMany.mockResolvedValue([
      { id: 3, facilityCategory: 'ev-charger', facilityId: 'ev-1', nickname: '운전자', content: '빠른 충전', createdAt: new Date() },
    ]);
    mockPrisma.evCharger.findUnique.mockResolvedValue({ name: '강남 충전소' });

    const result = await getRecentReviews(1);
    expect(result[0].facilityName).toBe('강남 충전소');
  });

  it('sports 카테고리 리뷰에 시설명을 조회해야 한다', async () => {
    mockPrisma.review.findMany.mockResolvedValue([
      { id: 4, facilityCategory: 'sports', facilityId: 'sp-1', nickname: '운동러', content: '넓은 시설', createdAt: new Date() },
    ]);
    mockPrisma.sports.findUnique.mockResolvedValue({ name: '올림픽 체육관' });

    const result = await getRecentReviews(1);
    expect(result[0].facilityName).toBe('올림픽 체육관');
  });

  it('부동산 카테고리(apt) 리뷰는 facilityId를 시설명으로 사용해야 한다', async () => {
    mockPrisma.review.findMany.mockResolvedValue([
      { id: 5, facilityCategory: 'apt', facilityId: '래미안 강남', nickname: '입주민', content: '좋은 아파트', createdAt: new Date() },
    ]);

    const result = await getRecentReviews(1);
    expect(result[0].facilityName).toBe('래미안 강남');
  });

  it('부동산 카테고리(villa) 리뷰는 facilityId를 시설명으로 사용해야 한다', async () => {
    mockPrisma.review.findMany.mockResolvedValue([
      { id: 6, facilityCategory: 'villa', facilityId: '서초 빌라', nickname: '세입자', content: '조용해요', createdAt: new Date() },
    ]);

    const result = await getRecentReviews(1);
    expect(result[0].facilityName).toBe('서초 빌라');
  });

  it('부동산 카테고리(offitel) 리뷰는 facilityId를 시설명으로 사용해야 한다', async () => {
    mockPrisma.review.findMany.mockResolvedValue([
      { id: 7, facilityCategory: 'offitel', facilityId: '역삼 오피스텔', nickname: '직장인', content: '역세권', createdAt: new Date() },
    ]);

    const result = await getRecentReviews(1);
    expect(result[0].facilityName).toBe('역삼 오피스텔');
  });

  it('modelMap에 없는 카테고리는 "알 수 없는 시설"이어야 한다', async () => {
    mockPrisma.review.findMany.mockResolvedValue([
      { id: 8, facilityCategory: 'unknown-cat', facilityId: 'x', nickname: '유저', content: '내용', createdAt: new Date() },
    ]);

    const result = await getRecentReviews(1);
    expect(result[0].facilityName).toBe('알 수 없는 시설');
  });
});
