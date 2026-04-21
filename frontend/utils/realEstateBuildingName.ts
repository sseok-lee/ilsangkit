/**
 * 부동산 건물명(buildingName) 유효성 검증 유틸 (frontend 버전).
 *
 * Backend `backend/src/lib/realEstateBuildingName.ts`와 완전히 동일한 규칙을 공유한다.
 * 규칙이 바뀌면 **양쪽 파일을 함께** 수정하고 양쪽 vitest를 실행할 것.
 */

export const INVALID_BUILDING_NAME = /^[\s()0-9-]+$|^\s*\([0-9]/

export function isValidBuildingName(name: string | null | undefined): boolean {
  if (!name) return false
  const trimmed = name.trim()
  if (trimmed.length < 2) return false
  return !INVALID_BUILDING_NAME.test(trimmed)
}
