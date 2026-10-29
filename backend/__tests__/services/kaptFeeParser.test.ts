import { describe, it, expect } from 'vitest';
import { PassThrough } from 'node:stream';
import ExcelJS from 'exceljs';
import { KAPT_FEE_COLUMNS, parseFeeAmount, readKaptFeeXlsx, type KaptFeeItem } from '../../src/services/kaptFeeParser.js';

const NOTICE = '해당 자료는 2026년 10월 매주 금요일에 추출한 자료이며 …';
const LOCATION_HEADERS = ['시도', '시군구', '읍면', '동리', '단지코드', '단지명', '발생년월(YYYYMM)'];
const HEADERS = [...LOCATION_HEADERS, ...KAPT_FEE_COLUMNS.map(([header]) => header)];

/**
 * K-apt 관리비 파일과 같은 모양 — 1행 안내문, 2행 헤더, 3행부터 데이터 (숫자도 문자열).
 * 실제 파일처럼 인라인 문자열로 쓴다(공유 문자열이면 스트리밍 리더가 시트를 먼저 만날 때 값을 못 푼다).
 */
async function makeXlsx(headers: readonly string[], rows: Array<Record<string, unknown> | null>): Promise<Buffer> {
  const chunks: Buffer[] = [];
  const stream = new PassThrough();
  stream.on('data', (chunk: Buffer) => chunks.push(chunk));
  const wb = new ExcelJS.stream.xlsx.WorkbookWriter({ stream, useSharedStrings: false, useStyles: false });
  const ws = wb.addWorksheet('sheet1');
  ws.addRow(headers.map(() => NOTICE)).commit();
  ws.addRow([...headers]).commit();
  for (const row of rows) ws.addRow(row ? headers.map((h) => row[h] ?? null) : []).commit();
  ws.commit();
  await wb.commit();
  return Buffer.concat(chunks);
}

function feeRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const row: Record<string, unknown> = {
    시도: '서울특별시', 시군구: '강남구', 읍면: '', 동리: '개포동',
    단지코드: 'A10024564', 단지명: '개포래미안포레스트', '발생년월(YYYYMM)': '202601',
  };
  for (const [header] of KAPT_FEE_COLUMNS) row[header] = '0';
  Object.assign(row, {
    '공용관리비(합계)': '3.7478826E8',
    제사무비: '2052690.0',
    개별사용료계: '704384000',
    '장충금 월부과액': '48633408',
    '장충금 총적립금액': '3.01413248E9',
    '장충금 적립률': '2.191',
  });
  return { ...row, ...overrides };
}

async function collect(buffer: Buffer, batchSize?: number): Promise<KaptFeeItem[][]> {
  const batches: KaptFeeItem[][] = [];
  for await (const batch of readKaptFeeXlsx(buffer, batchSize)) batches.push(batch);
  return batches;
}

describe('parseFeeAmount', () => {
  it('지수 표기·소수 표기·빈 값을 읽는다', () => {
    expect(parseFeeAmount('3.7478826E8')).toBe(374788260);
    expect(parseFeeAmount('2052690.0')).toBe(2052690);
    expect(parseFeeAmount('0')).toBe(0);
    expect(parseFeeAmount('')).toBeNull();
    expect(parseFeeAmount(undefined)).toBeNull();
    expect(parseFeeAmount('abc')).toBeNull();
  });
});

describe('KAPT_FEE_COLUMNS', () => {
  it('금액 헤더 45개를 겹치지 않게 컬럼에 대응시킨다', () => {
    expect(KAPT_FEE_COLUMNS).toHaveLength(45);
    expect(new Set(KAPT_FEE_COLUMNS.map(([, column]) => column)).size).toBe(45);
  });
});

describe('readKaptFeeXlsx', () => {
  it('배치 크기대로 나눠 읽고 빈 행은 건너뛴다', async () => {
    const buffer = await makeXlsx(HEADERS, [
      feeRow(),
      feeRow({ '발생년월(YYYYMM)': '202602' }),
      null,
      feeRow({ '발생년월(YYYYMM)': '202603' }),
    ]);
    const batches = await collect(buffer, 2);
    expect(batches.map((b) => b.length)).toEqual([2, 1]);
    expect(batches[0][0]).toMatchObject({
      kaptCode: 'A10024564',
      yearMonth: '202601',
      commonTotal: 374788260,
      officeExpense: 2052690,
      individualTotal: 704384000,
      ltrCharge: 48633408,
      ltrBalance: 3014132480,
      ltrRate: 2.191,
      labor: 0,
    });
  });

  it('발생년월 숫자 문자열을 YYYYMM 으로, 형식이 틀리거나 단지코드가 없으면 건너뛴다', async () => {
    const buffer = await makeXlsx(HEADERS, [
      feeRow({ '발생년월(YYYYMM)': '202601.0' }),
      feeRow({ '발생년월(YYYYMM)': '2026-01' }),
      feeRow({ 단지코드: '' }),
    ]);
    const items = (await collect(buffer)).flat();
    expect(items).toHaveLength(1);
    expect(items[0].yearMonth).toBe('202601');
  });

  it('빈 금액 칸은 null', async () => {
    const buffer = await makeXlsx(HEADERS, [feeRow({ 인건비: '', '장충금 적립률': '' })]);
    const [item] = (await collect(buffer)).flat();
    expect(item.labor).toBeNull();
    expect(item.ltrRate).toBeNull();
  });

  it('필수 헤더가 없으면 멈춘다', async () => {
    const buffer = await makeXlsx(HEADERS.filter((h) => h !== '개별사용료계'), [feeRow()]);
    await expect(collect(buffer)).rejects.toThrow(/헤더 누락: 개별사용료계/);
  });
});
