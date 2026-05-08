// 병원/약국 xlsx 보강 시딩 스크립트
//
// HIRA 분기별 xlsx 데이터로 API sync 결과를 보강한다.
//   - 파일 3 (시설정보): Hospital 병상수 + 설립구분
//   - 파일 9 (간호등급): Hospital.nurseGrade
//   - 파일 2 (약국 base): Pharmacy.ykiho 매칭 (좌표+이름)
//   - 파일 4 (세부정보) 약국 portion: Pharmacy 점심·휴진·접수
//   - 파일 12 (기타인력) 약국 portion: Pharmacy.pharmacistCnt
//
// 사용법:
//   npx tsx src/scripts/seedMedicalEnrich.ts
//   npm run seed:medical-enrich

import 'dotenv/config';
import prisma from '../lib/prisma.js';
import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '../../prisma/data/extra_hospital_latest');

const PHARMACY_CL_CD = '81';
const BATCH_SIZE = 500;

// ============================================
// 유틸
// ============================================

function readCellText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object' && value !== null) {
    const v = value as Record<string, unknown>;
    if (Array.isArray(v.richText)) {
      return v.richText.map((p) => (p as { text?: string }).text ?? '').join('');
    }
    if (typeof v.text === 'string') return v.text;
    if (v.result !== undefined) return String(v.result);
  }
  return String(value);
}

function safeString(v: unknown): string | null {
  const s = readCellText(v).trim();
  return s || null;
}

function safeInt(v: unknown): number | null {
  const s = readCellText(v).trim();
  if (!s) return null;
  const n = Number(s);
  return isNaN(n) ? null : Math.floor(n);
}

function normalizeTime(v: unknown): string | null {
  const s = readCellText(v).trim();
  if (!s) return null;
  const n = Number(s);
  if (isNaN(n)) return s;
  return String(n).padStart(4, '0');
}

function findFile(numPrefix: number): string | null {
  if (!fs.existsSync(DATA_DIR)) return null;
  const re = new RegExp(`^${numPrefix}\\.`);
  const f = fs.readdirSync(DATA_DIR).find((name) => re.test(name) && name.endsWith('.xlsx'));
  return f ? path.join(DATA_DIR, f) : null;
}

async function loadWorkbook(filePath: string): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  return wb;
}

function buildHeaderMap(sheet: ExcelJS.Worksheet): Map<string, number> {
  const map = new Map<string, number>();
  const header = sheet.getRow(1);
  for (let i = 1; i <= sheet.columnCount; i++) {
    const text = readCellText(header.getCell(i).value).trim();
    if (text) map.set(text, i);
  }
  return map;
}

// ============================================
// ykiho → Hospital ID 캐시 (API sync로 이미 채워진 ykiho 사용)
// ============================================

async function buildHospitalYkihoMap(): Promise<Map<string, string>> {
  const rows = await prisma.hospital.findMany({
    where: { ykiho: { not: null } },
    select: { id: true, ykiho: true },
  });
  const map = new Map<string, string>();
  for (const r of rows) if (r.ykiho) map.set(r.ykiho, r.id);
  return map;
}

// ============================================
// 약국 ykiho 매칭 (파일 2)
// ============================================

interface PharmacyXlsxRow {
  ykiho: string;
  name: string;
  lat: number | null;
  lng: number | null;
}

