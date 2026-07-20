import { describe, it, expect } from 'vitest';
import { transformParkRow } from '../../src/services/csvParser.js';

const sample = {
  manageNo: 'PK-100',
  parkNm: '중앙공원',
  parkSe: '근린공원',
  rdnmadr: '전남광주통합특별시 목포시 원마인로 100',
  lnmadr: '전남광주통합특별시 목포시 상동 100',
  latitude: '34.8',
  longitude: '126.4',
  parkAr: '12000',
  mvmFclty: '축구장',
  amsmtFclty: '미끄럼틀',
  cnvnncFclty: '화장실',
  cltrFclty: '도서관',
  etcFclty: '조형물',
  appnNtfcDate: '2010-01-01',
  institutionNm: '목포시청',
  phoneNumber: '061-000-0000',
  referenceDate: '2024-01-01',
  insttCode: '6350000',
  insttNm: '목포시',
} as any;

describe('transformParkRow (영문 API 필드)', () => {
  it('영문 필드 아이템을 정상 변환한다', () => {
    const r = transformParkRow(sample);
    expect(r).not.toBeNull();
    expect(r!.name).toBe('중앙공원');
    expect(r!.city).toBe('전남광주통합특별시');
    expect(r!.district).toBe('목포시');
    expect(r!.lat).toBeCloseTo(34.8, 5);
    expect(r!.lng).toBeCloseTo(126.4, 5);
    expect(r!.parkType).toBe('근린공원');
    expect(r!.area).toBeCloseTo(12000, 1);
  });

  it('부가 필드(시설·관리·제공기관)도 영문 키에서 정상 변환한다', () => {
    const r = transformParkRow(sample);
    expect(r).not.toBeNull();
    expect(r!.exerciseFacilities).toBe('축구장');
    expect(r!.playFacilities).toBe('미끄럼틀');
    expect(r!.convenienceFacilities).toBe('화장실');
    expect(r!.cultureFacilities).toBe('도서관');
    expect(r!.otherFacilities).toBe('조형물');
    expect(r!.designatedDate).toBe('2010-01-01');
    expect(r!.managingOrg).toBe('목포시청');
    expect(r!.phoneNumber).toBe('061-000-0000');
    expect(r!.dataDate).toBe('2024-01-01');
    expect(r!.providerCode).toBe('6350000');
    expect(r!.providerName).toBe('목포시');
  });
});
