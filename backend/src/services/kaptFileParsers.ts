// K-apt 자료실 주간 xlsx(기본정보·필지고유번호·면적정보) 파서.
//
// 세 파일 모두 1행은 안내문을 셀마다 반복하고, 2행이 헤더, 3행부터 데이터다.
// 숫자도 문자열("150.0")로 들어 있다. 헤더가 바뀌면 조용히 빈 값을 넣지 않고 예외로 멈춘다.

import ExcelJS from 'exceljs';
import { cellToString } from './kricSubwayFileDownloader.js';

const HEADER_ROW = 2;

/** 컬럼으로 옮기는 기본정보 헤더. 하나라도 없으면 제공처 스키마 변경으로 보고 멈춘다. */
export const KAPT_BASIC_REQUIRED_HEADERS = [
  '시도', '시군구', '읍면', '동리', '단지코드', '단지명', '단지분류', '법정동주소', '우편번호',
  '도로명주소', '분양형태', '사용승인일', '동수', '세대수', '분양세대수', '임대세대수',
  '관리방식', '난방방식', '복도유형', '시공사', '시행사', '건물구조',
  '총주차대수', '지상주차대수', '지하주차대수', 'CCTV대수',
  '최고층수', '최고층수(건축물대장상)', '지하층수',
] as const;

export interface KaptBasicItem {
  kaptCode: string;
  sido: string;
  sigungu: string;
  eupmyeon: string | null;
  dongri: string | null;
  name: string;
  complexType: string | null;
  lawAddress: string | null;
  roadAddress: string | null;
  zipcode: string | null;
  saleType: string | null;
  useApprovalDate: string | null;
  dongCount: number | null;
  householdCount: number | null;
  saleHouseholdCount: number | null;
  rentHouseholdCount: number | null;
  managementType: string | null;
  heatingType: string | null;
  corridorType: string | null;
  builder: string | null;
  developer: string | null;
  buildingStructure: string | null;
  topFloor: number | null;
  topFloorLedger: number | null;
  basementFloors: number | null;
  totalParking: number | null;
  groundParking: number | null;
  undergroundParking: number | null;
  cctvCount: number | null;
  /** 원본 행 전체 (헤더명 → 셀 문자열) */
  raw: Record<string, string>;
}

export interface KaptParcelItem {
  kaptCode: string;
  pnu: string;
  sggCode: string;
  bjdCode: string;
  isMountain: boolean;
  mainNo: number;
  subNo: number;
}

export interface KaptAreaItem {
  kaptCode: string;
  /** 소수 4자리 문자열 — Decimal 컬럼에 그대로 넣는다 */
  exclusiveArea: string;
  householdCount: number;
}

export interface KaptComplexAreaTotals {
  managementArea: string | null;
  exclusiveAreaTotal: string | null;
}

/** 필지고유번호(19자리) = 법정동코드 10 + 산여부 1(1 일반, 2 산) + 본번 4 + 부번 4 */
export function parsePnu(value: unknown): Omit<KaptParcelItem, 'kaptCode'> | null {
  const pnu = String(value ?? '').trim();
  if (!/^\d{19}$/.test(pnu)) return null;
  return {
    pnu,
    sggCode: pnu.slice(0, 5),
    bjdCode: pnu.slice(0, 10),
    isMountain: pnu[10] === '2',
    mainNo: Number(pnu.slice(11, 15)),
    subNo: Number(pnu.slice(15, 19)),
  };
}

function text(value: string | undefined): string | null {
  const v = (value ?? '').trim();
  return v === '' ? null : v;
}

/** "678.0" → 678. 빈 값·숫자가 아니면 null (0 은 그대로 0). */
function int(value: string | undefined): number | null {
  const v = (value ?? '').trim();
  if (v === '' || !Number.isFinite(Number(v))) return null;
  return Math.round(Number(v));
}

/** 소수 문자열 정규화 — 숫자가 아니면 null */
function decimal(value: string | undefined, digits: number): string | null {
  const v = (value ?? '').trim();
  if (v === '' || !Number.isFinite(Number(v))) return null;
  return Number(v).toFixed(digits);
}

interface SheetRows {
  headers: string[];
  rows: Array<Record<string, string>>;
}