async function buildPharmacyYkihoFromFile2(): Promise<{ matched: number; total: number }> {
  const filePath = findFile(2);
  if (!filePath) {
    console.log('[Pharmacy ykiho] 파일 2 없음, 스킵');
    return { matched: 0, total: 0 };
  }
  console.log(`[Pharmacy ykiho] ${path.basename(filePath)} 읽는 중...`);
  const wb = await loadWorkbook(filePath);
  const sheet = wb.worksheets.find((s) => s.rowCount > 0);
  if (!sheet) return { matched: 0, total: 0 };

  const h = buildHeaderMap(sheet);
  const ykihoCol = h.get('암호화요양기호');
  const nameCol = h.get('요양기관명');
  const xCol = h.get('좌표(X)');
  const yCol = h.get('좌표(Y)');
  if (!ykihoCol || !nameCol || !xCol || !yCol) {
    console.error('[Pharmacy ykiho] 필수 컬럼 누락');
    return { matched: 0, total: 0 };
  }

  // 이름 정규화 키 → xlsx ykiho 후보들
  const byName = new Map<string, PharmacyXlsxRow[]>();
  for (let i = 2; i <= sheet.rowCount; i++) {
    const row = sheet.getRow(i);
    const ykiho = readCellText(row.getCell(ykihoCol).value).trim();
    const name = readCellText(row.getCell(nameCol).value).trim();
    const x = parseFloat(readCellText(row.getCell(xCol).value));
    const y = parseFloat(readCellText(row.getCell(yCol).value));
    if (!ykiho || !name) continue;
    const norm = name.replace(/\s+/g, '');
    const arr = byName.get(norm) ?? [];
    arr.push({ ykiho, name, lat: isNaN(y) ? null : y, lng: isNaN(x) ? null : x });
    byName.set(norm, arr);
  }
  console.log(`[Pharmacy ykiho] xlsx ${sheet.rowCount - 1}행 인덱스 완료 (이름 키 ${byName.size}개)`);

  // DB의 약국 중 ykiho 미설정만 매칭
  const pharmacies = await prisma.pharmacy.findMany({
    where: { ykiho: null },
    select: { id: true, name: true, lat: true, lng: true },
  });
  console.log(`[Pharmacy ykiho] 매칭 대상 약국: ${pharmacies.length}개`);

  let matched = 0;
  const updates: { id: string; ykiho: string }[] = [];

  for (const p of pharmacies) {
    const norm = p.name.replace(/\s+/g, '');
    const candidates = byName.get(norm);
    if (!candidates || candidates.length === 0) continue;

    let best: PharmacyXlsxRow | null = null;
    if (p.lat != null && p.lng != null) {
      const pLat = Number(p.lat);
      const pLng = Number(p.lng);
      let bestDist = Infinity;
      for (const c of candidates) {
        if (c.lat == null || c.lng == null) continue;
        const dLat = Math.abs(c.lat - pLat);
        const dLng = Math.abs(c.lng - pLng);
        const dist = dLat * dLat + dLng * dLng;
        if (dist < bestDist && dLat < 0.005 && dLng < 0.005) {
          // 약 500m 이내
          bestDist = dist;
          best = c;
        }
      }
    }
    // 좌표 매칭 실패 시 이름이 유일하면 채택
    if (!best && candidates.length === 1) best = candidates[0];

    if (best) {
      updates.push({ id: p.id, ykiho: best.ykiho });
      matched++;
    }
  }

  // 배치 업데이트
  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    const batch = updates.slice(i, i + BATCH_SIZE);
    await prisma.$transaction(
      batch.map(({ id, ykiho }) => prisma.pharmacy.update({ where: { id }, data: { ykiho } })),
    );
  }

  console.log(`[Pharmacy ykiho] 매칭 완료: ${matched}/${pharmacies.length}`);
  return { matched, total: pharmacies.length };
}

async function buildPharmacyYkihoMap(): Promise<Map<string, string>> {
  const rows = await prisma.pharmacy.findMany({
    where: { ykiho: { not: null } },
    select: { id: true, ykiho: true },
  });
  const map = new Map<string, string>();
  for (const r of rows) if (r.ykiho) map.set(r.ykiho, r.id);
  return map;
}

// ============================================
// 파일 3 (시설정보) — Hospital 병상수 + 설립구분
// ============================================

