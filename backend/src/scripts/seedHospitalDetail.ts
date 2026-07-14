// 병원 상세정보 xlsx 시딩 스크립트
// 데이터 소스: https://opendata.hira.or.kr/op/opc/selectOpenData.do?sno=11925
// "전국 병의원 및 약국 현황 2025.12.zip" → backend/data/ 에 xlsx 파일 배치 후 실행
//
// 사용법:
//   npm run seed:hospital-detail
//   또는 특정 파일 지정:
//   npx tsx src/scripts/seedHospitalDetail.ts --file ./data/세부정보.xlsx

import 'dotenv/config';
import prisma from '../lib/prisma.js';
import { SYNC } from '../constants/index.js';
import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// ============================================
// 설정 — xlsx 파일 구조에 맞게 조정 필요
// ============================================

// xlsx 파일 경로 (backend/prisma/data/extra_hospital_latest/ 기준)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '../../prisma/data/extra_hospital_latest');

// 시트명/컬럼명 매핑 — 실제 파일 확인 후 조정
// HIRA 데이터 기준 추정 컬럼명
const DETAIL_SHEET_NAMES = ['medicInsttDetailInfo_02', '세부정보'];
const DEPT_SHEET_NAMES = ['medicInsttDetailInfo_03', '진료과목정보'];

// 세부정보 컬럼 매핑 (xlsx 헤더 → DB 필드)
const DETAIL_COLUMN_MAP: Record<string, string> = {
  '암호화요양기호': 'ykiho',
  '진료시작시간_월요일': 'trmtMonStart',
  '진료종료시간_월요일': 'trmtMonEnd',
  '진료시작시간_화요일': 'trmtTueStart',
  '진료종료시간_화요일': 'trmtTueEnd',
  '진료시작시간_수요일': 'trmtWedStart',
  '진료종료시간_수요일': 'trmtWedEnd',
  '진료시작시간_목요일': 'trmtThuStart',
  '진료종료시간_목요일': 'trmtThuEnd',
  '진료시작시간_금요일': 'trmtFriStart',
  '진료종료시간_금요일': 'trmtFriEnd',
  '진료시작시간_토요일': 'trmtSatStart',
  '진료종료시간_토요일': 'trmtSatEnd',
  '진료시작시간_일요일': 'trmtSunStart',
  '진료종료시간_일요일': 'trmtSunEnd',
  '점심시간_평일': 'lunchWeek',
  '점심시간_토요일': 'lunchSat',
  '휴진안내_일요일': 'noTrmtSun',
  '휴진안내_공휴일': 'noTrmtHoli',
  '주차_가능대수': 'parkQty',
  '주차_기타 안내사항': 'parkEtc',
};

// 진료과목 컬럼 매핑
const DEPT_COLUMN_MAP: Record<string, string> = {
  '암호화요양기호': 'ykiho',
  '진료과목코드명': 'dgsbjtCdNm',
  '과목별 전문의수': 'dgsbjtPrSdrCnt',
};

// 의료장비정보 시트/컬럼 매핑
const EQUIP_SHEET_NAMES = ['medicInsttDetailInfo_05', '의료장비정보'];
const EQUIP_COLUMN_MAP: Record<string, string> = {
  '암호화요양기호': 'ykiho',
  '장비코드': 'eqpCd',
  '장비코드명': 'eqpCdNm',
  '장비대수': 'eqpCnt',
};

// 전문병원지정분야 시트/컬럼 매핑
const SPECIALTY_SHEET_NAMES = ['medicInsttDetailInfo_09', '전문병원지정분야'];
const SPECIALTY_COLUMN_MAP: Record<string, string> = {
  '암호화요양기호': 'ykiho',
  '검색코드명': 'specialtyField',
};

// ============================================
// 유틸리티
// ============================================

/**
 * ExcelJS 셀 값에서 순수 텍스트 추출.
 * 셀이 richText 객체({ richText: [{text, font}, ...] })이거나 formula 결과({result})인
 * 경우가 있으므로 String(value)로 바로 변환하면 "[object Object]"가 나올 수 있다.
 */