async function readSheet(buffer: Buffer, required: readonly string[]): Promise<SheetRows> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error('워크시트 없음');

  const headers: string[] = [];
  const headerCols: Array<[string, number]> = [];
  sheet.getRow(HEADER_ROW).eachCell((cell, col) => {
    const name = cellToString(cell.value).trim();
    if (name === '') return;
    headers.push(name);
    headerCols.push([name, col]);
  });

  const missing = required.filter((h) => !headers.includes(h));
  if (missing.length > 0) {
    throw new Error(`K-apt 파일 헤더 누락: ${missing.join(', ')} — 제공처 스키마 변경 여부 확인 필요`);
  }

  const rows: Array<Record<string, string>> = [];
  for (let r = HEADER_ROW + 1; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const record: Record<string, string> = {};
    let empty = true;
    for (const [name, col] of headerCols) {
      const value = cellToString(row.getCell(col).value).trim();
      record[name] = value;
      if (value !== '') empty = false;
    }
    if (!empty) rows.push(record);
  }
  return { headers, rows };
}

export async function parseKaptBasicXlsx(buffer: Buffer): Promise<{ headers: string[]; items: KaptBasicItem[] }> {
  const { headers, rows } = await readSheet(buffer, KAPT_BASIC_REQUIRED_HEADERS);
  const items: KaptBasicItem[] = [];
  for (const r of rows) {
    const kaptCode = text(r['단지코드']);
    if (!kaptCode) continue;
    items.push({
      kaptCode,
      sido: r['시도'] ?? '',
      sigungu: r['시군구'] ?? '',
      eupmyeon: text(r['읍면']),
      dongri: text(r['동리']),
      name: r['단지명'] ?? '',
      complexType: text(r['단지분류']),
      lawAddress: text(r['법정동주소']),
      roadAddress: text(r['도로명주소']),
      zipcode: text(r['우편번호']),
      saleType: text(r['분양형태']),
      useApprovalDate: text(r['사용승인일']),
      dongCount: int(r['동수']),
      householdCount: int(r['세대수']),
      saleHouseholdCount: int(r['분양세대수']),
      rentHouseholdCount: int(r['임대세대수']),
      managementType: text(r['관리방식']),
      heatingType: text(r['난방방식']),
      corridorType: text(r['복도유형']),
      builder: text(r['시공사']),
      developer: text(r['시행사']),
      buildingStructure: text(r['건물구조']),
      topFloor: int(r['최고층수']),
      topFloorLedger: int(r['최고층수(건축물대장상)']),
      basementFloors: int(r['지하층수']),
      totalParking: int(r['총주차대수']),
      groundParking: int(r['지상주차대수']),
      undergroundParking: int(r['지하주차대수']),
      cctvCount: int(r['CCTV대수']),
      raw: r,
    });
  }
  return { headers, items };
}

export async function parseKaptParcelXlsx(buffer: Buffer): Promise<{ items: KaptParcelItem[]; skipped: number }> {
  const { rows } = await readSheet(buffer, ['고유번호', '단지코드(kapt)']);
  const seen = new Set<string>();
  const items: KaptParcelItem[] = [];
  let skipped = 0;
  for (const r of rows) {
    const kaptCode = text(r['단지코드(kapt)']);
    const parcel = parsePnu(r['고유번호']);
    if (!kaptCode || !parcel) { skipped++; continue; }
    const key = `${kaptCode}|${parcel.pnu}`;
    if (seen.has(key)) { skipped++; continue; }
    seen.add(key);
    items.push({ kaptCode, ...parcel });
  }
  return { items, skipped };
}

export async function parseKaptAreaXlsx(
  buffer: Buffer,
): Promise<{ areas: KaptAreaItem[]; complexes: Map<string, KaptComplexAreaTotals> }> {
  const { rows } = await readSheet(buffer, ['단지코드', '관리비부과면적', '주거전용면적(단지합계)', '주거전용면적(세부)', '세대수']);
  // 같은 단지·같은 면적이 여러 행이면 세대수를 더한다 (동별로 나뉘어 들어오는 경우).
  const byKey = new Map<string, KaptAreaItem>();
  const complexes = new Map<string, KaptComplexAreaTotals>();
  for (const r of rows) {
    const kaptCode = text(r['단지코드']);
    const area = decimal(r['주거전용면적(세부)'], 4);
    const households = int(r['세대수']);
    if (!kaptCode) continue;
    if (!complexes.has(kaptCode)) {
      complexes.set(kaptCode, {
        managementArea: decimal(r['관리비부과면적'], 2),
        exclusiveAreaTotal: decimal(r['주거전용면적(단지합계)'], 2),
      });
    }
    if (!area || households === null) continue;
    const key = `${kaptCode}|${area}`;
    const prev = byKey.get(key);
    if (prev) prev.householdCount += households;
    else byKey.set(key, { kaptCode, exclusiveArea: area, householdCount: households });
  }
  return { areas: [...byKey.values()], complexes };
}
