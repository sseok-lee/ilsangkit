import { Prisma } from '@prisma/client';

/**
 * 부동산 거래의 날짜 범위 필터.
 *
 * WHERE 에 `STR_TO_DATE(CONCAT(dealYear,...)) BETWEEN from AND to` 만 쓰면 컬럼을
 * 함수로 감싸 (dealYear,dealMonth) 인덱스를 못 탄다(풀스캔). 그래서 앞에 인덱스가
 * 타는 복합 정수 조건으로 달 범위를 좁히고, STR_TO_DATE 는 잔여필터로 남겨 정확한
 * 일(day) 경계를 보존한다. 결과 집합은 STR_TO_DATE 단독과 비트 단위로 동일하다.
 *
 * @param from  'YYYY-MM-DD' (inclusive)
 * @param to    'YYYY-MM-DD' (inclusive)
 * @param alias 테이블 별칭(예 't'); 없으면 컬럼을 직접 참조
 */
export function dealDateRangeFilter(from: string, to: string, alias?: string): Prisma.Sql {
  const [fy, fm] = from.split('-').map(Number);
  const [ty, tm] = to.split('-').map(Number);
  const p = alias ? `${alias}.` : '';
  const yCol = Prisma.raw(`${p}dealYear`);
  const mCol = Prisma.raw(`${p}dealMonth`);
  const dCol = Prisma.raw(`${p}dealDay`);
  return Prisma.sql`(${yCol} > ${fy} OR (${yCol} = ${fy} AND ${mCol} >= ${fm}))
    AND (${yCol} < ${ty} OR (${yCol} = ${ty} AND ${mCol} <= ${tm}))
    AND STR_TO_DATE(CONCAT(${yCol}, '-', LPAD(${mCol},2,'0'), '-', LPAD(COALESCE(${dCol},1),2,'0')), '%Y-%m-%d') BETWEEN ${from} AND ${to}`;
}
