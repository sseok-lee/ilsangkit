// 실거래 상세 ↔ K-apt 단지 매칭.
//
// 주소(시군구+법정동+지번)로 먼저 찾고, 주소 후보가 하나도 없을 때만 이름으로 찾는다.
// 이름 매칭은 오매칭을 막으려고 숫자 열(단지·차수)과 연식(±1년)이 함께 맞아야 한다.
// 후보가 2곳 이상이면 어느 쪽도 고르지 않는다 — 남의 단지 정보를 보여 주는 것보다 안 보여 주는 게 낫다.

export interface ParsedParcel {
  isMountain: boolean;
  mainNo: number;
  subNo: number;
}

/** "649", "649-1", "산12-3" 만 받는다. 블록·가지번("가-240", "BL")은 null. */
export function parseParcel(jibun: string | null | undefined): ParsedParcel | null {
  if (!jibun) return null;
  const m = /^(산)?\s*(\d+)(?:-(\d+))?$/.exec(jibun.trim());
  if (!m) return null;
  const mainNo = Number(m[2]);
  if (mainNo === 0) return null;
  return { isMountain: m[1] === '산', mainNo, subNo: m[3] ? Number(m[3]) : 0 };
}

export interface DongParts {
  eupmyeon: string | null;
  dongri: string;
}

/** 실거래 법정동명. "오송읍 서평리"처럼 두 토큰이면 앞이 읍면. */
export function splitDongName(dongName: string): DongParts {
  const tokens = dongName.trim().split(/\s+/).filter(Boolean);
  const dongri = tokens[tokens.length - 1] ?? '';
  return { eupmyeon: tokens.length >= 2 ? tokens[tokens.length - 2] : null, dongri };
}

export function dongMatches(
  local: DongParts,
  kapt: { eupmyeon: string | null; dongri: string | null },
): boolean {
  const kaptDong = kapt.dongri || kapt.eupmyeon;
  if (!local.dongri || kaptDong !== local.dongri) return false;
  if (local.eupmyeon && kapt.eupmyeon !== local.eupmyeon) return false;
  return true;
}

const ROMAN_DIGITS: Array<[RegExp, string]> = [
  [/Ⅰ/g, '1'], [/Ⅱ/g, '2'], [/Ⅲ/g, '3'], [/Ⅳ/g, '4'], [/Ⅴ/g, '5'],
];

function stripParensAndRoman(name: string): string {
  let s = name.replace(/\([^)]*\)/g, '');
  for (const [re, digit] of ROMAN_DIGITS) s = s.replace(re, digit);
  return s;
}

const SPELLING_UNIFY: Array<[RegExp, string]> = [
  [/엘에이치/g, 'lh'],
  [/에스케이/g, 'sk'],
  [/i'?park|아이파크/g, 'ipark'],
  [/e편한세상|이-편한세상/g, '이편한세상'],
  [/플래티넘/g, '플레티넘'],
];

export function normalizeComplexName(name: string): string {
  let s = stripParensAndRoman(name).toLowerCase().replace(/아파트/g, '');
  for (const [re, to] of SPELLING_UNIFY) s = s.replace(re, to);
  return s.replace(/[^가-힣a-z0-9]/g, '');
}

export function nameNumbers(name: string): string[] {
  return stripParensAndRoman(name).match(/\d+/g)?.map((n) => String(Number(n))) ?? [];
}

function approvalYearOf(useApprovalDate: string | null): number | null {
  if (!useApprovalDate || !/^\d{8}$/.test(useApprovalDate)) return null;
  return Number(useApprovalDate.slice(0, 4));
}

export function isNameMatch(
  local: { name: string; buildYear: number | null },
  kapt: { name: string; useApprovalDate: string | null },
): boolean {
  const year = approvalYearOf(kapt.useApprovalDate);
  if (local.buildYear == null || year == null || Math.abs(local.buildYear - year) > 1) return false;
  if (nameNumbers(local.name).join(',') !== nameNumbers(kapt.name).join(',')) return false;

  const a = normalizeComplexName(local.name);
  const b = normalizeComplexName(kapt.name);
  if (!a || !b) return false;
  if (a === b) return true;
  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
  return shorter.length >= 3 && longer.includes(shorter);
}
