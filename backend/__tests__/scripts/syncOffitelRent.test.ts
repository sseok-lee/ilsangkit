// @TASK Phase2-7 - 오피스텔 전월세 동기화 스크립트 테스트 (TDD)

import { describe, it, expect } from 'vitest';
import { transformOffitelRentItem, type RawOffitelRentItem } from '../../src/scripts/syncOffitelRent.js';

describe('transformOffitelRentItem', () => {
  const baseItem: RawOffitelRentItem = {
    deposit: '5,000',
    monthlyRent: '80',
    contractTerm: '26.03~27.03',
    offiNm: '강남오피스텔',
    buildYear: '2015',
    floor: '7',
    excluUseAr: '33.55',
    umdNm: '삼성동',
    sggCd: '11680',
    jibun: '789-1',
    dealYear: '2024',
    dealMonth: '9',
    dealDay: '5',
    city: '서울특별시',
    district: '강남구',
    contractType: '갱신',
    preDeposit: '4,000',
    preMonthlyRent: '70',
    useRRRight: '사용',
  };

  it('기본 필드 매핑이 올바르게 동작', () => {
    const result = transformOffitelRentItem(baseItem);
    expect(result).not.toBeNull();
    expect(result!.buildingName).toBe('강남오피스텔');
    expect(result!.dongName).toBe('삼성동');
    expect(result!.bjdCode).toBe('11680');
    expect(result!.jibun).toBe('789-1');
    expect(result!.roadName).toBe('');
    expect(result!.city).toBe('서울특별시');
    expect(result!.district).toBe('강남구');
  });

  it('보증금액 쉼표 제거 후 BigInt 변환', () => {
    const result = transformOffitelRentItem(baseItem);
    expect(result!.deposit).toBe(BigInt(5000));
  });

  it('월세금액 숫자 변환', () => {
    const result = transformOffitelRentItem(baseItem);
    expect(result!.monthlyRent).toBe(80);
  });

  it('monthlyRent > 0이면 rentType은 월세', () => {
    const result = transformOffitelRentItem(baseItem);
    expect(result!.rentType).toBe('월세');
  });

  it('계약기간 문자열 보존', () => {
    const result = transformOffitelRentItem(baseItem);
    expect(result!.contractTerm).toBe('26.03~27.03');
  });

  it('건축년도, 층, 전용면적 숫자 변환', () => {
    const result = transformOffitelRentItem(baseItem);
    expect(result!.buildYear).toBe(2015);
    expect(result!.floor).toBe(7);
    expect(result!.exclusiveArea).toBeCloseTo(33.55);
  });

  it('년/월/일 숫자 변환', () => {
    const result = transformOffitelRentItem(baseItem);
    expect(result!.dealYear).toBe(2024);
    expect(result!.dealMonth).toBe(9);
    expect(result!.dealDay).toBe(5);
  });

  it('sourceId 생성 형식 확인', () => {
    const result = transformOffitelRentItem(baseItem);
    expect(result!.sourceId).toBe('offitelRent-11680-2015-2024-9-5-7-33.55');
  });

  it('월세금액이 빈 문자열이면 null', () => {
    const item = { ...baseItem, monthlyRent: '' };
    const result = transformOffitelRentItem(item);
    expect(result!.monthlyRent).toBeNull();
  });

  it('계약기간이 빈 문자열이면 null', () => {
    const item = { ...baseItem, contractTerm: '' };
    const result = transformOffitelRentItem(item);
    expect(result!.contractTerm).toBeNull();
  });

  it('건축년도가 빈 문자열이면 null', () => {
    const item = { ...baseItem, buildYear: '' };
    const result = transformOffitelRentItem(item);
    expect(result!.buildYear).toBeNull();
  });

  it('층이 빈 문자열이면 null', () => {
    const item = { ...baseItem, floor: '' };
    const result = transformOffitelRentItem(item);
    expect(result!.floor).toBeNull();
  });

  it('전용면적이 빈 문자열이면 null', () => {
    const item = { ...baseItem, excluUseAr: '' };
    const result = transformOffitelRentItem(item);
    expect(result!.exclusiveArea).toBeNull();
  });

  it('일이 빈 문자열이면 null', () => {
    const item = { ...baseItem, dealDay: '' };
    const result = transformOffitelRentItem(item);
    expect(result!.dealDay).toBeNull();
  });

  it('전세인 경우 (monthlyRent가 0)', () => {
    const item = { ...baseItem, monthlyRent: '0' };
    const result = transformOffitelRentItem(item);
    expect(result!.rentType).toBe('전세');
    expect(result!.monthlyRent).toBe(0);
  });

  it('monthlyRent가 null이면 rentType은 전세', () => {
    const item = { ...baseItem, monthlyRent: '' };
    const result = transformOffitelRentItem(item);
    expect(result!.rentType).toBe('전세');
  });

  it('contractType 문자열 보존', () => {
    const result = transformOffitelRentItem(baseItem);
    expect(result!.contractType).toBe('갱신');
  });

  it('contractType이 빈 문자열이면 null', () => {
    const item = { ...baseItem, contractType: '' };
    const result = transformOffitelRentItem(item);
    expect(result!.contractType).toBeNull();
  });

  it('preDeposit 쉼표 제거 후 BigInt 변환', () => {
    const result = transformOffitelRentItem(baseItem);
    expect(result!.preDeposit).toBe(BigInt(4000));
  });

  it('preDeposit이 빈 문자열이면 null', () => {
    const item = { ...baseItem, preDeposit: '' };
    const result = transformOffitelRentItem(item);
    expect(result!.preDeposit).toBeNull();
  });

  it('preMonthlyRent 숫자 변환', () => {
    const result = transformOffitelRentItem(baseItem);
    expect(result!.preMonthlyRent).toBe(70);
  });

  it('preMonthlyRent가 빈 문자열이면 null', () => {
    const item = { ...baseItem, preMonthlyRent: '' };
    const result = transformOffitelRentItem(item);
    expect(result!.preMonthlyRent).toBeNull();
  });

  it('useRenewalRight 문자열 보존', () => {
    const result = transformOffitelRentItem(baseItem);
    expect(result!.useRenewalRight).toBe('사용');
  });

  it('useRenewalRight가 빈 문자열이면 null', () => {
    const item = { ...baseItem, useRRRight: '' };
    const result = transformOffitelRentItem(item);
    expect(result!.useRenewalRight).toBeNull();
  });
});
