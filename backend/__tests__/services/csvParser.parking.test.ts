import { describe, it, expect } from 'vitest';
import { transformParkingRow } from '../../src/services/csvParser.js';

const sample = {
  prkplceNo: '355-2-000029', prkplceNm: '산동우항공원 공영주차장',
  prkplceSe: '공영', prkplceType: '노외',
  rdnmadr: '경상북도 구미시 신당4로1길 56', lnmadr: '경상북도 구미시 산동읍 신당리 2017',
  prkcmprt: '233', latitude: '36.15387449', longitude: '128.4316946',
  basicTime: '30', basicCharge: '300', addUnitTime: '10', addUnitCharge: '100',
  institutionNm: '구미시', phoneNumber: '054-480-6543', referenceDate: '2024-01-01',
  insttCode: 'B551014', insttNm: '구미시',
} as any;

describe('transformParkingRow (영문 API 필드)', () => {
  it('영문 필드 아이템을 정상 변환한다', () => {
    const r = transformParkingRow(sample);
    expect(r).not.toBeNull();
    expect(r!.name).toBe('산동우항공원 공영주차장');
    expect(r!.city).toBe('경북');
    expect(r!.district).toBe('구미시');
    expect(r!.lat).toBeCloseTo(36.15387449, 5);
    expect(r!.lng).toBeCloseTo(128.4316946, 5);
    expect(r!.capacity).toBe(233);
  });

  it('부가 필드(요금·운영시간·기타)도 영문 키에서 정상 변환한다', () => {
    const richSample = {
      ...sample,
      dayCmmtkt: '5000',
      monthCmmtkt: '100000',
      metpay: '현금,카드',
      spcmnt: '특이사항 없음',
      pwdbsPpkZoneYn: 'Y',
      feedingSe: '1급지',
      enforceSe: '홀짝제',
      operDay: '매일',
      parkingchrgeInfo: '유료',
      dayCmmtktAdjTime: '09:00~18:00',
      weekdayOperOpenHhmm: '09:00',
      weekdayOperColseHhmm: '18:00',
      satOperOperOpenHhmm: '09:00',
      satOperCloseHhmm: '13:00',
      holidayOperOpenHhmm: '10:00',
      holidayCloseOpenHhmm: '15:00',
    } as any;

    const r = transformParkingRow(richSample);
    expect(r).not.toBeNull();
    expect(r!.parkingType).toBe('공영');
    expect(r!.lotType).toBe('노외');
    expect(r!.baseFee).toBe(300);
    expect(r!.baseTime).toBe(30);
    expect(r!.additionalFee).toBe(100);
    expect(r!.additionalTime).toBe(10);
    expect(r!.dailyMaxFee).toBe(5000);
    expect(r!.monthlyFee).toBe(100000);
    expect(r!.phone).toBe('054-480-6543');
    expect(r!.paymentMethod).toBe('현금,카드');
    expect(r!.remarks).toBe('특이사항 없음');
    expect(r!.hasDisabledParking).toBe(true);
    expect(r!.zoneClass).toBe('1급지');
    expect(r!.alternateParking).toBe('홀짝제');
    expect(r!.operatingDays).toBe('매일');
    expect(r!.feeType).toBe('유료');
    expect(r!.dailyMaxFeeHours).toBe('09:00~18:00');
    expect(r!.managingOrg).toBe('구미시');
    expect(r!.dataDate).toBe('2024-01-01');
    expect(r!.providerCode).toBe('B551014');
    expect(r!.providerName).toBe('구미시');
    expect(r!.operatingHours).toBe('평일 09:00~18:00, 토요일 09:00~13:00, 공휴일 10:00~15:00');
  });
});
