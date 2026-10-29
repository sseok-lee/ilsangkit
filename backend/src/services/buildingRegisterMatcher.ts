// 실거래 상세 → 건축물대장 연결 (스펙 §6~§7). K-apt 단지 정보가 없는 상세에서만 부른다.
//
// 지번 키(시군구·법정동·대지구분·번·지)로 표제부를 찾고, 한 지번에 이름이 여러 종류면 상세 이름과 맞는 것만 남긴다.
// 못 가르면 보여 주지 않는다 — 같은 지번의 다른 단지 값을 섞는 것보다 비워 두는 편이 낫다.

import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import type { BuildingRegisterInfo } from '../types/housingRedesign.js';
import { isOffitelPurpose, parcelKeyString, type ParcelKey } from './buildingRegisterParser.js';
import { formatApprovalDate, nameNumbers, parseParcel } from './kaptComplexMatcher.js';

export type RegisterKind = BuildingRegisterInfo['kind'];

export interface RegisterTitle {
  bldNm: string | null;
  dongNm: string | null;
  mainPurpsCdNm: string | null;
  etcPurps: string | null;
  hhldCnt: number | null;
  hoCnt: number | null;
  grndFlrCnt: number | null;
  ugrndFlrCnt: number | null;
  elevatorCnt: number | null;
  parkingCnt: number | null;
  useAprDay: string | null;
  strctCdNm: string | null;
}

export interface RegisterUnit {
  bldNm: string;
  dongNm: string;
  offitelUnits: number;
  totalUnits: number;
}

export interface RegisterRecap {
  hhldCnt: number | null;
  totPkngCnt: number | null;
  useAprDay: string | null;
}

export interface PickedRegister {
  titles: RegisterTitle[];
  units: RegisterUnit[];
  /** 지번에 이름이 여러 종류라 상세 이름으로 걸렀는지 — 걸렀으면 총괄표제부(지번 전체)는 쓰지 않는다 */
  nameFiltered: boolean;
}

export interface RegisterMatchInput {
  kind: RegisterKind;
  sggCode: string;
  primaryAddress: { dongName: string; jibun: string | null } | null;
  addresses: Array<{ dongName: string; jibun: string | null }>;
  buildingName: string;
}

/**
 * 대장 건물명 비교용. K-apt 정규화와 달리 괄호 내용을 남긴다 — 한 지번의 "탑마을(경향)"·"탑마을(선경)"을 가르는 게 괄호다.
 */
function registerName(name: string | null): string {
  return (name ?? '').toLowerCase().replace(/아파트/g, '').replace(/[^가-힣a-z0-9]/g, '');
}

function namesMatch(local: string, register: string): boolean {
  const a = registerName(local);
  const b = registerName(register);
  if (!a || !b) return false;
  if (nameNumbers(local).join(',') !== nameNumbers(register).join(',')) return false;
  if (a === b) return true;
  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
  return shorter.length >= 3 && longer.includes(shorter);
}

/** 아파트·빌라는 세대가 있는 동만(경비실·지하주차장도 주용도가 공동주택이다), 오피스텔은 오피스텔 용도 동만. */
function isKindRow(kind: RegisterKind, row: RegisterTitle): boolean {
  return kind === 'offitel' ? isOffitelPurpose(row.mainPurpsCdNm, row.etcPurps) : (row.hhldCnt ?? 0) > 0;
}

export function selectRegisterRows(
  kind: RegisterKind,
  titles: RegisterTitle[],
  units: RegisterUnit[],
  buildingName: string,
): PickedRegister | null {
  const rows = titles.filter((row) => isKindRow(kind, row));
  if (rows.length === 0) return null;

  const names = new Map<string, string>(); // 정규화 → 원래 이름
  for (const row of rows) {
    const key = registerName(row.bldNm);
    if (key) names.set(key, row.bldNm!);
  }
  if (names.size <= 1) return { titles: rows, units, nameFiltered: false };

  const matched = [...names.entries()].filter(([, original]) => namesMatch(buildingName, original));
  if (matched.length !== 1) return null;
  const [key] = matched[0];
  return {
    titles: rows.filter((row) => registerName(row.bldNm) === key),
    units: units.filter((unit) => registerName(unit.bldNm) === key),
    nameFiltered: true,
  };
}

const sumOf = (values: Array<number | null>): number | null =>
  values.every((v) => v === null) ? null : values.reduce<number>((acc, v) => acc + (v ?? 0), 0);
const maxOf = (values: Array<number | null>): number | null => {
  const present = values.filter((v): v is number => v !== null);
  return present.length > 0 ? Math.max(...present) : null;
};
const positive = (value: number | null | undefined): number | null => (value && value > 0 ? value : null);

