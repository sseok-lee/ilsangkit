import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { parseSchoolCSV } from '../../src/services/csvParser.js';
import * as fs from 'fs';
import * as path from 'path';
import * as iconv from 'iconv-lite';

/**
 * 표준데이터 학교 CSV 파서.
 *
 * 이 파일에서 CSV 로 학교 행을 적재하던 경로(sync:school:csv)는 은퇴했다 —
 * NEIS 가 학교의 단일 소스다(#789). 파서만 남긴 이유는 reconcileSchoolNeisRows 가
 * 학교ID ↔ NEIS 코드 매핑 입력으로 이 CSV 를 읽기 때문이다.
 * 은퇴 범위는 schoolCsvIngestionRetired.test.ts 가 고정한다.
 */

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
