/**
 * 부동산 건물명(buildingName) 유효성 검증 유틸.
 *
 * G4 decision (2026-04-21): DB 샘플 기준 paren-prefix 중 legitimate 회사명
 * (`(주)래미안타워`, `(사)OO아파트` 등) ≈ 300건 확인. 완전 차단 시 SEO 가치
 * 손실이 있어 regex를 "숫자로 시작하는 괄호 접두사"로 한정.
 *
 * Invalid buildings 예시 (지번/thin 데이터):
 *   - "(535-3)", "  (535-3)", "(123-45)"         — 지번 전체가 괄호
 *   - "123-456", "000-0"                         — 숫자·하이픈만
 *   - "()", "  "                                 — 껍데기/공백
 *   - "(3-1)아파트"                              — 숫자 시작 괄호 접두사
 *
 * Valid buildings 예시 (허용):
 *   - "래미안강남", "ABC빌라", "e-편한세상"
 *   - "(주)래미안타워", "(사)OO아파트"            — 숫자가 아닌 괄호 접두사
 */

export const INVALID_BUILDING_NAME = /^[\s()0-9-]+$|^\s*\([0-9]/;

export function isValidBuildingName(name: string | null | undefined): boolean {
  if (!name) return false;
  const trimmed = name.trim();
  if (trimmed.length < 2) return false;
  return !INVALID_BUILDING_NAME.test(trimmed);
}
