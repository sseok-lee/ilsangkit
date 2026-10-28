// 실거래 상세 ↔ K-apt 단지 매칭.
//
// 지번(시군구+법정동+본번·부번)으로 먼저 찾고, 지번으로 1곳이 안 정해지면 도로명 주소(도로명+건물번호)로,
// 둘 다 후보가 없을 때만 이름으로 찾는다. 큰 필지 하나에 단지 여러 개가 있으면 도로명 건물번호로 갈린다.
// 이름 매칭은 오매칭을 막으려고 숫자 열(단지·차수)과 연식(±1년)이 함께 맞아야 한다.
// 후보가 2곳 이상이면 어느 쪽도 고르지 않는다 — 남의 단지 정보를 보여 주는 것보다 안 보여 주는 게 낫다.

import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import type { ComplexInfo } from '../types/housingRedesign.js';

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

/** "개포로109길 9", "서울특별시 강남구 개포로 264 (개포동)" → "개포로109길 9" 꼴의 비교 키. 도로명이 없으면 null. */
export function roadKey(text: string | null | undefined): string | null {
  const cleaned = (text ?? '').replace(/\([^)]*\)/g, ' ');
  const matches = [...cleaned.matchAll(/(\S+(?:로|길))\s*(\d+(?:-\d+)?)/g)];
  const last = matches[matches.length - 1];
  if (!last) return null;
  const buildingNo = last[2].split('-').map((n) => String(Number(n))).join('-');
  return `${last[1]} ${buildingNo}`;
}

export interface KaptMatchInput {
  /** 실거래 bjdCode(시군구 5자리) */
  sggCode: string;
  /** 1순위: 건물 정보 주소, 그다음 상세 개요 주소 후보 */
  primaryAddress: { dongName: string | null; jibun: string | null; roadName?: string | null } | null;
  addresses: Array<{ dongName: string; jibun: string | null; roadName?: string | null }>;
  /** 주소 합치기 전 신고된 도로명 전부(같은 지번에 도로명이 여럿 신고될 수 있다) */
  roadNames?: string[];
  buildingName: string;
  buildYear: number | null;
}

interface CandidateRow {
  kaptCode: string;
  name: string;
  eupmyeon: string | null;
  dongri: string | null;
  useApprovalDate: string | null;
}

interface SggCandidateRow extends CandidateRow {
  roadAddress: string | null;
}

/** 한 주소로 찾은 활성 단지코드(중복 제거). 지번이 파싱되지 않으면 빈 배열. */
async function kaptCodesAtAddress(sggCode: string, dongName: string | null, jibun: string | null): Promise<string[]> {
  const parcel = parseParcel(jibun);
  if (!parcel || !dongName) return [];
  const dong = splitDongName(dongName);
  const rows = await prisma.$queryRaw<CandidateRow[]>(Prisma.sql`
    SELECT DISTINCT k.kaptCode, k.name, k.eupmyeon, k.dongri, k.useApprovalDate
    FROM KaptComplexParcel p
    JOIN KaptComplex k ON k.kaptCode = p.kaptCode
    WHERE p.sggCode = ${sggCode} AND p.mainNo = ${parcel.mainNo} AND p.subNo = ${parcel.subNo}
      AND p.isMountain = ${parcel.isMountain} AND k.active = true`);
  return [...new Set(rows.filter((row) => dongMatches(dong, row)).map((row) => row.kaptCode))];
}

async function matchByAddress(input: KaptMatchInput): Promise<string[]> {
  const primary = input.primaryAddress;
  if (primary) {
    const codes = await kaptCodesAtAddress(input.sggCode, primary.dongName, primary.jibun);
    if (codes.length > 0) return codes;
  }
  const codes = new Set<string>();
  for (const address of input.addresses) {
    for (const code of await kaptCodesAtAddress(input.sggCode, address.dongName, address.jibun)) codes.add(code);
  }
  return [...codes];
}

