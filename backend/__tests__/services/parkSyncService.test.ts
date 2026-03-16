import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { parseParkCSV, transformParkRow, type ParkCSVRow } from '../../src/services/csvParser.js';
import * as fs from 'fs';
import * as path from 'path';
import * as iconv from 'iconv-lite';

describe('transformParkRow', () => {
  const baseRow: ParkCSVRow = {
    '관리번호': 'PK-001',
    '공원명': '테스트공원',
    '공원구분': '근린공원',
    '소재지도로명주소': '서울특별시 강남구 테헤란로 123',
    '소재지지번주소': '서울특별시 강남구 역삼동 123',
    '위도': '37.4979517',
    '경도': '127.0276188',
    '공원면적': '5000.50',
    '공원보유시설(운동시설)': '축구장,농구장',
    '공원보유시설(유희시설)': '미끄럼틀,그네',
    '공원보유시설(편익시설)': '화장실,주차장',
    '공원보유시설(교양시설)': '도서관',
    '공원보유시설(기타시설)': '조형물',
    '지정고시일': '2010-01-01',
    '관리기관명': '강남구청',
    '전화번호': '02-1234-5678',
    '데이터기준일자': '2024-01-01',
    '제공기관코드': '6110000',
    '제공기관명': '서울특별시',
  };

  it('should transform normal CSV row with correct field mapping', () => {
    const result = transformParkRow(baseRow);

    expect(result).not.toBeNull();
    expect(result!.name).toBe('테스트공원');
    expect(result!.city).toBe('서울');
    expect(result!.district).toBe('강남구');
    expect(result!.lat).toBeCloseTo(37.4979517, 5);
    expect(result!.lng).toBeCloseTo(127.0276188, 5);
    expect(result!.parkType).toBe('근린공원');
    expect(result!.managingOrg).toBe('강남구청');
    expect(result!.phoneNumber).toBe('02-1234-5678');
    expect(result!.dataDate).toBe('2024-01-01');
    expect(result!.providerCode).toBe('6110000');
    expect(result!.providerName).toBe('서울특별시');
  });

  it('should use 관리번호 directly as sourceId', () => {
    const result = transformParkRow(baseRow);

    expect(result).not.toBeNull();
    expect(result!.sourceId).toBe('PK-001');
    expect(result!.id).toBe('park-PK-001');
  });

  it('should extract city/district from address', () => {
    const result = transformParkRow(baseRow);

    expect(result).not.toBeNull();
    expect(result!.city).toBe('서울');
    expect(result!.district).toBe('강남구');
  });

  it('should return null when coordinates are outside KOREA_BOUNDS', () => {
    const row: ParkCSVRow = {
      ...baseRow,
      '위도': '10.0',   // outside Korea
      '경도': '100.0',
    };

    const result = transformParkRow(row);
    expect(result).toBeNull();
  });

  it('should return null when coordinates are missing', () => {
    const row: ParkCSVRow = {
      ...baseRow,
      '위도': '',
      '경도': '',
    };

    const result = transformParkRow(row);
    expect(result).toBeNull();
  });

  it('should convert area to float for Decimal', () => {
    const result = transformParkRow(baseRow);

    expect(result).not.toBeNull();
    expect(result!.area).toBeCloseTo(5000.5, 1);
  });

  it('should map all 5 facility fields correctly', () => {
    const result = transformParkRow(baseRow);

    expect(result).not.toBeNull();
    expect(result!.exerciseFacilities).toBe('축구장,농구장');
    expect(result!.playFacilities).toBe('미끄럼틀,그네');
    expect(result!.convenienceFacilities).toBe('화장실,주차장');
    expect(result!.cultureFacilities).toBe('도서관');
    expect(result!.otherFacilities).toBe('조형물');
  });

  it('should handle missing area as null', () => {
    const row: ParkCSVRow = {
      ...baseRow,
      '공원면적': '',
    };

    const result = transformParkRow(row);
    expect(result).not.toBeNull();
    expect(result!.area).toBeNull();
  });

  it('should return null when park name is missing', () => {
    const row: ParkCSVRow = {
      ...baseRow,
      '공원명': '',
    };

    const result = transformParkRow(row);
    expect(result).toBeNull();
  });
});

describe('parseParkCSV', () => {
  const fixtureDir = path.join(__dirname, '../fixtures');
  const sampleCSVPath = path.join(fixtureDir, 'sample-park.csv');

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

  it('should parse UTF-8 CSV and return ParkCSVRow array', async () => {
    const csvContent = `관리번호,공원명,공원구분,소재지도로명주소,소재지지번주소,위도,경도,공원면적,공원보유시설(운동시설),공원보유시설(유희시설),공원보유시설(편익시설),공원보유시설(교양시설),공원보유시설(기타시설),지정고시일,관리기관명,전화번호,데이터기준일자,제공기관코드,제공기관명
PK-001,테스트공원,근린공원,서울특별시 강남구 테헤란로 123,서울특별시 강남구 역삼동 123,37.4979517,127.0276188,5000.50,축구장,미끄럼틀,화장실,도서관,조형물,2010-01-01,강남구청,02-1234-5678,2024-01-01,6110000,서울특별시`;
    fs.writeFileSync(sampleCSVPath, csvContent, 'utf8');

    const rows = await parseParkCSV(sampleCSVPath);

    expect(rows).toHaveLength(1);
    expect(rows[0]['공원명']).toBe('테스트공원');
    expect(rows[0]['관리번호']).toBe('PK-001');
  });

  it('should parse EUC-KR encoded CSV', async () => {
    const eucKrPath = path.join(fixtureDir, 'euckr-park.csv');
    const csvContent = `관리번호,공원명,공원구분,소재지도로명주소,소재지지번주소,위도,경도,공원면적,공원보유시설(운동시설),공원보유시설(유희시설),공원보유시설(편익시설),공원보유시설(교양시설),공원보유시설(기타시설),지정고시일,관리기관명,전화번호,데이터기준일자,제공기관코드,제공기관명
PK-002,부산공원,근린공원,부산광역시 동구 중앙대로 1,부산광역시 동구 초량동 1,35.1149975,129.0396538,3000.00,,,,,,2010-01-01,동구청,051-000-0000,2024-01-01,6260000,부산광역시`;
    const buf = iconv.encode(csvContent, 'euc-kr');
    fs.writeFileSync(eucKrPath, buf);

    const rows = await parseParkCSV(eucKrPath);

    expect(rows).toHaveLength(1);
    expect(rows[0]['공원명']).toBe('부산공원');

    fs.unlinkSync(eucKrPath);
  });
});