const FACILITY_BED_COLS: { header: string; field: keyof FacilityBeds }[] = [
  { header: '일반입원실상급병상수', field: 'generalUpperBeds' },
  { header: '일반입원실일반병상수', field: 'generalNormalBeds' },
  { header: '성인중환자병상수', field: 'adultIcuBeds' },
  { header: '소아중환자병상수', field: 'childIcuBeds' },
  { header: '신생아중환자병상수', field: 'neonatalIcuBeds' },
  { header: '분만실병상수', field: 'deliveryBeds' },
  { header: '수술실병상수', field: 'operatingBeds' },
  { header: '응급실병상수', field: 'emergencyBeds' },
  { header: '물리치료실병상수', field: 'physicalTherapyBeds' },
  { header: '정신과폐쇄상급병상수', field: 'psychClosedUpper' },
  { header: '정신과폐쇄일반병상수', field: 'psychClosedNormal' },
  { header: '정신과개방상급병상수', field: 'psychOpenUpper' },
  { header: '정신과개방일반병상수', field: 'psychOpenNormal' },
  { header: '격리병실병상수', field: 'isolationBeds' },
  { header: '무균치료실병상수', field: 'sterileBeds' },
];

interface FacilityBeds {
  generalUpperBeds: number | null;
  generalNormalBeds: number | null;
  adultIcuBeds: number | null;
  childIcuBeds: number | null;
  neonatalIcuBeds: number | null;
  deliveryBeds: number | null;
  operatingBeds: number | null;
  emergencyBeds: number | null;
  physicalTherapyBeds: number | null;
  psychClosedUpper: number | null;
  psychClosedNormal: number | null;
  psychOpenUpper: number | null;
  psychOpenNormal: number | null;
  isolationBeds: number | null;
  sterileBeds: number | null;
}

async function seedHospitalFacility(ykihoMap: Map<string, string>): Promise<number> {
  const filePath = findFile(3);
  if (!filePath) {
    console.log('[Hospital 시설] 파일 3 없음, 스킵');
    return 0;
  }
  console.log(`[Hospital 시설] ${path.basename(filePath)} 처리 중...`);
  const wb = await loadWorkbook(filePath);
  const sheet = wb.worksheets.find((s) => s.rowCount > 0);
  if (!sheet) return 0;

  const h = buildHeaderMap(sheet);
  const ykihoCol = h.get('암호화요양기호');
  const clCdCol = h.get('종별코드');
  const foundCdCol = h.get('설립구분코드');
  const foundCdNmCol = h.get('설립구분코드명');
  if (!ykihoCol || !clCdCol) {
    console.error('[Hospital 시설] 필수 컬럼 누락');
    return 0;
  }

  let updated = 0;
  let skipped = 0;
  const batch: { id: string; data: Record<string, unknown> }[] = [];

  const flush = async () => {
    if (batch.length === 0) return;
    await prisma.$transaction(
      batch.map(({ id, data }) => prisma.hospital.update({ where: { id }, data })),
    );
    updated += batch.length;
    batch.length = 0;
  };

  for (let i = 2; i <= sheet.rowCount; i++) {
    const row = sheet.getRow(i);
    const clCd = readCellText(row.getCell(clCdCol).value).trim();
    if (clCd === PHARMACY_CL_CD) { skipped++; continue; } // 약국 제외

    const ykiho = readCellText(row.getCell(ykihoCol).value).trim();
    if (!ykiho) { skipped++; continue; }

    const hospitalId = ykihoMap.get(ykiho);
    if (!hospitalId) { skipped++; continue; }

    const data: Record<string, unknown> = {};
    if (foundCdCol) data.foundationCd = safeString(row.getCell(foundCdCol).value);
    if (foundCdNmCol) data.foundationCdNm = safeString(row.getCell(foundCdNmCol).value);

    for (const col of FACILITY_BED_COLS) {
      const idx = h.get(col.header);
      if (!idx) continue;
      const v = safeInt(row.getCell(idx).value);
      data[col.field] = v;
    }

    if (Object.keys(data).length === 0) { skipped++; continue; }

    batch.push({ id: hospitalId, data });
    if (batch.length >= BATCH_SIZE) await flush();
  }
  await flush();
  console.log(`[Hospital 시설] 갱신 ${updated}건 / 스킵 ${skipped}건`);
  return updated;
}

// ============================================
// 파일 9 (간호등급) — Hospital.nurseGrade
// ============================================