/** 같은 시군구 필지가 있는 활성 단지(도로명·이름 매칭 공용). 시군구당 수백 건, 인덱스 범위 조회. */
async function loadSggCandidates(sggCode: string): Promise<SggCandidateRow[]> {
  return prisma.$queryRaw<SggCandidateRow[]>(Prisma.sql`
    SELECT DISTINCT k.kaptCode, k.name, k.eupmyeon, k.dongri, k.useApprovalDate, k.roadAddress
    FROM KaptComplexParcel p
    JOIN KaptComplex k ON k.kaptCode = p.kaptCode
    WHERE p.sggCode = ${sggCode} AND k.active = true`);
}

/** 상세의 도로명 주소(건물·개요 주소 후보 전부)가 가리키는 단지코드. */
function matchByRoad(input: KaptMatchInput, candidates: SggCandidateRow[]): string[] {
  const localKeys = new Set(
    [
      ...[input.primaryAddress, ...input.addresses].map((address) => address?.roadName),
      ...(input.roadNames ?? []),
    ]
      .map((roadName) => roadKey(roadName))
      .filter((key): key is string => key !== null),
  );
  if (localKeys.size === 0) return [];
  return [...new Set(candidates.filter((row) => localKeys.has(roadKey(row.roadAddress) ?? '')).map((row) => row.kaptCode))];
}

function matchByName(input: KaptMatchInput, candidates: SggCandidateRow[]): string | null {
  const dongName = input.primaryAddress?.dongName || input.addresses[0]?.dongName;
  if (!dongName) return null;
  const dong = splitDongName(dongName);
  const local = { name: input.buildingName, buildYear: input.buildYear };
  const codes = new Set(candidates.filter((row) => dongMatches(dong, row) && isNameMatch(local, row)).map((row) => row.kaptCode));
  return codes.size === 1 ? [...codes][0] : null;
}

interface ComplexRow {
  kaptCode: string;
  name: string;
  householdCount: number | null;
  dongCount: number | null;
  topFloor: number | null;
  basementFloors: number | null;
  useApprovalDate: string | null;
  totalParking: number | null;
  groundParking: number | null;
  undergroundParking: number | null;
  heatingType: string | null;
  corridorType: string | null;
  builder: string | null;
  developer: string | null;
  managementType: string | null;
  saleType: string | null;
  cctvCount: number | null;
  raw: unknown;
}

const ELEVATOR_KEYS = [
  '승강기(승객용)', '승강기(화물용)', '승강기(승객+화물)', '승강기(장애인)', '승강기(비상용)', '승강기(기타)',
];
const EV_CHARGER_KEYS = ['전기차 충전시설 설치대수(지상)', '전기차 충전시설 설치대수(지하)'];

/** 원본 칸의 숫자 합. 모든 칸이 비었거나 숫자가 아니면 null. */
export function sumRawCounts(raw: unknown, keys: string[]): number | null {
  const record = (typeof raw === 'string' ? JSON.parse(raw) : raw) as Record<string, unknown> | null;
  if (!record || typeof record !== 'object') return null;
  let total: number | null = null;
  for (const key of keys) {
    const text = String(record[key] ?? '').trim();
    if (text === '' || !Number.isFinite(Number(text))) continue;
    total = (total ?? 0) + Math.round(Number(text));
  }
  return total;
}

export function formatApprovalDate(value: string | null): string | null {
  if (!value || !/^\d{8}$/.test(value)) return null;
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
}

const nullableNumber = (value: unknown): number | null => (value === null || value === undefined ? null : Number(value));

