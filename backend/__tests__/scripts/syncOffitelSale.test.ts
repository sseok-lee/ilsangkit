// @TASK Phase2-6 - 오피스텔 매매 동기화 스크립트 테스트 (TDD)

import { describe, it, expect } from 'vitest';
import { transformOffitelSaleItem, type RawOffitelSaleItem } from '../../src/scripts/syncOffitelSale.js';

describe('transformOffitelSaleItem', () => {
  const baseItem: RawOffitelSaleItem = {
    dealAmount: '85,000',
    buildYear: '2010',
    floor: '5',
    excluUseAr: '84.97',
    offiNm: '역삼오피스텔',
    umdNm: '역삼동',
    sggCd: '11680',
    jibun: '456-7',
    dealYear: '2024',
    dealMonth: '6',
    dealDay: '20',
    dealingGbn: '중개거래',
    cdealDay: '',
    cdealType: '',
    buyerGbn: '',
    slerGbn: '',
    city: '서울특별시',
    district: '강남구',
  };

  it('기본 필드 매핑이 올바르게 동작', () => {
    const result = transformOffitelSaleItem(baseItem);
    expect(result).not.toBeNull();
    expect(result!.buildingName).toBe('역삼오피스텔');
    expect(result!.dongName).toBe('역삼동');
    expect(result!.bjdCode).toBe('11680');
    expect(result!.jibun).toBe('456-7');
    expect(result!.roadName).toBe('');
    expect(result!.city).toBe('서울특별시');
    expect(result!.district).toBe('강남구');
  });

  it('거래금액 쉼표 제거 후 BigInt 변환', () => {
    const result = transformOffitelSaleItem(baseItem);
    expect(result!.dealAmount).toBe(BigInt(85000));
  });

  it('거래유형 매핑', () => {
    const result = transformOffitelSaleItem(baseItem);
    expect(result!.dealType).toBe('중개거래');
  });

  it('건축년도, 층, 전용면적 숫자 변환', () => {
    const result = transformOffitelSaleItem(baseItem);
    expect(result!.buildYear).toBe(2010);
    expect(result!.floor).toBe(5);
    expect(result!.exclusiveArea).toBeCloseTo(84.97);
  });

  it('년/월/일 숫자 변환', () => {
    const result = transformOffitelSaleItem(baseItem);
    expect(result!.dealYear).toBe(2024);
    expect(result!.dealMonth).toBe(6);
    expect(result!.dealDay).toBe(20);
  });

  it('sourceId 생성 형식 확인', () => {
    const result = transformOffitelSaleItem(baseItem);
    expect(result!.sourceId).toBe('offitelSale-11680-2010-2024-6-20-5-84.97-85000');
  });

  it('거래금액에 쉼표 여러 개인 경우 처리', () => {
    const item = { ...baseItem, dealAmount: '1,000,000' };
    const result = transformOffitelSaleItem(item);
    expect(result!.dealAmount).toBe(BigInt(1000000));
  });

  it('건축년도가 빈 문자열이면 null', () => {
    const item = { ...baseItem, buildYear: '' };
    const result = transformOffitelSaleItem(item);
    expect(result!.buildYear).toBeNull();
  });

  it('층이 빈 문자열이면 null', () => {
    const item = { ...baseItem, floor: '' };
    const result = transformOffitelSaleItem(item);
    expect(result!.floor).toBeNull();
  });

  it('전용면적이 빈 문자열이면 null', () => {
    const item = { ...baseItem, excluUseAr: '' };
    const result = transformOffitelSaleItem(item);
    expect(result!.exclusiveArea).toBeNull();
  });

  it('일이 빈 문자열이면 null', () => {
    const item = { ...baseItem, dealDay: '' };
    const result = transformOffitelSaleItem(item);
    expect(result!.dealDay).toBeNull();
  });

  it('거래유형이 빈 문자열이면 null', () => {
    const item = { ...baseItem, dealingGbn: '' };
    const result = transformOffitelSaleItem(item);
    expect(result!.dealType).toBeNull();
  });

  it('해제일/해제사유/매수인/매도인 새 필드 매핑', () => {
    const item = { ...baseItem, cdealDay: '20', cdealType: '계약해제', buyerGbn: '개인', slerGbn: '법인' };
    const result = transformOffitelSaleItem(item);
    expect(result!.cancelDealDay).toBe('20');
    expect(result!.cancelDealType).toBe('계약해제');
    expect(result!.buyerType).toBe('개인');
    expect(result!.sellerType).toBe('법인');
  });

  it('새 필드가 빈 문자열이면 null', () => {
    const result = transformOffitelSaleItem(baseItem);
    expect(result!.cancelDealDay).toBeNull();
    expect(result!.cancelDealType).toBeNull();
    expect(result!.buyerType).toBeNull();
    expect(result!.sellerType).toBeNull();
  });
});
