import { Prisma } from '@prisma/client';

/** 재수신된 같은 거래는 syncedAt을 보존한다. 조회했던 원본을 재사용하므로 추가 쿼리는 없다. */
export function realEstateRecordUnchanged(existing: Record<string, unknown> | null, record: object): boolean {
  if (!existing) return false;
  return Object.entries(record).every(([key, value]) => {
    if (value === undefined) return true; // Prisma update도 undefined 필드를 쓰지 않는다.
    const previous = existing[key];
    if (Prisma.Decimal.isDecimal(previous)) {
      if (value == null) return false;
      const incoming = new Prisma.Decimal(value as Prisma.Decimal.Value);
      // 여섯 거래 테이블의 면적은 DECIMAL(10,2). MySQL 저장 반올림과 맞춘다.
      return previous.equals(key === 'exclusiveArea' ? incoming.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP) : incoming);
    }
    if (previous instanceof Date && value instanceof Date) return previous.getTime() === value.getTime();
    return previous === value;
  });
}