async function loadComplexInfo(kaptCode: string, matchType: ComplexInfo['matchType']): Promise<ComplexInfo | null> {
  const [complexRows, areaRows, sourceRows] = await Promise.all([
    prisma.$queryRaw<ComplexRow[]>(Prisma.sql`
      SELECT kaptCode, name, householdCount, dongCount, topFloor, basementFloors, useApprovalDate,
             totalParking, groundParking, undergroundParking, heatingType, corridorType, builder, developer,
             managementType, saleType, cctvCount, raw
      FROM KaptComplex WHERE kaptCode = ${kaptCode} AND active = true LIMIT 1`),
    prisma.$queryRaw<Array<{ exclusiveArea: unknown; householdCount: unknown }>>(Prisma.sql`
      SELECT exclusiveArea, householdCount FROM KaptComplexArea WHERE kaptCode = ${kaptCode} ORDER BY exclusiveArea`),
    prisma.$queryRaw<Array<{ fileDate: string | null }>>(Prisma.sql`
      SELECT DATE_FORMAT(fileDate, '%Y-%m-%d') AS fileDate FROM KaptSourceFile WHERE dataset = 'basic'`),
  ]);
  const row = complexRows[0];
  if (!row) return null;
  return {
    matchType,
    kaptCode: row.kaptCode,
    name: row.name,
    householdCount: nullableNumber(row.householdCount),
    dongCount: nullableNumber(row.dongCount),
    topFloor: nullableNumber(row.topFloor),
    basementFloors: nullableNumber(row.basementFloors),
    useApprovalDate: formatApprovalDate(row.useApprovalDate),
    totalParking: nullableNumber(row.totalParking),
    groundParking: nullableNumber(row.groundParking),
    undergroundParking: nullableNumber(row.undergroundParking),
    heatingType: row.heatingType,
    corridorType: row.corridorType,
    builder: row.builder,
    developer: row.developer,
    managementType: row.managementType,
    saleType: row.saleType,
    elevatorCount: sumRawCounts(row.raw, ELEVATOR_KEYS),
    cctvCount: nullableNumber(row.cctvCount),
    evChargerCount: sumRawCounts(row.raw, EV_CHARGER_KEYS),
    areas: areaRows.map((area) => ({ exclusiveArea: Number(area.exclusiveArea), householdCount: Number(area.householdCount) })),
    sourceDate: sourceRows[0]?.fileDate ?? null,
  };
}

/**
 * 상세에 연결되는 K-apt 단지.
 * - 지번 1곳: address. 단, 도로명이 다른 1곳을 가리키면 어느 쪽이 맞는지 몰라 null.
 * - 지번 2곳 이상: 도로명 1곳이 그 후보 안에 있으면 road, 아니면 null(이름으로 넘기지 않는다).
 * - 지번 0곳: 도로명 1곳이면 road(이름이 다른 1곳을 가리키면 null), 도로명 후보가 여럿이면 null,
 *   도로명 후보가 없으면 이름 1곳이면 name.
 */
export async function findKaptComplex(input: KaptMatchInput): Promise<ComplexInfo | null> {
  if (!/^\d{5}$/.test(input.sggCode)) return null;
  const [addressCodes, candidates] = await Promise.all([matchByAddress(input), loadSggCandidates(input.sggCode)]);
  const roadCodes = matchByRoad(input, candidates);
  const roadCode = roadCodes.length === 1 ? roadCodes[0] : null;

  if (addressCodes.length === 1) {
    if (roadCode && roadCode !== addressCodes[0]) return null;
    return loadComplexInfo(addressCodes[0], 'address');
  }
  if (addressCodes.length > 1) {
    return roadCode && addressCodes.includes(roadCode) ? loadComplexInfo(roadCode, 'road') : null;
  }
  if (roadCodes.length > 1) return null;
  const nameCode = matchByName(input, candidates);
  // 실거래 도로명이 이웃 단지 주소로 잘못 신고된 경우가 있어, 이름이 다른 단지를 가리키면 고르지 않는다.
  if (roadCode) return nameCode && nameCode !== roadCode ? null : loadComplexInfo(roadCode, 'road');
  return nameCode ? loadComplexInfo(nameCode, 'name') : null;
}
