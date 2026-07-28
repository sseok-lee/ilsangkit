/**
 * Phase 1 백필의 색인 판정 규칙이 TS 쪽 판정과 어긋나지 않는지 고정한다.
 *
 * isIndexable 은 SQL(POSIX REGEXP)로 계산되고, 사이트맵 URL 생성·프론트 재필터는
 * TS(JS RegExp)로 판정한다. 두 규칙이 벌어지면 사이트맵 URL 집합이 조용히 바뀐다
 * — 실제로 이 값이 어긋나면 색인된 URL 이 사라지거나 빈 페이지가 생긴다.
 */
import { describe, it, expect } from 'vitest';
import { isValidBuildingName } from '../../src/lib/realEstateBuildingName.js';
import { INDEXABLE_EXPR } from '../../src/scripts/backfillProperty.js';

/** SQL INDEXABLE_EXPR 을 JS 로 옮긴 것. 두 구현이 같은 판정을 내는지 대조하는 용도. */
function sqlIndexableEquivalent(name: string | null): boolean {
  if (name === null || name === '') return false;
  if ([...name].length < 2) return false; // CHAR_LENGTH = 문자 수
  if (/^[ \t\n\r\f\v]*\([0-9]/.test(name)) return false; // '^[[:space:]]*[(][0-9]'
  if (/^[0-9()\s-]+$/.test(name)) return false; // '^[0-9()[:space:]-]+$'
  return true;
}

const SAMPLES: Array<[string, boolean]> = [
  // 유효
  ['래미안강남', true],
  ['ABC빌라', true],
  ['e-편한세상', true],
  ['(주)래미안타워', true], // 숫자가 아닌 괄호 접두사는 허용
  ['(사)OO아파트', true],
  // 무효 — 지번만
  ['(255-1)', false],
  ['(535-3)', false],
  ['  (535-3)', false],
  ['123-456', false],
  ['000-0', false],
  ['(3-1)아파트', false], // 숫자 시작 괄호 접두사
  // 무효 — 껍데기/길이
  ['()', false],
  ['  ', false],
  ['가', false], // 1자
  ['', false],
];

describe('backfillProperty — 색인 판정 규칙', () => {
  it('INDEXABLE_EXPR 이 필요한 조건을 모두 담고 있다', () => {
    // 규칙이 빠지면 색인 대상이 넓어져 thin URL 이 사이트맵에 유입된다.
    expect(INDEXABLE_EXPR).toContain("buildingName IS NOT NULL");
    expect(INDEXABLE_EXPR).toContain("buildingName != ''");
    expect(INDEXABLE_EXPR).toContain('CHAR_LENGTH(buildingName) >= 2');
    expect(INDEXABLE_EXPR).toContain("'^[[:space:]]*[(][0-9]'");
    expect(INDEXABLE_EXPR).toContain("'^[0-9()[:space:]-]+$'");
  });

  it.each(SAMPLES)('TS 판정과 SQL 판정이 일치한다: %j → %s', (name, expected) => {
    expect(isValidBuildingName(name), `isValidBuildingName(${JSON.stringify(name)})`).toBe(expected);
    expect(sqlIndexableEquivalent(name), `SQL 등가식(${JSON.stringify(name)})`).toBe(expected);
  });

  it('null 은 양쪽 모두 색인 대상이 아니다', () => {
    expect(isValidBuildingName(null)).toBe(false);
    expect(sqlIndexableEquivalent(null)).toBe(false);
  });
});
