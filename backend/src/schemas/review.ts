import { z } from 'zod';

// 리뷰 카테고리 (trash 포함 - 모든 시설에 리뷰 가능)
const ReviewCategorySchema = z.enum([
  'toilet', 'wifi', 'clothes', 'kiosk', 'parking', 'aed', 'library', 'hospital', 'pharmacy', 'trash',
]);

// 리뷰 작성 스키마
export const CreateReviewSchema = z.object({
  facilityCategory: ReviewCategorySchema,
  facilityId: z.string().min(1).max(50),
  nickname: z.string().min(1, '닉네임을 입력해주세요').max(30, '닉네임은 30자 이내로 입력해주세요'),
  password: z.string().min(4, '비밀번호는 4자 이상이어야 합니다').max(20, '비밀번호는 20자 이내로 입력해주세요'),
  content: z.string().min(1, '리뷰 내용을 입력해주세요').max(1000, '리뷰는 1000자 이내로 입력해주세요'),
});

// 리뷰 수정 스키마
export const UpdateReviewSchema = z.object({
  password: z.string().min(4).max(20),
  content: z.string().min(1).max(1000).optional(),
  nickname: z.string().min(1).max(30).optional(),
}).refine(
  (data) => data.content !== undefined || data.nickname !== undefined,
  { message: '수정할 내용(content 또는 nickname)을 입력해주세요' }
);

// 리뷰 삭제 스키마
export const DeleteReviewSchema = z.object({
  password: z.string().min(4).max(20),
});

// 리뷰 ID 파라미터 스키마
export const ReviewIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

// 시설별 리뷰 조회 파라미터 스키마
export const FacilityReviewsParamsSchema = z.object({
  category: ReviewCategorySchema,
  id: z.string().min(1).max(50),
});

// 리뷰 페이지네이션 스키마
export const ReviewPaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

// 최근 리뷰 쿼리 스키마
export const RecentReviewsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(20).default(6),
});

// 타입 추출
export type CreateReviewInput = z.infer<typeof CreateReviewSchema>;
export type UpdateReviewInput = z.infer<typeof UpdateReviewSchema>;
export type DeleteReviewInput = z.infer<typeof DeleteReviewSchema>;
export type ReviewIdParam = z.infer<typeof ReviewIdParamSchema>;
export type FacilityReviewsParams = z.infer<typeof FacilityReviewsParamsSchema>;
export type ReviewPagination = z.infer<typeof ReviewPaginationSchema>;
export type RecentReviewsQuery = z.infer<typeof RecentReviewsQuerySchema>;