async function seedHospitalNurseGrade(ykihoMap: Map<string, string>): Promise<number> {
  const filePath = findFile(9);
  if (!filePath) {
    console.log('[Hospital 간호등급] 파일 9 없음, 스킵');
    return 0;
  }
  console.log(`[Hospital 간호등급] ${path.basename(filePath)} 처리 중...`);
  const wb = await loadWorkbook(filePath);
  const sheet = wb.worksheets.find((s) => s.rowCount > 0);
  if (!sheet) return 0;

  const h = buildHeaderMap(sheet);
  const ykihoCol = h.get('암호화요양기호');
  const gradeCol = h.get('간호등급');
  if (!ykihoCol || !gradeCol) {
    console.error('[Hospital 간호등급] 필수 컬럼 누락');
    return 0;
  }

  let updated = 0;
  const batch: { id: string; nurseGrade: string }[] = [];

  const flush = async () => {
    if (batch.length === 0) return;
    await prisma.$transaction(
      batch.map(({ id, nurseGrade }) =>
        prisma.hospital.update({ where: { id }, data: { nurseGrade } }),
      ),
    );
    updated += batch.length;
    batch.length = 0;
  };

  for (let i = 2; i <= sheet.rowCount; i++) {
    const row = sheet.getRow(i);
    const ykiho = readCellText(row.getCell(ykihoCol).value).trim();
    if (!ykiho) continue;
    const hospitalId = ykihoMap.get(ykiho);
    if (!hospitalId) continue;
    const grade = safeString(row.getCell(gradeCol).value);
    if (!grade) continue;
    batch.push({ id: hospitalId, nurseGrade: grade });
    if (batch.length >= BATCH_SIZE) await flush();
  }
  await flush();
  console.log(`[Hospital 간호등급] 갱신 ${updated}건`);
  return updated;
}

// ============================================
// 파일 4 (세부정보) — Pharmacy 점심·휴진·접수
// ============================================

async function seedPharmacyDetail(ykihoMap: Map<string, string>): Promise<number> {
  const filePath = findFile(4);
  if (!filePath) {
    console.log('[Pharmacy 세부정보] 파일 4 없음, 스킵');
    return 0;
  }
  console.log(`[Pharmacy 세부정보] ${path.basename(filePath)} 처리 중...`);
  const wb = await loadWorkbook(filePath);
  const sheet = wb.worksheets.find((s) => s.rowCount > 0);
  if (!sheet) return 0;

  const h = buildHeaderMap(sheet);
  const ykihoCol = h.get('암호화요양기호');
  if (!ykihoCol) {
    console.error('[Pharmacy 세부정보] 암호화요양기호 누락');
    return 0;
  }

  const fields: { col: string; field: string; type: 'text' | 'time' }[] = [
    { col: '점심시간_평일', field: 'lunchWeek', type: 'text' },
    { col: '점심시간_토요일', field: 'lunchSat', type: 'text' },
    { col: '휴진안내_일요일', field: 'noTrmtSun', type: 'text' },
    { col: '휴진안내_공휴일', field: 'noTrmtHoli', type: 'text' },
    { col: '접수시간_평일', field: 'recpWeek', type: 'text' },
    { col: '접수시간_토요일', field: 'recpSat', type: 'text' },
  ];

  let updated = 0;
  const batch: { id: string; data: Record<string, unknown> }[] = [];

  const flush = async () => {
    if (batch.length === 0) return;
    await prisma.$transaction(
      batch.map(({ id, data }) => prisma.pharmacy.update({ where: { id }, data })),
    );
    updated += batch.length;
    batch.length = 0;
  };

  for (let i = 2; i <= sheet.rowCount; i++) {
    const row = sheet.getRow(i);
    const ykiho = readCellText(row.getCell(ykihoCol).value).trim();
    if (!ykiho) continue;
    const pharmacyId = ykihoMap.get(ykiho);
    if (!pharmacyId) continue;

    const data: Record<string, unknown> = { detailSyncedAt: new Date() };
    for (const f of fields) {
      const idx = h.get(f.col);
      if (!idx) continue;
      const v = f.type === 'time' ? normalizeTime(row.getCell(idx).value) : safeString(row.getCell(idx).value);
      if (v != null) data[f.field] = v;
    }
    if (Object.keys(data).length <= 1) continue; // detailSyncedAt만 있으면 스킵
    batch.push({ id: pharmacyId, data });
    if (batch.length >= BATCH_SIZE) await flush();
  }
  await flush();
  console.log(`[Pharmacy 세부정보] 갱신 ${updated}건`);
  return updated;
}

