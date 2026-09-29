import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';

export interface BuildingAddressIdentity {
  propertyType: string;
  bjdCode: string;
  buildingName: string;
  dongName: string;
  jibun: string | null;
}

/** Stable across summary rebuilds and shared by sale/rent for the same property. */
export function makeBuildingKey(identity: BuildingAddressIdentity): string {
  return createHash('sha256').update([
    identity.propertyType, identity.bjdCode, identity.buildingName,
    identity.dongName.trim(), identity.jibun?.trim() ?? '',
  ].join('\x1f')).digest('hex');
}

/** SQL counterpart of makeBuildingKey; aliases must be trusted identifiers. */
export function buildingKeySql(propertyType: string, alias: string): Prisma.Sql {
  if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(alias)) throw new Error('Invalid SQL alias');
  const column = (name: string): Prisma.Sql => Prisma.raw(`${alias}.${name}`);
  return Prisma.sql`SHA2(CONCAT_WS(CHAR(31), ${propertyType}, ${column('bjdCode')}, ${column('buildingName')}, TRIM(${column('dongName')}), COALESCE(TRIM(${column('jibun')}), '')), 256)`;
}
