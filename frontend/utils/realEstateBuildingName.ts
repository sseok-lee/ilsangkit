/**
 * 부동산 건물명(buildingName) 유효성 검증 유틸 (frontend 버전).
 *
 * Backend `backend/src/lib/realEstateBuildingName.ts`와 완전히 동일한 규칙을 공유한다.
 * 규칙이 바뀌면 **양쪽 파일을 함께** 수정하고 양쪽 vitest를 실행할 것.
 *
 * 규칙 이력:
 *   - 2026-04-21 (G4): 지번/숫자 패턴(INVALID_BUILDING_NAME)을 무효로 취급.
 *   - 2026-10-19: 사이트 운영자 결정으로 지번형 이름을 해제. 약 3.79만 건물(대부분 빌라)이
 *     대상이며 이제 일반 이름과 동일하게 색인·사이트맵·목록·허브·IndexNow 대상이다.
 *
 * 현재 규칙: 비어 있지 않고 trim 후 길이가 2자 이상이면 유효.
 *   - 유효: "(683-)", "(966)", "123-4", "(386-2)청구빌라", "래미안강남", "(주)래미안타워"
 *   - 무효: null, "", "  ", 1글자 이름
 *
 * SQL 쪽(사이트맵/목록/허브)도 IS NOT NULL, != '', CHAR_LENGTH >= 2 만 사용한다.
 */

export function isValidBuildingName(name: string | null | undefined): boolean {
  if (!name) return false
  return name.trim().length >= 2
}
