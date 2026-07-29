import { Prisma } from '@prisma/client';

/**
 * Prisma 경로 sync 의 "내용이 실제로 바뀌었나" 판정 (순수 함수).
 *
 * ## 배경
 *
 * 시설 사이트맵 lastmod 는 DB `updatedAt` 에서 나온다. `batchUpsertRaw` 를 쓰는
 * 11개 카테고리는 SQL 레벨에서 조건화했지만(services/upsertClause.ts),
 * hospital · pharmacy · aed 는 인라인 `tx.<model>.upsert()` 루프를 돈다.
 * Prisma 의 `@updatedAt` 은 update 브랜치에서 무조건 발동하므로, 내용이 그대로여도
 * sync 가 훑기만 하면 lastmod 가 갱신된다. 이 세 카테고리가 사이트맵 시설 URL 의
 * 42%(121,498)를 차지한다.
 *
 * 그래서 호출부에서 이 함수로 먼저 판정하고,
 *   변경됨   → 평소대로 update (Prisma 가 updatedAt 을 올린다)
 *   변경없음 → raw UPDATE 로 syncedAt 만 갱신 (@updatedAt 우회)
 * 로 갈라야 한다. #657 이 조회수 플러시에 쓴 것과 같은 패턴이다.
 *
 * ## ★ Decimal 좌표가 핵심 함정
 *
 * Prisma 는 `Decimal(10,7)` 인 lat/lng 을 Decimal 객체로 돌려주는데 소스 데이터는
 * number(또는 string)다. 이 비교를 단순 `===` 로 하면 항상 다르다고 나오고,
 * 좌표가 있는 "모든" 행이 매 sync 마다 변경으로 잡혀 조건화가 통째로 무의미해진다.
 *
 * 게다가 소스가 컬럼 스케일보다 정밀할 수 있다(37.12345674 → DB 는 37.1234567 로 저장).
 * 그대로 비교하면 역시 매번 변경으로 잡힌다. 그래서 양쪽을 컬럼 스케일로 반올림해
 * 비교한다 — DB 가 실제로 저장하게 될 값끼리 비교하는 셈이다.
 */

/** 스키마의 좌표 컬럼 정의: `lat`/`lng` 모두 `@db.Decimal(10, 7)` */
export const DECIMAL_SCALE = 7;

function isDecimal(v: unknown): v is Prisma.Decimal {
  return Prisma.Decimal.isDecimal(v);
}

/** 두 값이 "다른 내용"인지. null 과 undefined 는 같게 본다(둘 다 값 없음). */
export function valuesDiffer(a: unknown, b: unknown): boolean {
  const aNil = a === null || a === undefined;
  const bNil = b === null || b === undefined;
  if (aNil || bNil) return aNil !== bNil;

  // Decimal 이 한쪽이라도 있으면 컬럼 스케일로 반올림해 비교한다.
  if (isDecimal(a) || isDecimal(b)) {
    try {
      const da = isDecimal(a) ? a : new Prisma.Decimal(a as Prisma.Decimal.Value);
      const db = isDecimal(b) ? b : new Prisma.Decimal(b as Prisma.Decimal.Value);
      return da.toFixed(DECIMAL_SCALE) !== db.toFixed(DECIMAL_SCALE);
    } catch {
      // 숫자로 해석할 수 없는 값이 들어온 경우 — 문자열 비교로 폴백한다.
      return String(a) !== String(b);
    }
  }

  if (a instanceof Date || b instanceof Date) {
    const ta = a instanceof Date ? a.getTime() : new Date(a as string).getTime();
    const tb = b instanceof Date ? b.getTime() : new Date(b as string).getTime();
    return ta !== tb;
  }

  return a !== b;
}

/**
 * `next` 에 있는 키만 비교한다. `existing` 의 나머지 컬럼(viewCount·updatedAt 등)은 무시.
 *
 * 비교 대상을 update 페이로드 자체에서 끌어오면 필드 목록이 코드와 자동으로 일치해
 * 컬럼 추가 시 비교 누락이 생기지 않는다. 호출부는 update 에 넣을 객체를 그대로 넘긴다
 * (단, syncedAt 처럼 "확인 시각"에 해당하는 필드는 제외해야 한다 — 항상 달라지므로).
 */
export function hasContentChanged(
  existing: Record<string, unknown>,
  next: Record<string, unknown>
): boolean {
  for (const [key, value] of Object.entries(next)) {
    if (valuesDiffer(existing[key], value)) return true;
  }
  return false;
}