// ============================================
// 파일 12 (기타인력) — Pharmacy.pharmacistCnt
// ============================================

async function seedPharmacyStaff(ykihoMap: Map<string, string>): Promise<number> {
  const filePath = findFile(12);
  if (!filePath) {
    console.log('[Pharmacy 약사수] 파일 12 없음, 스킵');
    return 0;
  }
  console.log(`[Pharmacy 약사수] ${path.basename(filePath)} 처리 중...`);
  const wb = await loadWorkbook(filePath);
  const sheet = wb.worksheets.find((s) => s.rowCount > 0);
  if (!sheet) return 0;

  const h = buildHeaderMap(sheet);
  const ykihoCol = h.get('암호화요양기호');
  const codeNmCol = h.get('기타인력코드명');
  const cntCol = h.get('기타인력수');
  if (!ykihoCol || !codeNmCol || !cntCol) {
    console.error('[Pharmacy 약사수] 필수 컬럼 누락');
    return 0;
  }

  // 약국별 약사수 누적 (한 약국에 여러 row가 있을 수 있음)
  const totals = new Map<string, number>();
  for (let i = 2; i <= sheet.rowCount; i++) {
    const row = sheet.getRow(i);
    const ykiho = readCellText(row.getCell(ykihoCol).value).trim();
    if (!ykiho) continue;
    const pharmacyId = ykihoMap.get(ykiho);
    if (!pharmacyId) continue;
    const codeNm = readCellText(row.getCell(codeNmCol).value).trim();
    if (!codeNm.includes('약사')) continue; // 약무보조 등 제외, 약사 직군만
    const cnt = safeInt(row.getCell(cntCol).value);
    if (cnt == null) continue;
    totals.set(pharmacyId, (totals.get(pharmacyId) ?? 0) + cnt);
  }

  let updated = 0;
  const entries = [...totals.entries()];
  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = entries.slice(i, i + BATCH_SIZE);
    await prisma.$transaction(
      batch.map(([id, pharmacistCnt]) =>
        prisma.pharmacy.update({ where: { id }, data: { pharmacistCnt } }),
      ),
    );
    updated += batch.length;
  }
  console.log(`[Pharmacy 약사수] 갱신 ${updated}건`);
  return updated;
}

// ============================================
// 메인
// ============================================

export async function runMedicalEnrich(): Promise<void> {
  if (!fs.existsSync(DATA_DIR)) {
    throw new Error(
      `데이터 디렉토리 없음: ${DATA_DIR}\n` +
        'https://opendata.hira.or.kr/op/opc/selectOpenData.do?sno=11925 에서 zip 다운로드 후 해제',
    );
  }

  console.log('=== 의료기관 xlsx 보강 시딩 시작 ===');

  const hospitalYkiho = await buildHospitalYkihoMap();
  console.log(`병원 ykiho 인덱스: ${hospitalYkiho.size}개`);
  if (hospitalYkiho.size === 0) {
    console.error('Hospital 테이블에 ykiho가 없습니다. npx tsx src/scripts/syncHospital.ts 먼저 실행하세요.');
  }

  await buildPharmacyYkihoFromFile2();
  const pharmacyYkiho = await buildPharmacyYkihoMap();
  console.log(`약국 ykiho 인덱스: ${pharmacyYkiho.size}개`);

  if (hospitalYkiho.size > 0) {
    await seedHospitalFacility(hospitalYkiho);
    await seedHospitalNurseGrade(hospitalYkiho);
  }

  if (pharmacyYkiho.size > 0) {
    await seedPharmacyDetail(pharmacyYkiho);
    await seedPharmacyStaff(pharmacyYkiho);
  }

  console.log('=== 완료 ===');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runMedicalEnrich()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('시딩 실패:', err);
      process.exit(1);
    });
}
