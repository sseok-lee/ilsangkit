// @TASK Phase2-5 - 빌라 전월세 동기화 스크립트 테스트 (TDD)

import { describe, it, expect } from 'vitest';
import { transformVillaRentItem, type RawVillaRentItem } from '../../src/scripts/syncVillaRent.js';

describe('transformVillaRentItem', () => {
  const baseItem: RawVillaRentItem = {
    deposit: '10,000',
    monthlyRent: '50',
    contractTerm: '24',
    mhouseNm: '행복빌라',
    buildYear: '2005',
    floor: '3',
    excluUseAr: '59.98',
    umdNm: '역삼동',
    sggCd: '11680',
    jibun: '123-4',
    dealYear: '2024',
    dealMonth: '3',
    dealDay: '15',
    city: '서울특별시',
    district: '강남구',
    houseType: '연립다세대',
    contractType: '신규',
    preDeposit: '5,000',
    preMonthlyRent: '30',
    useRRRight: '사용',
  };

  it('기본 필드 매핑이 올바르게 동작', () => {
    const result = transformVillaRentItem(baseItem);
    expect(result).not.toBeNull();
    expect(result!.buildingName).toBe('행복빌라');
    expect(result!.dongName).toBe('역삼동');
    expect(result!.bjdCode).toBe('11680');
    expect(result!.jibun).toBe('123-4');
    expect(result!.roadName).toBe('');
    expect(result!.city).toBe('서울특별시');
    expect(result!.district).toBe('강남구');
  });

  it('보증금액 쉼표 제거 후 BigInt 변환', () => {
    const result = transformVillaRentItem(baseItem);
    expect(result!.deposit).toBe(BigInt(10000));
  });

  it('월세금액 숫자 변환', () => {
    const result = transformVillaRentItem(baseItem);
    expect(result!.monthlyRent).toBe(50);
  });

  it('전월세구분 파생 - monthlyRent > 0이면 월세', () => {
    const result = transformVillaRentItem(baseItem);
    expect(result!.rentType).toBe('월세');
  });

  it('계약기간 문자열 변환', () => {
    const result = transformVillaRentItem(baseItem);
    expect(result!.contractTerm).toBe('24');
  });

  it('신규 필드 매핑이 올바르게 동작', () => {
    const result = transformVillaRentItem(baseItem);
    expect(result!.houseType).toBe('연립다세대');
    expect(result!.contractType).toBe('신규');
    expect(result!.preDeposit).toBe(BigInt(5000));
    expect(result!.preMonthlyRent).toBe(30);
    expect(result!.useRenewalRight).toBe('사용');
  });

  it('건축년도, 층, 전용면적 숫자 변환', () => {
    const result = transformVillaRentItem(baseItem);
    expect(result!.buildYear).toBe(2005);
    expect(result!.floor).toBe(3);
    expect(result!.exclusiveArea).toBeCloseTo(59.98);
  });

  it('년/월/일 숫자 변환', () => {
    const result = transformVillaRentItem(baseItem);
    expect(result!.dealYear).toBe(2024);
    expect(result!.dealMonth).toBe(3);
    expect(result!.dealDay).toBe(15);
  });

  it('sourceId 생성 형식 확인', () => {
    const result = transformVillaRentItem(baseItem);
    expect(result!.sourceId).toBe('villaRent-11680-2005-2024-3-15-3-59.98');
  });

  it('보증금액에 쉼표 없는 경우도 정상 처리', () => {
    const item = { ...baseItem, deposit: '50000' };
    const result = transformVillaRentItem(item);
    expect(result!.deposit).toBe(BigInt(50000));
  });

  it('월세금액이 빈 문자열이면 null', () => {
    const item = { ...baseItem, monthlyRent: '' };
    const result = transformVillaRentItem(item);
    expect(result!.monthlyRent).toBeNull();
  });

  it('계약기간이 빈 문자열이면 null', () => {
    const item = { ...baseItem, contractTerm: '' };
    const result = transformVillaRentItem(item);
    expect(result!.contractTerm).toBeNull();
  });

  it('신규 필드가 빈 문자열이면 null', () => {
    const item = { ...baseItem, houseType: '', contractType: '', preDeposit: '', preMonthlyRent: '', useRRRight: '' };
    const result = transformVillaRentItem(item);
    expect(result!.houseType).toBeNull();
    expect(result!.contractType).toBeNull();
    expect(result!.preDeposit).toBeNull();
    expect(result!.preMonthlyRent).toBeNull();
    expect(result!.useRenewalRight).toBeNull();
  });

  it('건축년도가 빈 문자열이면 null', () => {
    const item = { ...baseItem, buildYear: '' };
    const result = transformVillaRentItem(item);
    expect(result!.buildYear).toBeNull();
  });

  it('층이 빈 문자열이면 null', () => {
    const item = { ...baseItem, floor: '' };
    const result = transformVillaRentItem(item);
    expect(result!.floor).toBeNull();
  });

  it('전용면적이 빈 문자열이면 null', () => {
    const item = { ...baseItem, excluUseAr: '' };
    const result = transformVillaRentItem(item);
    expect(result!.exclusiveArea).toBeNull();
  });

  it('일이 빈 문자열이면 null', () => {
    const item = { ...baseItem, dealDay: '' };
    const result = transformVillaRentItem(item);
    expect(result!.dealDay).toBeNull();
  });

  it('전세인 경우 - monthlyRent가 0이면 rentType 전세', () => {
    const item = { ...baseItem, monthlyRent: '0' };
    const result = transformVillaRentItem(item);
    expect(result!.rentType).toBe('전세');
    expect(result!.monthlyRent).toBe(0);
  });
});
