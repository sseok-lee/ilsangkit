import { Prisma } from '@prisma/client';

export function saleNotCanceled(alias: string): Prisma.Sql {
  return Prisma.sql`(${Prisma.raw(`${alias}.cancelDealDay`)} IS NULL OR ${Prisma.raw(`${alias}.cancelDealDay`)} = '')
    AND (${Prisma.raw(`${alias}.cancelDealType`)} IS NULL OR ${Prisma.raw(`${alias}.cancelDealType`)} = '')`;
}

export function validKnownDateThrough(today: string, alias: string): Prisma.Sql {
  return Prisma.sql`
    ${knownDateValidity(alias)}
    AND ${dealDateExpression(alias)} <= ${today}
  `;
}

export function overviewDateThrough(today: string, alias: string): Prisma.Sql {
  const [year, month] = today.split('-').map(Number);
  return Prisma.sql`
    ${Prisma.raw(`${alias}.dealYear`)} BETWEEN 1 AND 9999
    AND ${Prisma.raw(`${alias}.dealMonth`)} BETWEEN 1 AND 12
    AND (
      (
        ${Prisma.raw(`${alias}.dealDay`)} IS NULL
        AND (${Prisma.raw(`${alias}.dealYear`)} < ${year}
          OR (${Prisma.raw(`${alias}.dealYear`)} = ${year} AND ${Prisma.raw(`${alias}.dealMonth`)} <= ${month}))
      )
      OR (
        ${knownDateValidity(alias)}
        AND ${dealDateExpression(alias)} <= ${today}
      )
    )
  `;
}

export function knownDateValidity(alias: string): Prisma.Sql {
  return Prisma.sql`
    ${Prisma.raw(`${alias}.dealYear`)} BETWEEN 1 AND 9999
    AND ${Prisma.raw(`${alias}.dealMonth`)} BETWEEN 1 AND 12
    AND ${Prisma.raw(`${alias}.dealDay`)} IS NOT NULL
    AND ${Prisma.raw(`${alias}.dealDay`)} >= 1
    AND ${Prisma.raw(`${alias}.dealDay`)} <= DAY(LAST_DAY(CONCAT(${Prisma.raw(`${alias}.dealYear`)}, '-', LPAD(${Prisma.raw(`${alias}.dealMonth`)}, 2, '0'), '-01')))
  `;
}

export function dealDateExpression(alias: string): Prisma.Sql {
  return Prisma.sql`STR_TO_DATE(CONCAT(${Prisma.raw(`${alias}.dealYear`)}, '-', LPAD(${Prisma.raw(`${alias}.dealMonth`)}, 2, '0'), '-', LPAD(${Prisma.raw(`${alias}.dealDay`)}, 2, '0')), '%Y-%m-%d')`;
}
