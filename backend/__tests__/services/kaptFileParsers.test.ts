import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import {
  parsePnu,
  parseKaptBasicXlsx,
  parseKaptParcelXlsx,
  parseKaptAreaXlsx,
  KAPT_BASIC_REQUIRED_HEADERS,
} from '../../src/services/kaptFileParsers.js';

const NOTICE = '해당 자료는 2026년 10월 매주 금요일에 추출한 자료이며 …';

/** K-apt 주간 파일과 같은 모양 — 1행 안내문, 2행 헤더, 3행부터 데이터 */
async function makeXlsx(headers: readonly string[], rows: Array<Record<string, unknown>>): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('sheet1');
  ws.addRow(headers.map(() => NOTICE));
  ws.addRow([...headers]);
  for (const row of rows) ws.addRow(headers.map((h) => row[h] ?? null));
  return Buffer.from(await wb.xlsx.writeBuffer());
}

const BASIC_HEADERS = [
  ...KAPT_BASIC_REQUIRED_HEADERS,
  '승강기(승객용)',
  '부대복리시설',
];

function basicRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    시도: '서울특별시',
    시군구: '강남구',
    읍면: null,
    동리: '개포동',
    단지코드: 'A13580602',
    단지명: '개포경남아파트',
    단지분류: '아파트',
    법정동주소: '서울특별시 강남구 개포동 649 개포경남아파트',
    우편번호: '06311',
    도로명주소: '서울특별시 강남구 언주로 110',
    분양형태: '분양',
    사용승인일: '19840308',
    동수: '9',
    세대수: '678.0',
    분양세대수: '678.0',
    임대세대수: '0',
    관리방식: '위탁관리',
    난방방식: '지역난방',
    복도유형: '계단식',
    시공사: '경남건설',
    시행사: '경남건설',
    건물구조: '철근콘크리트구조',
    총주차대수: '747',
    지상주차대수: '120',
    지하주차대수: '627',
    CCTV대수: '96',
    최고층수: '15',
    '최고층수(건축물대장상)': '15',
    지하층수: '1',
    '승강기(승객용)': '18',
    부대복리시설: '관리사무소, 노인정',
    ...overrides,
  };
}

describe('parsePnu', () => {
  it('19자리 필지고유번호를 시군구·법정동·산·본번·부번으로 나눈다', () => {
    expect(parsePnu('1168010300106490000')).toEqual({
      pnu: '1168010300106490000',
      sggCode: '11680',
      bjdCode: '1168010300',
      isMountain: false,
      mainNo: 649,
      subNo: 0,
    });
  });

  it('11번째 자리가 2이면 산 지번이다', () => {
    expect(parsePnu('4146510100200120034')).toMatchObject({ isMountain: true, mainNo: 12, subNo: 34 });
  });

  it('형식이 아니면 null', () => {
    expect(parsePnu('123')).toBeNull();
    expect(parsePnu('11680103001064900AB')).toBeNull();
    expect(parsePnu(null)).toBeNull();
  });
});

describe('parseKaptBasicXlsx', () => {
  it('2행 헤더 기준으로 컬럼을 매핑하고 숫자를 정수로 바꾼다', async () => {
    const buf = await makeXlsx(BASIC_HEADERS, [basicRow()]);
    const { items, headers } = await parseKaptBasicXlsx(buf);

    expect(headers).toEqual(BASIC_HEADERS);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      kaptCode: 'A13580602',
      sido: '서울특별시',
      sigungu: '강남구',
      eupmyeon: null,
      dongri: '개포동',
      name: '개포경남아파트',
      householdCount: 678,
      dongCount: 9,
      useApprovalDate: '19840308',
      builder: '경남건설',
      totalParking: 747,
      undergroundParking: 627,
      topFloor: 15,
      basementFloors: 1,
    });
  });

  it('원본 행 전체를 raw 에 헤더명 그대로 보존한다', async () => {
    const buf = await makeXlsx(BASIC_HEADERS, [basicRow()]);
    const { items } = await parseKaptBasicXlsx(buf);
    expect(items[0].raw['승강기(승객용)']).toBe('18');
    expect(items[0].raw['부대복리시설']).toBe('관리사무소, 노인정');
    expect(Object.keys(items[0].raw)).toEqual(BASIC_HEADERS);
  });

  it('빈 값·숫자 아닌 값은 null 로 둔다 (0 은 0)', async () => {
    const buf = await makeXlsx(BASIC_HEADERS, [basicRow({ 세대수: '', 총주차대수: '-', 지하층수: '0' })]);
    const { items } = await parseKaptBasicXlsx(buf);
    expect(items[0].householdCount).toBeNull();
    expect(items[0].totalParking).toBeNull();
    expect(items[0].basementFloors).toBe(0);
  });

  it('단지코드가 없는 행은 건너뛴다', async () => {
    const buf = await makeXlsx(BASIC_HEADERS, [basicRow({ 단지코드: '' }), basicRow({ 단지코드: 'A1' })]);
    const { items } = await parseKaptBasicXlsx(buf);
    expect(items.map((i) => i.kaptCode)).toEqual(['A1']);
  });

  it('필수 헤더가 빠지면 예외 — 제공처 스키마 변경을 조용히 넘기지 않는다', async () => {
    const buf = await makeXlsx(BASIC_HEADERS.filter((h) => h !== '세대수'), [basicRow()]);
    await expect(parseKaptBasicXlsx(buf)).rejects.toThrow(/세대수/);
  });
});

describe('parseKaptParcelXlsx', () => {
  it('고유번호·단지코드 행을 필지 정보로 바꾸고 형식이 틀린 행은 건너뛴다', async () => {
    const buf = await makeXlsx(['고유번호', '단지코드(kapt)'], [
      { 고유번호: '1168010300106490000', '단지코드(kapt)': 'A13580602' },
      { 고유번호: 'bad', '단지코드(kapt)': 'A2' },
      { 고유번호: '1168010300106490000', '단지코드(kapt)': 'A13580602' },
    ]);
    const { items, skipped } = await parseKaptParcelXlsx(buf);
    expect(items).toEqual([
      { kaptCode: 'A13580602', pnu: '1168010300106490000', sggCode: '11680', bjdCode: '1168010300', isMountain: false, mainNo: 649, subNo: 0 },
    ]);
    expect(skipped).toBe(2);
  });
});

describe('parseKaptAreaXlsx', () => {
  const AREA_HEADERS = ['시도', '시군구', '읍면', '동리', '단지코드', '단지명', '동수', '관리비부과면적', '주거전용면적(단지합계)', '주거전용면적(세부)', '세대수'];

  it('단지×전용면적별 세대수와 단지별 면적 합계를 만든다', async () => {
    const base = { 단지코드: 'A10022877', 관리비부과면적: '43298.22', '주거전용면적(단지합계)': '32828.88' };
    const buf = await makeXlsx(AREA_HEADERS, [
      { ...base, '주거전용면적(세부)': '59.9429', 세대수: '90' },
      { ...base, '주거전용면적(세부)': '84.5225', 세대수: '176' },
      { ...base, '주거전용면적(세부)': '84.5225', 세대수: '4' },
    ]);
    const { areas, complexes } = await parseKaptAreaXlsx(buf);
    expect(areas).toEqual([
      { kaptCode: 'A10022877', exclusiveArea: '59.9429', householdCount: 90 },
      { kaptCode: 'A10022877', exclusiveArea: '84.5225', householdCount: 180 },
    ]);
    expect(complexes.get('A10022877')).toEqual({ managementArea: '43298.22', exclusiveAreaTotal: '32828.88' });
  });
});