function readCellText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    const v = value as Record<string, unknown>;
    if (Array.isArray(v.richText)) {
      return v.richText.map((p) => (p as { text?: string }).text ?? '').join('');
    }
    if (typeof v.text === 'string') return v.text;
    if (v.result !== undefined) return String(v.result);
  }
  return String(value);
}

function safeString(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null;
  const s = readCellText(value).trim();
  return s || null;
}

function safeInt(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  const num = Number(value);
  return isNaN(num) ? null : Math.floor(num);
}

/**
 * 진료시간 숫자→문자열 정규화
 * xlsx의 진료시간이 숫자형 (900, 2000)이므로 4자리 문자열로 변환
 * 900 → "0900", 2000 → "2000"
 */
function normalizeTime(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null;
  const num = Number(value);
  if (isNaN(num)) return String(value).trim() || null;
  return String(num).padStart(4, '0');
}

/**
 * xlsx 파일에서 시트 찾기 (여러 이름 후보 중 첫 매칭)
 */
function findSheet(workbook: ExcelJS.Workbook, candidates: string[]): ExcelJS.Worksheet | null {
  for (const name of candidates) {
    const sheet = workbook.getWorksheet(name);
    if (sheet) return sheet;
  }
  // 부분 매칭
  for (const ws of workbook.worksheets) {
    for (const name of candidates) {
      if (ws.name.includes(name)) return ws;
    }
  }
  return null;
}

/**
 * 시트의 헤더 행에서 컬럼 매핑 생성
 */
function buildColumnMapping(sheet: ExcelJS.Worksheet, columnMap: Record<string, string>): Map<number, string> {
  const mapping = new Map<number, string>();
  const headerRow = sheet.getRow(1);
  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const header = String(cell.value || '').trim();
    const dbField = columnMap[header];
    if (dbField) {
      mapping.set(colNumber, dbField);
    }
  });
  return mapping;
}

/**
 * 행 데이터를 객체로 변환
 */
function rowToObject(row: ExcelJS.Row, mapping: Map<number, string>): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  for (const [colNumber, fieldName] of mapping) {
    obj[fieldName] = row.getCell(colNumber).value;
  }
  return obj;
}

// ============================================
// ykiho → Hospital ID 매핑 캐시
// ============================================

async function buildYkihoMap(): Promise<Map<string, string>> {
  console.log('ykiho → Hospital ID 매핑 로드 중...');
  const hospitals = await prisma.hospital.findMany({
    where: { ykiho: { not: null } },
    select: { id: true, ykiho: true },
  });
  const map = new Map<string, string>();
  for (const h of hospitals) {
    if (h.ykiho) map.set(h.ykiho, h.id);
  }
  console.log(`매핑 완료: ${map.size}개 병원`);
  return map;
}

// ============================================
// 세부정보 시딩 (진료시간 + 주차)
// ============================================

