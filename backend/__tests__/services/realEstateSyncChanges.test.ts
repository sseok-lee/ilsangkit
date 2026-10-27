import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { realEstateRecordUnchanged as unchanged } from '../../src/lib/realEstateSyncChanges.js';
describe('재수신 거래의 변경 신호', () => {
  it('새 거래와 취소·정정은 변경 신호를 남긴다', () => {
    expect(unchanged(null, { dealAmount: 100n })).toBe(false);
    expect(unchanged({ dealAmount: 100n }, { dealAmount: 101n })).toBe(false);
    expect(unchanged({ cancelDealType: null }, { cancelDealType: '해제' })).toBe(false);
    expect(unchanged({ dealDay: 1 }, { dealDay: 2 })).toBe(false);
  });
  it('DB Decimal·BigInt·날짜는 같은 입력을 재수신해도 바뀌지 않는다', () => {
    expect(unchanged({ exclusiveArea: new Prisma.Decimal('84.9900'), dealAmount: 100n, time: new Date(0), id: 1 },
      { exclusiveArea: '84.99', dealAmount: 100n, time: new Date(0), id: undefined })).toBe(true);
    expect(unchanged({ exclusiveArea: new Prisma.Decimal('84.99') }, { exclusiveArea: null })).toBe(false);
    expect(unchanged({ exclusiveArea: new Prisma.Decimal('85.00') }, { exclusiveArea: '84.995' })).toBe(true);
  });
});