function mostCommon(values: Array<string | null>): string | null {
  const counts = new Map<string, number>();
  for (const v of values) if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

/** 공동주택 세부 용도(아파트·연립주택·다세대주택)를 세대수 많은 순으로 2개까지 */
function residentialPurposes(rows: RegisterTitle[]): string[] {
  const households = new Map<string, number>();
  for (const row of rows) {
    const purpose = row.etcPurps?.match(/아파트|연립주택|다세대주택/)?.[0] ?? row.mainPurpsCdNm;
    if (purpose) households.set(purpose, (households.get(purpose) ?? 0) + (row.hhldCnt ?? 0));
  }
  return [...households.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([p]) => p);
}

export function summarizeRegister(
  kind: RegisterKind,
  picked: PickedRegister,
  recap: RegisterRecap | null,
  sourceMonth: string | null,
  unitSourceMonth: string | null,
): BuildingRegisterInfo | null {
  const rows = picked.titles;
  // 총괄표제부는 지번 전체 값이라, 이름으로 거른 경우에는 쓰지 않는다.
  const wholeParcel = picked.nameFiltered ? null : recap;
  const householdCount = kind === 'residential'
    ? positive(wholeParcel?.hhldCnt) ?? positive(sumOf(rows.map((r) => r.hhldCnt)))
    : null;
  const offitelUnitCount = kind === 'offitel' && picked.units.length > 0
    ? positive(picked.units.reduce((acc, u) => acc + u.offitelUnits, 0))
    : null;
  const dongNames = new Set(rows.map((r) => r.dongNm?.trim()).filter(Boolean));
  const approvalDays = rows.map((r) => r.useAprDay).filter((d): d is string => Boolean(d)).sort();
  const info: BuildingRegisterInfo = {
    kind,
    householdCount,
    offitelUnitCount,
    dongCount: dongNames.size > 0 ? dongNames.size : rows.length,
    topFloor: positive(maxOf(rows.map((r) => r.grndFlrCnt))),
    basementFloors: maxOf(rows.map((r) => r.ugrndFlrCnt)),
    useApprovalDate: formatApprovalDate(approvalDays[0] ?? null),
    totalParking: positive(wholeParcel?.totPkngCnt) ?? positive(sumOf(rows.map((r) => r.parkingCnt))),
    elevatorCount: sumOf(rows.map((r) => r.elevatorCnt)),
    purposes: kind === 'offitel' ? ['오피스텔'] : residentialPurposes(rows),
    structure: mostCommon(rows.map((r) => r.strctCdNm)),
    sourceMonth,
    unitSourceMonth: offitelUnitCount !== null ? unitSourceMonth : null,
  };
  const hasValue = info.householdCount !== null || info.offitelUnitCount !== null
    || info.topFloor !== null || info.useApprovalDate !== null;
  return hasValue ? info : null;
}

/** 실거래 법정동명 → 대장 법정동코드. 전체 이름 먼저, 없으면 마지막 토큰("오송읍 서평리" → "서평리"). 하나일 때만. */
export async function resolveBjdongCode(sggCode: string, dongName: string): Promise<string | null> {
  const lookup = (name: string): Promise<Array<{ bjdongCode: string }>> => prisma.$queryRaw(Prisma.sql`
    SELECT DISTINCT bjdongCode FROM BuildingRegisterDong WHERE sggCode = ${sggCode} AND dongName = ${name}`);
  const full = dongName.trim();
  let rows = await lookup(full);
  const tokens = full.split(/\s+/);
  if (rows.length === 0 && tokens.length > 1) rows = await lookup(tokens[tokens.length - 1]);
  return rows.length === 1 ? rows[0].bjdongCode : null;
}

async function parcelKeyOf(sggCode: string, address: { dongName: string; jibun: string | null }): Promise<ParcelKey | null> {
  const parcel = parseParcel(address.jibun);
  if (!parcel || !address.dongName) return null;
  const bjdongCode = await resolveBjdongCode(sggCode, address.dongName);
  if (!bjdongCode) return null;
  return {
    sggCode,
    bjdongCode,
    platGbCd: parcel.isMountain ? '1' : '0',
    bun: String(parcel.mainNo).padStart(4, '0'),
    ji: String(parcel.subNo).padStart(4, '0'),
  };
}

async function loadTitles(key: ParcelKey): Promise<RegisterTitle[]> {
  return prisma.$queryRaw<RegisterTitle[]>(Prisma.sql`
    SELECT bldNm, dongNm, mainPurpsCdNm, etcPurps, hhldCnt, hoCnt, grndFlrCnt, ugrndFlrCnt, elevatorCnt, parkingCnt,
           useAprDay, strctCdNm
    FROM BuildingRegisterTitle
    WHERE sggCode = ${key.sggCode} AND bjdongCode = ${key.bjdongCode} AND platGbCd = ${key.platGbCd}
      AND bun = ${key.bun} AND ji = ${key.ji} AND mainAtchGbCd = '0'`);
}

/** 주 주소 → 실패하면 주소 후보. 후보가 서로 다른 지번(대장 행이 있는)을 가리키면 null. */
async function findParcel(input: RegisterMatchInput): Promise<{ key: ParcelKey; titles: RegisterTitle[] } | null> {
  if (input.primaryAddress) {
    const key = await parcelKeyOf(input.sggCode, input.primaryAddress);
    if (key) {
      const titles = await loadTitles(key);
      if (titles.length > 0) return { key, titles };
    }
  }
  const found = new Map<string, { key: ParcelKey; titles: RegisterTitle[] }>();
  for (const address of input.addresses) {
    const key = await parcelKeyOf(input.sggCode, address);
    if (!key || found.has(parcelKeyString(key))) continue;
    const titles = await loadTitles(key);
    if (titles.length > 0) found.set(parcelKeyString(key), { key, titles });
  }
  return found.size === 1 ? [...found.values()][0] : null;
}

const num = (value: unknown): number | null => (value === null || value === undefined ? null : Number(value));

export async function findBuildingRegister(input: RegisterMatchInput): Promise<BuildingRegisterInfo | null> {
  if (!/^\d{5}$/.test(input.sggCode)) return null;
  const parcel = await findParcel(input);
  if (!parcel) return null;
  const { key } = parcel;

  const [sourceRows, recapRows, unitRows] = await Promise.all([
    prisma.$queryRaw<Array<{ taskCode: string; sourceMonth: string }>>(Prisma.sql`
      SELECT taskCode, sourceMonth FROM BuildingRegisterSourceFile WHERE taskCode IN ('0303', '0306')`),
    prisma.$queryRaw<Array<{ hhldCnt: unknown; totPkngCnt: unknown; useAprDay: string | null }>>(Prisma.sql`
      SELECT hhldCnt, totPkngCnt, useAprDay FROM BuildingRegisterRecap
      WHERE sggCode = ${key.sggCode} AND bjdongCode = ${key.bjdongCode} AND platGbCd = ${key.platGbCd}
        AND bun = ${key.bun} AND ji = ${key.ji}`),
    input.kind === 'offitel'
      ? prisma.$queryRaw<Array<{ bldNm: string; dongNm: string; offitelUnits: unknown; totalUnits: unknown; sourceMonth: string }>>(Prisma.sql`
          SELECT bldNm, dongNm, offitelUnits, totalUnits, sourceMonth FROM BuildingRegisterUnitCount
          WHERE sggCode = ${key.sggCode} AND bjdongCode = ${key.bjdongCode} AND platGbCd = ${key.platGbCd}
            AND bun = ${key.bun} AND ji = ${key.ji}`)
      : Promise.resolve([]),
  ]);
  const month = (code: string): string | null => sourceRows.find((r) => r.taskCode === code)?.sourceMonth ?? null;
  const unitMonth = month('0306');
  // 교체 중에는 새 월·이전 월 행이 잠깐 함께 있다 — 기록된 기준 월 행만 쓴다.
  const units = unitRows
    .filter((r) => r.sourceMonth === unitMonth)
    .map((r) => ({ bldNm: r.bldNm, dongNm: r.dongNm, offitelUnits: Number(r.offitelUnits), totalUnits: Number(r.totalUnits) }));
  const titles = parcel.titles.map((r) => ({
    ...r,
    hhldCnt: num(r.hhldCnt), hoCnt: num(r.hoCnt), grndFlrCnt: num(r.grndFlrCnt), ugrndFlrCnt: num(r.ugrndFlrCnt),
    elevatorCnt: num(r.elevatorCnt), parkingCnt: num(r.parkingCnt),
  }));

  const picked = selectRegisterRows(input.kind, titles, units, input.buildingName);
  if (!picked) return null;
  const recap = recapRows.length === 1
    ? { hhldCnt: num(recapRows[0].hhldCnt), totPkngCnt: num(recapRows[0].totPkngCnt), useAprDay: recapRows[0].useAprDay }
    : null;
  return summarizeRegister(input.kind, picked, recap, month('0303'), unitMonth);
}
