import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { parseMarketCSV, transformMarketRow, type MarketCSVRow } from '../../src/services/csvParser.js';
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as iconv from 'iconv-lite';

describe('transformMarketRow', () => {
  const baseRow: MarketCSVRow = {
    '시장명': '강남전통시장',
    '시장유형': '일반시장',
    '소재지도로명주소': '서울특별시 강남구 테헤란로 123',
    '소재지지번주소': '서울특별시 강남구 역삼동 123',
    '시장개설주기': '매일',
    '위도': '37.4979517',
    '경도': '127.0276188',
    '점포수': '200',
    '취급품목': '농산물,수산물,축산물',
    '사용가능상품권': '온누리상품권',
    '홈페이지주소': 'https://example.com',
    '공중화장실보유여부': 'Y',
    '주차장보유여부': 'N',
    '개설연도': '1980',
    '전화번호': '02-1234-5678',
    '데이터기준일자': '2024-01-01',
    '제공기관코드': '6110000',
    '제공기관명': '서울특별시',
  };

  it('should generate sourceId as MD5(시장명+주소)', () => {
    const result = transformMarketRow(baseRow);

    expect(result).not.toBeNull();
    const expectedHash = createHash('md5')
      .update('강남전통시장서울특별시 강남구 테헤란로 123')
      .digest('hex')
      .substring(0, 16);
    expect(result!.sourceId).toBe(expectedHash);
  });

  it('should convert Y to true for hasPublicToilet', () => {
    const result = transformMarketRow(baseRow);

    expect(result).not.toBeNull();
    expect(result!.hasPublicToilet).toBe(true);
  });

  it('should convert N to false for hasPublicToilet', () => {
    const row: MarketCSVRow = { ...baseRow, '공중화장실보유여부': 'N' };
    const result = transformMarketRow(row);

    expect(result).not.toBeNull();
    expect(result!.hasPublicToilet).toBe(false);
  });

  it('should convert empty string to null for hasPublicToilet', () => {
    const row: MarketCSVRow = { ...baseRow, '공중화장실보유여부': '' };
    const result = transformMarketRow(row);

    expect(result).not.toBeNull();
    expect(result!.hasPublicToilet).toBeNull();
  });

  it('should convert Y to true for hasParking', () => {
    const row: MarketCSVRow = { ...baseRow, '주차장보유여부': 'Y' };
    const result = transformMarketRow(row);

    expect(result).not.toBeNull();
    expect(result!.hasParking).toBe(true);
  });

  it('should convert N to false for hasParking', () => {
    const result = transformMarketRow(baseRow);

    expect(result).not.toBeNull();
    expect(result!.hasParking).toBe(false);
  });

  it('should convert storeCount from String to Int', () => {
    const result = transformMarketRow(baseRow);

    expect(result).not.toBeNull();
    expect(result!.storeCount).toBe(200);
    expect(typeof result!.storeCount).toBe('number');
  });

  it('should convert foundedYear from String to Int', () => {
    const result = transformMarketRow(baseRow);

    expect(result).not.toBeNull();
    expect(result!.foundedYear).toBe(1980);
    expect(typeof result!.foundedYear).toBe('number');
  });

  it('should map products and giftCertificates text fields', () => {
    const result = transformMarketRow(baseRow);

    expect(result).not.toBeNull();
    expect(result!.products).toBe('농산물,수산물,축산물');
    expect(result!.giftCertificates).toBe('온누리상품권');
  });

  it('should extract city/district from address', () => {
    const result = transformMarketRow(baseRow);

    expect(result).not.toBeNull();
    expect(result!.city).toBe('서울');
    expect(result!.district).toBe('강남구');
  });

  it('should return null when coordinates are outside KOREA_BOUNDS', () => {
    const row: MarketCSVRow = {
      ...baseRow,
      '위도': '10.0',
      '경도': '100.0',
    };

    const result = transformMarketRow(row);
    expect(result).toBeNull();
  });

  it('should return null when coordinates are missing', () => {
    const row: MarketCSVRow = {
      ...baseRow,
      '위도': '',
      '경도': '',
    };

    const result = transformMarketRow(row);
    expect(result).toBeNull();
  });

  it('should handle null storeCount for empty string', () => {
    const row: MarketCSVRow = { ...baseRow, '점포수': '' };
    const result = transformMarketRow(row);

    expect(result).not.toBeNull();
    expect(result!.storeCount).toBeNull();
  });

  it('should handle null foundedYear for empty string', () => {
    const row: MarketCSVRow = { ...baseRow, '개설연도': '' };
    const result = transformMarketRow(row);

    expect(result).not.toBeNull();
    expect(result!.foundedYear).toBeNull();
  });
});

describe('parseMarketCSV', () => {
  const fixtureDir = path.join(__dirname, '../fixtures');
  const sampleCSVPath = path.join(fixtureDir, 'sample-market.csv');

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

  it('should parse UTF-8 CSV and return MarketCSVRow array', async () => {
    const csvContent = `시장명,시장유형,소재지도로명주소,소재지지번주소,시장개설주기,위도,경도,점포수,취급품목,사용가능상품권,홈페이지주소,공중화장실보유여부,주차장보유여부,개설연도,전화번호,데이터기준일자,제공기관코드,제공기관명
강남전통시장,일반시장,서울특별시 강남구 테헤란로 123,서울특별시 강남구 역삼동 123,매일,37.4979517,127.0276188,200,농산물,온누리상품권,https://example.com,Y,N,1980,02-1234-5678,2024-01-01,6110000,서울특별시`;
    fs.writeFileSync(sampleCSVPath, csvContent, 'utf8');

    const rows = await parseMarketCSV(sampleCSVPath);

    expect(rows).toHaveLength(1);
    expect(rows[0]['시장명']).toBe('강남전통시장');
  });

  it('should parse EUC-KR encoded CSV', async () => {
    const eucKrPath = path.join(fixtureDir, 'euckr-market.csv');
    const csvContent = `시장명,시장유형,소재지도로명주소,소재지지번주소,시장개설주기,위도,경도,점포수,취급품목,사용가능상품권,홈페이지주소,공중화장실보유여부,주차장보유여부,개설연도,전화번호,데이터기준일자,제공기관코드,제공기관명
부산전통시장,일반시장,부산광역시 동구 중앙대로 1,부산광역시 동구 초량동 1,매일,35.1149975,129.0396538,150,수산물,,,,Y,1975,051-000-0000,2024-01-01,6260000,부산광역시`;
    const buf = iconv.encode(csvContent, 'euc-kr');
    fs.writeFileSync(eucKrPath, buf);

    const rows = await parseMarketCSV(eucKrPath);

    expect(rows).toHaveLength(1);
    expect(rows[0]['시장명']).toBe('부산전통시장');

    fs.unlinkSync(eucKrPath);
  });
});
