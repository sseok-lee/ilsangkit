import { describe, it, expect } from 'vitest';
import { transformToiletRow } from '../../src/services/csvParser.js';

const noCoord = {
  '화장실명': '중앙공원 화장실', '소재지도로명주소': '경기도 수원시 팔달구 중부대로 1',
  '소재지지번주소': '경기도 수원시 팔달구 매교동 1', '개방자치단체코드': '3740000', '관리번호': '3740000-1',
} as any; // WGS84위도/경도 없음

describe('transformToiletRow 좌표 옵션화', () => {
  it('좌표 없어도 저장하고 lat/lng=null', () => {
    const r = transformToiletRow(noCoord);
    expect(r).not.toBeNull();
    expect(r!.lat).toBeNull();
    expect(r!.lng).toBeNull();
    expect(r!.city).toBe('경기');
    expect(r!.district).toBe('수원시');
    // sourceId/id가 좌표 아닌 관리번호 기반 → 동일 입력 재실행 시 안정
    expect(r!.id).toBe(transformToiletRow(noCoord)!.id);
  });
  it('좌표 있으면 유지', () => {
    const r = transformToiletRow({ ...noCoord, 'WGS84위도': '37.28', 'WGS84경도': '127.01' });
    expect(r!.lat).toBeCloseTo(37.28, 2); expect(r!.lng).toBeCloseTo(127.01, 2);
  });
});
