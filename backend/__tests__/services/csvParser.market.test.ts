import { describe, it, expect } from 'vitest';
import { transformMarketRow } from '../../src/services/csvParser.js';

const sample = {
  mrktNm: '동문전통시장',
  mrktType: '상설시장',
  rdnmadr: '전라남도 목포시 원마인로 100',
  lnmadr: '전라남도 목포시 상동 100',
  mrktEstblCycle: '매일',
  latitude: '35.1',
  longitude: '126.9',
  storNumber: '50',
  trtmntPrdlst: '농산물,수산물',
  useGcct: '온누리상품권',
  homepageUrl: 'https://example.com',
  pblicToiletYn: 'Y',
  prkplceYn: 'N',
  estblYear: '1980',
  phoneNumber: '061-000-0000',
  referenceDate: '2024-01-01',
  insttCode: '6350000',
  insttNm: '목포시',
} as any;

describe('transformMarketRow (영문 API 필드)', () => {
  it('영문 필드 아이템을 정상 변환한다', () => {
    const r = transformMarketRow(sample);
    expect(r).not.toBeNull();
    expect(r!.name).toBe('동문전통시장');
    expect(r!.city).toBe('전남');
    expect(r!.district).toBe('목포시');
    expect(r!.lat).toBeCloseTo(35.1, 5);
    expect(r!.lng).toBeCloseTo(126.9, 5);
    expect(r!.storeCount).toBe(50);
  });

  it('부가 필드(시장정보·관리·제공기관)도 영문 키에서 정상 변환한다', () => {
    const r = transformMarketRow(sample);
    expect(r).not.toBeNull();
    expect(r!.marketType).toBe('상설시장');
    expect(r!.openingCycle).toBe('매일');
    expect(r!.products).toBe('농산물,수산물');
    expect(r!.giftCertificates).toBe('온누리상품권');
    expect(r!.homepageUrl).toBe('https://example.com');
    expect(r!.hasPublicToilet).toBe(true);
    expect(r!.hasParking).toBe(false);
    expect(r!.foundedYear).toBe(1980);
    expect(r!.phoneNumber).toBe('061-000-0000');
    expect(r!.dataDate).toBe('2024-01-01');
    expect(r!.providerCode).toBe('6350000');
    expect(r!.providerName).toBe('목포시');
  });
});
