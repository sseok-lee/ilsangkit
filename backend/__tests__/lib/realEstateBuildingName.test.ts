import { describe, it, expect } from 'vitest';
import {
  INVALID_BUILDING_NAME,
  isValidBuildingName,
} from '../../src/lib/realEstateBuildingName.js';

/**
 * AC18: regex false positive 픽스처 ≥ 50건.
 *
 * - Legitimate 건물명(valid=true) 25건
 * - 지번/thin 건물명(valid=false) 30건
 * - 경계조건 10건
 *
 * 총 65건.
 */

type Fixture = { name: string; valid: boolean; note?: string };

const LEGITIMATE: Fixture[] = [
  { name: '래미안강남', valid: true },
  { name: '래미안서초', valid: true },
  { name: '아크로리버파크', valid: true },
  { name: 'e-편한세상', valid: true, note: '영문+하이픈+한글 혼합' },
  { name: 'ABC빌라', valid: true },
  { name: '힐스테이트송도', valid: true },
  { name: 'GS자이', valid: true },
  { name: '(주)래미안타워', valid: true, note: 'G4 결정: 숫자가 아닌 괄호 접두사는 허용' },
  { name: '(사)복지아파트', valid: true },
  { name: '(유)성일하이츠', valid: true },
  { name: '현대아파트', valid: true },
  { name: '롯데캐슬', valid: true },
  { name: '푸르지오센트럴', valid: true },
  { name: '자이더캐슬', valid: true },
  { name: '반포자이', valid: true },
  { name: '트리마제', valid: true },
  { name: '가나다', valid: true, note: '순수 한글 3자' },
  { name: '우노', valid: true, note: '최소 2자' },
  { name: 'A빌라', valid: true, note: '영문+한글' },
  { name: '파크리오', valid: true },
  { name: '역삼e편한세상', valid: true },
  { name: '103동-1', valid: true, note: '숫자 시작이지만 괄호가 아님' },
  { name: '1번가빌딩', valid: true, note: '숫자 시작이지만 괄호가 아님' },
  { name: '더샵센트럴시티', valid: true },
  { name: '청담자이', valid: true },
];

const JIBUN_OR_THIN: Fixture[] = [
  { name: '(535-3)', valid: false, note: 'GSC 색인된 대표 지번 패턴' },
  { name: '(535)', valid: false },
  { name: '(1)', valid: false },
  { name: '(123-45)', valid: false },
  { name: '(999-99)', valid: false },
  { name: '  (535-3)', valid: false, note: '선행 공백' },
  { name: '(535-3)  ', valid: false, note: '후행 공백' },
  { name: '  (535-3)  ', valid: false, note: '양쪽 공백' },
  { name: '123-456', valid: false, note: '숫자·하이픈만' },
  { name: '000-0', valid: false },
  { name: '123', valid: false, note: '순수 숫자' },
  { name: '111-222-333', valid: false },
  { name: '()', valid: false, note: '빈 괄호' },
  { name: '( )', valid: false, note: '공백만' },
  { name: '--', valid: false, note: '하이픈만' },
  { name: '  --  ', valid: false },
  { name: '(3-1)아파트', valid: false, note: '숫자 시작 괄호 접두사 + 글자' },
  { name: '(101-1)힐스테이트', valid: false, note: '지번 접두 + 건물명' },
  { name: ' (1)래미안', valid: false, note: '선행 공백 + 지번 접두사' },
  { name: '(7)하이츠', valid: false },
  { name: '(0-0)', valid: false },
  { name: '12345678', valid: false },
  { name: '(1-1)', valid: false },
  { name: '-1-2', valid: false, note: '하이픈+숫자만' },
  { name: '(  )', valid: false },
  { name: '0', valid: false, note: '한 자 (길이 제한 위반)' },
  { name: '1', valid: false },
  { name: '(1', valid: false, note: '여는 괄호+숫자' },
  { name: '  ', valid: false, note: '공백 2자' },
  { name: '', valid: false },
];

const EDGE: Fixture[] = [
  { name: null as unknown as string, valid: false, note: 'null 입력' },
  { name: undefined as unknown as string, valid: false, note: 'undefined 입력' },
  { name: 'a', valid: false, note: '1자 (length < 2)' },
  { name: 'A', valid: false },
  { name: '가', valid: false, note: '한글 1자' },
  { name: 'ab', valid: true, note: '정확히 2자' },
  { name: '가나', valid: true, note: '한글 2자' },
  { name: '래미안'.normalize('NFD'), valid: true, note: 'NFD 조합형 입력도 유효' },
  { name: '\t래미안', valid: true, note: '탭 선행은 trim 후 통과' },
  { name: '\n\n', valid: false, note: '개행만' },
];

const ALL_FIXTURES: Fixture[] = [...LEGITIMATE, ...JIBUN_OR_THIN, ...EDGE];

describe('INVALID_BUILDING_NAME regex', () => {
  it('matches pure jibun patterns', () => {
    expect(INVALID_BUILDING_NAME.test('(535-3)')).toBe(true);
    expect(INVALID_BUILDING_NAME.test('123-456')).toBe(true);
    expect(INVALID_BUILDING_NAME.test('()')).toBe(true);
  });

  it('matches digit-opener paren prefix', () => {
    expect(INVALID_BUILDING_NAME.test('(3-1)아파트')).toBe(true);
  });

  it('does NOT match legitimate company-prefix names', () => {
    expect(INVALID_BUILDING_NAME.test('(주)래미안타워')).toBe(false);
    expect(INVALID_BUILDING_NAME.test('(사)OO아파트')).toBe(false);
  });

  it('does NOT match plain Korean names', () => {
    expect(INVALID_BUILDING_NAME.test('래미안강남')).toBe(false);
  });
});

describe('isValidBuildingName — fixture sweep (AC18)', () => {
  it('has ≥ 50 total fixtures', () => {
    expect(ALL_FIXTURES.length).toBeGreaterThanOrEqual(50);
  });

  for (const fx of ALL_FIXTURES) {
    const label = `${JSON.stringify(fx.name)} → ${fx.valid}${fx.note ? ` (${fx.note})` : ''}`;
    it(label, () => {
      expect(isValidBuildingName(fx.name)).toBe(fx.valid);
    });
  }
});

describe('isValidBuildingName — nullish + length guards', () => {
  it('returns false for null/undefined/empty', () => {
    expect(isValidBuildingName(null)).toBe(false);
    expect(isValidBuildingName(undefined)).toBe(false);
    expect(isValidBuildingName('')).toBe(false);
  });

  it('returns false when trimmed length < 2', () => {
    expect(isValidBuildingName(' a ')).toBe(false);
  });

  it('accepts exactly 2 trimmed chars that are not jibun', () => {
    expect(isValidBuildingName('ab')).toBe(true);
    expect(isValidBuildingName(' 가나 ')).toBe(true);
  });
});