async function seedDetailInfo(workbook: ExcelJS.Workbook, ykihoMap: Map<string, string>): Promise<number> {
  const sheet = findSheet(workbook, DETAIL_SHEET_NAMES);
  if (!sheet) {
    console.log('세부정보 시트를 찾을 수 없습니다. 사용 가능한 시트:', workbook.worksheets.map(w => w.name).join(', '));
    return 0;
  }

  console.log(`세부정보 시트 발견: "${sheet.name}" (${sheet.rowCount}행)`);

  const mapping = buildColumnMapping(sheet, DETAIL_COLUMN_MAP);
  if (!mapping.size) {
    console.error('세부정보 컬럼 매핑 실패. 헤더를 확인하세요.');
    const headerRow = sheet.getRow(1);
    const headers: string[] = [];
    headerRow.eachCell({ includeEmpty: false }, (cell) => headers.push(String(cell.value)));
    console.log('발견된 헤더:', headers.join(', '));
    return 0;
  }

  console.log('매핑된 컬럼:', [...mapping.values()].join(', '));

  const BATCH_SIZE = SYNC.BATCH_SIZE;
  let updated = 0;
  let skipped = 0;
  const batch: { hospitalId: string; data: Record<string, unknown> }[] = [];

  const processBatch = async () => {
    if (batch.length === 0) return;
    await prisma.$transaction(
      batch.map(({ hospitalId, data }) =>
        prisma.hospital.update({
          where: { id: hospitalId },
          data: { ...data, detailSyncedAt: new Date() },
        })
      )
    );
    updated += batch.length;
    batch.length = 0;
  };

  sheet.eachRow({ includeEmpty: false }, (_row, rowNumber) => {
    if (rowNumber === 1) return; // 헤더 스킵
    // eachRow는 동기적이므로 배치 수집만 진행
  });

  // eachRow가 동기적이므로 별도 순회
  const totalRows = sheet.rowCount;
  for (let i = 2; i <= totalRows; i++) {
    const row = sheet.getRow(i);
    const obj = rowToObject(row, mapping);

    const ykiho = safeString(obj.ykiho);
    if (!ykiho) { skipped++; continue; }

    const hospitalId = ykihoMap.get(ykiho);
    if (!hospitalId) { skipped++; continue; }

    const data: Record<string, unknown> = {};
    // 숫자형 진료시간 → 4자리 문자열 정규화 (900 → "0900")
    const numericTimeFields = ['trmtMonStart', 'trmtMonEnd', 'trmtTueStart', 'trmtTueEnd',
      'trmtWedStart', 'trmtWedEnd', 'trmtThuStart', 'trmtThuEnd',
      'trmtFriStart', 'trmtFriEnd', 'trmtSatStart', 'trmtSatEnd',
      'trmtSunStart', 'trmtSunEnd'];
    // 자유 텍스트 필드 (점심시간, 휴진안내, 주차안내)
    const textFields = ['lunchWeek', 'lunchSat', 'noTrmtSun', 'noTrmtHoli', 'parkEtc'];
    const intFields = ['parkQty'];

    for (const f of numericTimeFields) {
      if (obj[f] !== undefined) data[f] = normalizeTime(obj[f]);
    }
    for (const f of textFields) {
      if (obj[f] !== undefined) data[f] = safeString(obj[f]);
    }
    for (const f of intFields) {
      if (obj[f] !== undefined) data[f] = safeInt(obj[f]);
    }

    if (Object.keys(data).length === 0) { skipped++; continue; }

    batch.push({ hospitalId, data });

    if (batch.length >= BATCH_SIZE) {
      await processBatch();
      if (updated % 5000 === 0) {
        console.log(`세부정보: ${updated}건 업데이트 (스킵: ${skipped})`);
      }
    }
  }

  await processBatch();
  console.log(`세부정보 완료: ${updated}건 업데이트, ${skipped}건 스킵`);
  return updated;
}

// ============================================
// 진료과목 시딩
// ============================================

async function seedDepartments(workbook: ExcelJS.Workbook, ykihoMap: Map<string, string>): Promise<number> {
  const sheet = findSheet(workbook, DEPT_SHEET_NAMES);
  if (!sheet) {
    console.log('진료과목 시트를 찾을 수 없습니다. 사용 가능한 시트:', workbook.worksheets.map(w => w.name).join(', '));
    return 0;
  }

  console.log(`진료과목 시트 발견: "${sheet.name}" (${sheet.rowCount}행)`);

  const mapping = buildColumnMapping(sheet, DEPT_COLUMN_MAP);
  if (!mapping.size) {
    console.error('진료과목 컬럼 매핑 실패. 헤더를 확인하세요.');
    const headerRow = sheet.getRow(1);
    const headers: string[] = [];
    headerRow.eachCell({ includeEmpty: false }, (cell) => headers.push(String(cell.value)));
    console.log('발견된 헤더:', headers.join(', '));
    return 0;
  }

  console.log('매핑된 컬럼:', [...mapping.values()].join(', '));

  const BATCH_SIZE = SYNC.BATCH_SIZE;
  let upserted = 0;
  let skipped = 0;
  const batch: { hospitalId: string; dgsbjtCdNm: string; dgsbjtPrSdrCnt: number | null }[] = [];

  const processBatch = async () => {
    if (batch.length === 0) return;
    await prisma.$transaction(
      batch.map(({ hospitalId, dgsbjtCdNm, dgsbjtPrSdrCnt }) =>
        prisma.hospitalDepartment.upsert({
          where: { hospitalId_dgsbjtCdNm: { hospitalId, dgsbjtCdNm } },
          create: { hospitalId, dgsbjtCdNm, dgsbjtPrSdrCnt },
          update: { dgsbjtPrSdrCnt },
        })
      )
    );
    upserted += batch.length;
    batch.length = 0;
  };

  const totalRows = sheet.rowCount;
  for (let i = 2; i <= totalRows; i++) {
    const row = sheet.getRow(i);
    const obj = rowToObject(row, mapping);

    const ykiho = safeString(obj.ykiho);
    if (!ykiho) { skipped++; continue; }

    const hospitalId = ykihoMap.get(ykiho);
    if (!hospitalId) { skipped++; continue; }

    const dgsbjtCdNm = safeString(obj.dgsbjtCdNm);
    if (!dgsbjtCdNm) { skipped++; continue; }

    batch.push({
      hospitalId,
      dgsbjtCdNm,
      dgsbjtPrSdrCnt: safeInt(obj.dgsbjtPrSdrCnt),
    });

    if (batch.length >= BATCH_SIZE) {
      await processBatch();
      if (upserted % 10000 === 0) {
        console.log(`진료과목: ${upserted}건 upsert (스킵: ${skipped})`);
      }
    }
  }

  await processBatch();
  console.log(`진료과목 완료: ${upserted}건 upsert, ${skipped}건 스킵`);
  return upserted;
}

