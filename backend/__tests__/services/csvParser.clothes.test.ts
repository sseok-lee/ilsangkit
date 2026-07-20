// @TASK T2 - clothes TN API 영문 필드명 마이그레이션 테스트
// data.go.kr TN 표준데이터 API가 한글 필드명 → 영문 필드명으로 전환됨에 따라
// transformClothesRow가 영문 키(mngNo, instlPlcNm, ctpvNm, sggNm, lat, lot 등)를
// 올바르게 읽는지 검증한다. 특히 경도는 longitude가 아닌 `lot` 필드에서 읽어야 한다.

import { describe, it, expect } from 'vitest';
import { transformClothesRow, ClothesCSVRow } from '../../src/services/csvParser';

describe('CSV Parser - transformClothesRow (TN API 영문 필드명)', () => {
  it('should transform an English-field API row into Clothes format', () => {
    const row: ClothesCSVRow = {
      mngNo: 'CLOTHES-001',
      instlPlcNm: '의류수거함',
      ctpvNm: '광주광역시',
      sggNm: '서구',
      lctnRoadNmAddr: '광주광역시 서구 상무대로 396',
      lctnLotnoAddr: '광주광역시 서구 치평동 123',
      lat: '35.15',
      lot: '126.85',
      mngInstNm: '서구청',
      mngInstTelno: '062-123-4567',
      dataCrtrYmd: '2025-01-01',
      dtlPstn: '아파트 단지 앞',
      insttCode: '1234567',
      insttNm: '광주광역시',
    };

    const clothes = transformClothesRow(row);

    expect(clothes).not.toBeNull();
    expect(clothes!.name).toBe('의류수거함');
    expect(clothes!.roadAddress).toBe('광주광역시 서구 상무대로 396');
    expect(clothes!.address).toBe('광주광역시 서구 치평동 123');
    expect(clothes!.city).toBe('광주');
    expect(clothes!.district).toBe('서구');
    // 경도는 longitude가 아닌 `lot` 필드에서 읽어야 한다.
    expect(clothes!.lat).toBeCloseTo(35.15, 6);
    expect(clothes!.lng).toBeCloseTo(126.85, 6);
    expect(clothes!.managementAgency).toBe('서구청');
    expect(clothes!.phoneNumber).toBe('062-123-4567');
    expect(clothes!.dataDate).toBe('2025-01-01');
    expect(clothes!.detailLocation).toBe('아파트 단지 앞');
    expect(clothes!.providerCode).toBe('1234567');
    expect(clothes!.providerName).toBe('광주광역시');
  });

  it('should return null when city or district is missing', () => {
    const row: ClothesCSVRow = {
      mngNo: 'CLOTHES-002',
      instlPlcNm: '의류수거함',
      ctpvNm: '',
      sggNm: '',
      lctnRoadNmAddr: '',
      lctnLotnoAddr: '',
      lat: '35.15',
      lot: '126.85',
    };

    expect(transformClothesRow(row)).toBeNull();
  });
});
