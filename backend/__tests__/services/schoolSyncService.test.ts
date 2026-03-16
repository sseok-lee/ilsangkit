import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { parseSchoolCSV, transformSchoolRow, type SchoolCSVRow } from '../../src/services/csvParser.js';
import * as fs from 'fs';
import * as path from 'path';
import * as iconv from 'iconv-lite';

describe('transformSchoolRow', () => {
  const baseRow: SchoolCSVRow = {
    '학교ID': 'B100000001',
    '학교명': '강남초등학교',
    '학교급구분': '초등학교',
    '설립일자': '19800101',
    '설립형태': '공립',
    '본교분교구분': '본교',
    '운영상태': '운영',
    '소재지지번주소': '서울특별시 강남구 역삼동 123',
    '소재지도로명주소': '서울특별시 강남구 테헤란로 123',
    '시도교육청코드': '11',
    '시도교육청명': '서울특별시교육청',
    '교육지원청코드': '1101',
    '교육지원청명': '서울강남서초교육지원청',
    '생성일자': '20100101',
    '변경일자': '20240101',
    '위도': '37.4979517',
    '경도': '127.0276188',
    '데이터기준일자': '2024-01-01',
    '제공기관코드': '6110000',
    '제공기관명': '서울특별시',
  };

  it('should map schoolLevel correctly for 초등학교', () => {
    const result = transformSchoolRow(baseRow);

    expect(result).not.toBeNull();
    expect(result!.schoolLevel).toBe('초등학교');
  });

  it('should map schoolLevel correctly for 중학교', () => {
    const row: SchoolCSVRow = { ...baseRow, '학교급구분': '중학교', '학교ID': 'B100000002' };
    const result = transformSchoolRow(row);

    expect(result).not.toBeNull();
    expect(result!.schoolLevel).toBe('중학교');
  });

  it('should map schoolLevel correctly for 고등학교', () => {
    const row: SchoolCSVRow = { ...baseRow, '학교급구분': '고등학교', '학교ID': 'B100000003' };
    const result = transformSchoolRow(row);

    expect(result).not.toBeNull();
    expect(result!.schoolLevel).toBe('고등학교');
  });

  it('should use 학교ID directly as sourceId', () => {
    const result = transformSchoolRow(baseRow);

    expect(result).not.toBeNull();
    expect(result!.sourceId).toBe('B100000001');
    expect(result!.id).toBe('school-B100000001');
  });

  it('should map foundationType (공립/사립)', () => {
    const result = transformSchoolRow(baseRow);
    expect(result!.foundationType).toBe('공립');

    const row2: SchoolCSVRow = { ...baseRow, '설립형태': '사립', '학교ID': 'B200000001' };
    const result2 = transformSchoolRow(row2);
    expect(result2!.foundationType).toBe('사립');
  });

  it('should map operationStatus (운영/폐교)', () => {
    const result = transformSchoolRow(baseRow);
    expect(result!.operationStatus).toBe('운영');

    const row2: SchoolCSVRow = { ...baseRow, '운영상태': '폐교', '학교ID': 'B300000001' };
    const result2 = transformSchoolRow(row2);
    expect(result2!.operationStatus).toBe('폐교');
  });

  it('should map 4 education office fields correctly', () => {
    const result = transformSchoolRow(baseRow);

    expect(result).not.toBeNull();
    expect(result!.sidoEduCode).toBe('11');
    expect(result!.sidoEduName).toBe('서울특별시교육청');
    expect(result!.localEduCode).toBe('1101');
    expect(result!.localEduName).toBe('서울강남서초교육지원청');
  });

  it('should validate coordinates', () => {
    const result = transformSchoolRow(baseRow);

    expect(result).not.toBeNull();
    expect(result!.lat).toBeCloseTo(37.4979517, 5);
    expect(result!.lng).toBeCloseTo(127.0276188, 5);
  });

  it('should return null when coordinates are outside KOREA_BOUNDS', () => {
    const row: SchoolCSVRow = {
      ...baseRow,
      '위도': '10.0',
      '경도': '100.0',
    };

    const result = transformSchoolRow(row);
    expect(result).toBeNull();
  });

  it('should return null when coordinates are missing', () => {
    const row: SchoolCSVRow = {
      ...baseRow,
      '위도': '',
      '경도': '',
    };

    const result = transformSchoolRow(row);
    expect(result).toBeNull();
  });

  it('should extract city/district from address', () => {
    const result = transformSchoolRow(baseRow);

    expect(result).not.toBeNull();
    expect(result!.city).toBe('서울');
    expect(result!.district).toBe('강남구');
  });
});

describe('parseSchoolCSV', () => {
  const fixtureDir = path.join(__dirname, '../fixtures');
  const sampleCSVPath = path.join(fixtureDir, 'sample-school.csv');

  beforeEach(() => {
    if (!fs.existsSync(fixtureDir)) {
      fs.mkdirSync(fixtureDir, { recursive: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(sampleCSVPath)) {
      fs.unlinkSync(sampleCSVPath);
    }
  });

  it('should parse UTF-8 CSV and return SchoolCSVRow array', async () => {
    const csvContent = `학교ID,학교명,학교급구분,설립일자,설립형태,본교분교구분,운영상태,소재지지번주소,소재지도로명주소,시도교육청코드,시도교육청명,교육지원청코드,교육지원청명,생성일자,변경일자,위도,경도,데이터기준일자,제공기관코드,제공기관명
B100000001,강남초등학교,초등학교,19800101,공립,본교,운영,서울특별시 강남구 역삼동 123,서울특별시 강남구 테헤란로 123,11,서울특별시교육청,1101,서울강남서초교육지원청,20100101,20240101,37.4979517,127.0276188,2024-01-01,6110000,서울특별시`;
    fs.writeFileSync(sampleCSVPath, csvContent, 'utf8');

    const rows = await parseSchoolCSV(sampleCSVPath);

    expect(rows).toHaveLength(1);
    expect(rows[0]['학교명']).toBe('강남초등학교');
    expect(rows[0]['학교ID']).toBe('B100000001');
  });

  it('should parse EUC-KR encoded CSV', async () => {
    const eucKrPath = path.join(fixtureDir, 'euckr-school.csv');
    const csvContent = `학교ID,학교명,학교급구분,설립일자,설립형태,본교분교구분,운영상태,소재지지번주소,소재지도로명주소,시도교육청코드,시도교육청명,교육지원청코드,교육지원청명,생성일자,변경일자,위도,경도,데이터기준일자,제공기관코드,제공기관명
B200000001,부산중학교,중학교,19900101,공립,본교,운영,부산광역시 동구 초량동 1,부산광역시 동구 중앙대로 1,26,부산광역시교육청,2601,부산동부교육지원청,20100101,20240101,35.1149975,129.0396538,2024-01-01,6260000,부산광역시`;
    const buf = iconv.encode(csvContent, 'euc-kr');
    fs.writeFileSync(eucKrPath, buf);

    const rows = await parseSchoolCSV(eucKrPath);

    expect(rows).toHaveLength(1);
    expect(rows[0]['학교명']).toBe('부산중학교');

    fs.unlinkSync(eucKrPath);
  });
});
