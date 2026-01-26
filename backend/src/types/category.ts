// @TASK T0.5.1 - 카테고리 타입 정의
// @SPEC docs/planning/02-trd.md#category-types

/**
 * 카테고리 정보
 */
export interface CategoryInfo {
  id: string;
  name: string;
  icon: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
}

/**
 * 카테고리별 시설 수
 */
export interface CategoryCount {
  category: string;
  count: number;
}
