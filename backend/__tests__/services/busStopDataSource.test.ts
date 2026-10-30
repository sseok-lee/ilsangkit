import { describe, it, expect } from 'vitest';
import * as iconv from 'iconv-lite';
import { normalizeBusStopRows, parseBusStopCsvFile } from '../../src/services/busStopDataSource.js';

const base = {
  정류장번호: 'ADB354000001',
  정류장명: '길안정류장',
  위도: 36.458658,
  경도: 128.891228,
  정보수집일: '2025-10-31',
  모바일단축번호: 540001,
  도시코드: 37040,
  도시명: '경상북도 안동시',
  관리도시명: '안동BIS',
};

describe('normalizeBusStopRows', () => {
  it('정상 행을 레코드로 변환한다', () => {
    const { records, skipped } = normalizeBusStopRows([base]);
    expect(skipped).toBe(0);
    expect(records).toEqual([
      {
        nodeId: 'ADB354000001',
        name: '길안정류장',
        lat: 36.458658,
        lng: 128.891228,
        collectedAt: '2025-10-31',
        mobileId: '540001',
        cityCode: '37040',
        cityName: '경상북도 안동시',
        adminName: '안동BIS',
      },
    ]);
  });

  it('잘못된 행 5개를 버린다', () => {
    const { records, skipped } = normalizeBusStopRows([
      base,
      { ...base, 정류장번호: 'A2', 위도: '' },
      { ...base, 정류장번호: 'A3', 위도: 0 },
      { ...base, 정류장번호: 'A4', 경도: 140.1 },
      { ...base, 정류장번호: 'A5', 정류장명: '' },
      { ...base, 정류장번호: '' },
    ]);
    expect(skipped).toBe(5);
    expect(records).toHaveLength(1);
  });

  it('중복 정류장번호는 첫 행만 남긴다', () => {
    const { records, skipped } = normalizeBusStopRows([base, { ...base, 정류장명: '다른이름' }]);
    expect(records).toHaveLength(1);
    expect(records[0].name).toBe('길안정류장');
    expect(skipped).toBe(1);
  });

  it('정류장명 공백을 제거하고 빈 선택 값은 null로 둔다', () => {
    const { records } = normalizeBusStopRows([
      { ...base, 정류장명: '  길안정류장 ', 모바일단축번호: '', 관리도시명: undefined },
    ]);
    expect(records[0].name).toBe('길안정류장');
    expect(records[0].mobileId).toBeNull();
    expect(records[0].adminName).toBeNull();
  });
});

describe('parseBusStopCsvFile', () => {
  const csv =
    '정류장번호,정류장명,위도,경도,정보수집일,모바일단축번호,도시코드,도시명,관리도시명\n' +
    'ADB354000001,길안정류장,36.458658,128.891228,2025-10-31,540001,37040,경상북도 안동시,안동BIS\n';

  it('CP949 CSV를 한글 헤더 키의 행으로 파싱한다', () => {
    const rows = parseBusStopCsvFile(iconv.encode(csv, 'euc-kr'));
    expect(rows).toHaveLength(1);
    expect(rows[0].정류장명).toBe('길안정류장');
    expect(rows[0].위도).toBe('36.458658');
  });

  it('UTF-8 BOM CSV도 파싱한다', () => {
    const buf = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(csv, 'utf8')]);
    const rows = parseBusStopCsvFile(buf);
    expect(rows[0].정류장번호).toBe('ADB354000001');
  });
});