// ============================================
// 의료장비 시딩
// ============================================

export interface EquipmentRecord {
  hospitalId: string;
  eqpCd: string;
  eqpCdNm: string;
  eqpCnt: number | null;
}

/**
 * 의료장비 시트 → (hospitalId, eqpCd) 레코드 매핑 (순수 함수)
 */
export function mapEquipmentRows(sheet: ExcelJS.Worksheet, ykihoMap: Map<string, string>): EquipmentRecord[] {
  const mapping = buildColumnMapping(sheet, EQUIP_COLUMN_MAP);
  if (!mapping.size) return [];
  const out: EquipmentRecord[] = [];
  const totalRows = sheet.rowCount;
  for (let i = 2; i <= totalRows; i++) {
    const obj = rowToObject(sheet.getRow(i), mapping);
    const ykiho = safeString(obj.ykiho);
    if (!ykiho) continue;
    const hospitalId = ykihoMap.get(ykiho);
    if (!hospitalId) continue;
    const eqpCd = safeString(obj.eqpCd);
    const eqpCdNm = safeString(obj.eqpCdNm);
    if (!eqpCd || !eqpCdNm) continue;
    out.push({ hospitalId, eqpCd, eqpCdNm, eqpCnt: safeInt(obj.eqpCnt) });
  }
  return out;
}

async function seedEquipment(workbook: ExcelJS.Workbook, ykihoMap: Map<string, string>): Promise<number> {
  const sheet = findSheet(workbook, EQUIP_SHEET_NAMES);
  if (!sheet) {
    console.log('의료장비 시트를 찾을 수 없습니다. 사용 가능한 시트:', workbook.worksheets.map(w => w.name).join(', '));
    return 0;
  }

  console.log(`의료장비 시트 발견: "${sheet.name}" (${sheet.rowCount}행)`);

  const recs = mapEquipmentRows(sheet, ykihoMap);
  const BATCH_SIZE = SYNC.BATCH_SIZE;
  let upserted = 0;
  for (let i = 0; i < recs.length; i += BATCH_SIZE) {
    const batch = recs.slice(i, i + BATCH_SIZE);
    await prisma.$transaction(
      batch.map((r) =>
        prisma.hospitalEquipment.upsert({
          where: { hospitalId_eqpCd: { hospitalId: r.hospitalId, eqpCd: r.eqpCd } },
          create: r,
          update: { eqpCdNm: r.eqpCdNm, eqpCnt: r.eqpCnt },
        })
      )
    );
    upserted += batch.length;
    if (upserted % 10000 === 0) {
      console.log(`의료장비: ${upserted}건 upsert`);
    }
  }
  console.log(`의료장비 완료: ${upserted}건 upsert`);
  return upserted;
}

// ============================================
// 전문병원지정분야 시딩
// ============================================

export interface SpecialtyRecord {
  hospitalId: string;
  specialtyField: string;
}

/**
 * 전문병원지정분야 시트 → hospitalId별 지정분야 레코드 매핑 (순수 함수)
 * 동일 병원이 여러 분야로 지정된 경우 ", "로 조인(중복 제거)한다.
 */
