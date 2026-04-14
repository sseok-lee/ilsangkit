import { describe, it, expect, vi } from 'vitest';

vi.mock('../../src/lib/prisma.js', () => ({
  prisma: {
    publicRentalComplex: { upsert: vi.fn(), findUnique: vi.fn() },
    region: { findMany: vi.fn() },
  },
}));

global.fetch = vi.fn();

import {
  transformMyhomeItem,
  type MyhomeRentalItem,
} from '../../src/scripts/syncPublicRent.js';

function makeItem(overrides: Partial<MyhomeRentalItem> = {}): MyhomeRentalItem {
  return {
    hsmpSn: 12345678,
    insttNm: 'LH서울',
    brtcCode: '11',
    brtcNm: '서울특별시',
    signguCode: '530',
    signguNm: '구로구',
    hsmpNm: '서울특별시 구로구',
    rnAdres: '서울특별시 구로구 디지털로 100',
    hshldCo: 2,
    suplyTyNm: '매입임대',
    houseTyNm: '아파트',
    suplyPrvuseAr: 45.5,
    bassRentGtn: 5000000,
    bassMtRntchrg: 150000,
    ...overrides,
  };
}

describe('transformMyhomeItem', () => {
  it('기본 변환', () => {
    const result = transformMyhomeItem(makeItem());
    expect(result.complexCode).toBe('12345678');
    expect(result.sourceId).toBe('lh-12345678');
    expect(result.city).toBe('서울특별시');
    expect(result.district).toBe('구로구');
    expect(result.rentalType).toBe('매입임대');
    expect(result.houseType).toBe('아파트');
    expect(result.householdCount).toBe(2);
    expect(result.exclusiveArea).toBeCloseTo(45.5);
    expect(result.depositAmount).toBe(BigInt(5000000));
    expect(result.monthlyRent).toBe(150000);
    expect(result.landlordAgency).toBe('LH');
  });

  it('도로명주소를 complexName으로 사용', () => {
    const result = transformMyhomeItem(makeItem({ rnAdres: '서울특별시 구로구 디지털로 100' }));
    expect(result.complexName).toBe('서울특별시 구로구 디지털로 100');
  });

  it('rnAdres 없으면 hsmpNm 사용', () => {
    const result = transformMyhomeItem(makeItem({ rnAdres: '' }));
    expect(result.complexName).toBe('서울특별시 구로구');
  });

  it('빈 객체 {} 필드 — BigInt 변환 안전 처리', () => {
    const item = makeItem({
      bassRentGtn: {} as unknown as number,
      bassMtRntchrg: {} as unknown as number,
      suplyPrvuseAr: {} as unknown as number,
      hshldCo: {} as unknown as number,
    });
    const result = transformMyhomeItem(item);
    expect(result.depositAmount).toBeNull();
    expect(result.monthlyRent).toBeNull();
    expect(result.exclusiveArea).toBeNull();
    expect(result.householdCount).toBeNull();
  });

  it('보증금 0원 처리 — BigInt(0)으로 저장', () => {
    const result = transformMyhomeItem(makeItem({ bassRentGtn: 0 }));
    expect(result.depositAmount).toBe(BigInt(0));
  });

  it('houseTyNm 없으면 null', () => {
    const result = transformMyhomeItem(makeItem({ houseTyNm: undefined }));
    expect(result.houseType).toBeNull();
  });

  it('sourceId 형식 검증', () => {
    const result = transformMyhomeItem(makeItem({ hsmpSn: 99999999 }));
    expect(result.sourceId).toBe('lh-99999999');
    expect(result.complexCode).toBe('99999999');
  });
});