export function mapSpecialtyRows(sheet: ExcelJS.Worksheet, ykihoMap: Map<string, string>): SpecialtyRecord[] {
  const mapping = buildColumnMapping(sheet, SPECIALTY_COLUMN_MAP);
  if (!mapping.size) return [];
  const byHospital = new Map<string, string[]>();
  const totalRows = sheet.rowCount;
  for (let i = 2; i <= totalRows; i++) {
    const obj = rowToObject(sheet.getRow(i), mapping);
    const ykiho = safeString(obj.ykiho);
    if (!ykiho) continue;
    const hospitalId = ykihoMap.get(ykiho);
    if (!hospitalId) continue;
    const field = safeString(obj.specialtyField);
    if (!field) continue;
    const arr = byHospital.get(hospitalId) ?? [];
    if (!arr.includes(field)) arr.push(field);
    byHospital.set(hospitalId, arr);
  }
  return [...byHospital.entries()].map(([hospitalId, fields]) => ({
    hospitalId,
    specialtyField: fields.join(', '),
  }));
}

async function seedSpecialty(workbook: ExcelJS.Workbook, ykihoMap: Map<string, string>): Promise<number> {
  const sheet = findSheet(workbook, SPECIALTY_SHEET_NAMES);
  if (!sheet) {
    console.log('전문병원지정 시트를 찾을 수 없습니다. 사용 가능한 시트:', workbook.worksheets.map(w => w.name).join(', '));
    return 0;
  }

  console.log(`전문병원지정 시트 발견: "${sheet.name}" (${sheet.rowCount}행)`);

  const recs = mapSpecialtyRows(sheet, ykihoMap);
  const BATCH_SIZE = SYNC.BATCH_SIZE;
  let updated = 0;
  for (let i = 0; i < recs.length; i += BATCH_SIZE) {
    const batch = recs.slice(i, i + BATCH_SIZE);
    await prisma.$transaction(
      batch.map((r) =>
        prisma.hospital.update({
          where: { id: r.hospitalId },
          data: { specialtyField: r.specialtyField },
        })
      )
    );
    updated += batch.length;
  }
  console.log(`전문병원지정 완료: ${updated}건`);
  return updated;
}

// ============================================
// 메인
// ============================================

export async function runHospitalDetail(): Promise<void> {
  // --file 인수로 특정 파일 지정 가능
  const fileArgIdx = process.argv.indexOf('--file');
  const fileArg = process.argv.find(a => a.startsWith('--file='))?.split('=')[1]
    || (fileArgIdx !== -1 ? process.argv[fileArgIdx + 1] : undefined);

  let xlsxFiles: string[];

  if (fileArg) {
    const filePath = path.resolve(fileArg);
    if (!fs.existsSync(filePath)) {
      console.error(`파일 없음: ${filePath}`);
      throw new Error(`파일 없음: ${filePath}`);
    }
    xlsxFiles = [filePath];
  } else {
    // data/ 디렉토리에서 xlsx 파일 검색
    if (!fs.existsSync(DATA_DIR)) {
      console.error(`데이터 디렉토리 없음: ${DATA_DIR}`);
      console.error('1. https://opendata.hira.or.kr/op/opc/selectOpenData.do?sno=11925 에서 zip 다운로드');
      console.error('2. zip 해제 후 xlsx 파일을 backend/data/ 에 배치');
      throw new Error(`데이터 디렉토리 없음: ${DATA_DIR}`);
    }

    const allFiles = fs.readdirSync(DATA_DIR)
      .filter(f => f.endsWith('.xlsx') || f.endsWith('.xls'));

    if (allFiles.length === 0) {
      console.error(`${DATA_DIR} 에 xlsx 파일이 없습니다.`);
      throw new Error(`${DATA_DIR} 에 xlsx 파일이 없습니다.`);
    }

    xlsxFiles = allFiles.map(f => path.join(DATA_DIR, f));
  }

  console.log(`발견된 xlsx 파일: ${xlsxFiles.length}개`);
  xlsxFiles.forEach(f => console.log(`  - ${path.basename(f)}`));

  // 파일명 패턴으로 세부정보/진료과목 파일 분류
  // macOS는 파일명을 NFD로 저장하므로 NFC 정규화 후 비교
  const detailFile =
    xlsxFiles.find(f => path.basename(f).normalize('NFC').includes('세부정보'))
    || xlsxFiles.find(f => /(^|\/)4\./.test(path.basename(f)));
  const deptFile =
    xlsxFiles.find(f => path.basename(f).normalize('NFC').includes('진료과목'))
    || xlsxFiles.find(f => /(^|\/)5\./.test(path.basename(f)));
  const equipFile =
    xlsxFiles.find(f => path.basename(f).normalize('NFC').includes('의료장비'))
    || xlsxFiles.find(f => /(^|\/)7\./.test(path.basename(f)));
  const specialtyFile =
    xlsxFiles.find(f => path.basename(f).normalize('NFC').includes('전문병원'))
    || xlsxFiles.find(f => /(^|\/)11\./.test(path.basename(f)));

  if (!detailFile && !deptFile) {
    console.error('세부정보 또는 진료과목 파일을 찾을 수 없습니다.');
    console.error('파일명에 "세부정보" 또는 "진료과목"이 포함되어야 합니다.');
    throw new Error('세부정보 또는 진료과목 파일을 찾을 수 없습니다.');
  }

  // ykiho → Hospital ID 매핑
  const ykihoMap = await buildYkihoMap();
  if (ykihoMap.size === 0) {
    console.error('DB에 ykiho가 있는 병원이 없습니다. 먼저 npm run sync:facilities 로 병원 데이터를 동기화하세요.');
    throw new Error('DB에 ykiho가 있는 병원이 없습니다.');
  }

  let totalDetailUpdated = 0;
  let totalDeptUpserted = 0;
  let totalEquipUpserted = 0;
  let totalSpecialtyUpdated = 0;

  // 세부정보 시딩
  if (detailFile) {
    console.log(`\n세부정보 파일 처리 중: ${path.basename(detailFile)}`);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(detailFile);
    console.log('시트 목록:', workbook.worksheets.map(w => `"${w.name}" (${w.rowCount}행)`).join(', '));
    totalDetailUpdated = await seedDetailInfo(workbook, ykihoMap);
  } else {
    console.log('\n세부정보 파일을 찾지 못했습니다. 스킵합니다.');
  }

  // 진료과목 시딩
  if (deptFile) {
    console.log(`\n진료과목 파일 처리 중: ${path.basename(deptFile)}`);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(deptFile);
    console.log('시트 목록:', workbook.worksheets.map(w => `"${w.name}" (${w.rowCount}행)`).join(', '));
    totalDeptUpserted = await seedDepartments(workbook, ykihoMap);
  } else {
    console.log('\n진료과목 파일을 찾지 못했습니다. 스킵합니다.');
  }

  // 의료장비 시딩
  if (equipFile) {
    console.log(`\n의료장비 파일 처리 중: ${path.basename(equipFile)}`);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(equipFile);
    console.log('시트 목록:', workbook.worksheets.map(w => `"${w.name}" (${w.rowCount}행)`).join(', '));
    totalEquipUpserted = await seedEquipment(workbook, ykihoMap);
  } else {
    console.log('\n의료장비 파일을 찾지 못했습니다. 스킵합니다.');
  }

  // 전문병원지정분야 시딩
  if (specialtyFile) {
    console.log(`\n전문병원지정 파일 처리 중: ${path.basename(specialtyFile)}`);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(specialtyFile);
    console.log('시트 목록:', workbook.worksheets.map(w => `"${w.name}" (${w.rowCount}행)`).join(', '));
    totalSpecialtyUpdated = await seedSpecialty(workbook, ykihoMap);
  } else {
    console.log('\n전문병원지정 파일을 찾지 못했습니다. 스킵합니다.');
  }

  console.log('\n=== 시딩 완료 ===');
  console.log(`세부정보 업데이트: ${totalDetailUpdated}건`);
  console.log(`진료과목 upsert: ${totalDeptUpserted}건`);
  console.log(`의료장비 upsert: ${totalEquipUpserted}건`);
  console.log(`전문병원지정 업데이트: ${totalSpecialtyUpdated}건`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runHospitalDetail()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('시딩 실패:', error);
      process.exit(1);
    });
}
