#!/usr/bin/env tsx

import 'dotenv/config';
import { prisma } from '../lib/prisma.js';

const REPORTED_TOILET = {
  id: 'toilet-5423af32f2a034b7',
  addressContains: '영등포구 양산로 지하21',
  lat: 37.509109,
  lng: 127.049088,
} as const;

export interface RepairResult {
  mode: 'dry-run' | 'apply';
  matched: number;
  updated: number;
  message: string;
}

type CountArgs = { where: object };
type UpdateManyArgs = { where: object; data: { lat: null; lng: null } };

interface ToiletRepairClient {
  toilet: {
    count: (args: CountArgs) => Promise<number>;
    updateMany: (args: UpdateManyArgs) => Promise<{ count: number }>;
  };
}

function reportedToiletWhere(): object {
  return {
    id: REPORTED_TOILET.id,
    OR: [
      { address: { contains: REPORTED_TOILET.addressContains } },
      { roadAddress: { contains: REPORTED_TOILET.addressContains } },
    ],
    lat: REPORTED_TOILET.lat,
    lng: REPORTED_TOILET.lng,
  };
}

export async function repairReportedToiletCoordinates(
  db: ToiletRepairClient = prisma,
  options: { apply?: boolean } = {}
): Promise<RepairResult> {
  const mode = options.apply ? 'apply' : 'dry-run';
  const where = reportedToiletWhere();
  const matched = await db.toilet.count({ where });

  if (!options.apply) {
    return {
      mode,
      matched,
      updated: 0,
      message: matched === 1
        ? 'dry-run: reported toilet matches guard; --apply would set lat/lng to null'
        : 'dry-run: guard did not match exactly; no update would run',
    };
  }

  if (matched !== 1) {
    return {
      mode,
      matched,
      updated: 0,
      message: 'apply: guard did not match exactly; no update ran',
    };
  }

  const result = await db.toilet.updateMany({
    where,
    data: { lat: null, lng: null },
  });

  return {
    mode,
    matched,
    updated: result.count,
    message: `apply: set lat/lng to null for ${result.count} reported toilet row`,
  };
}

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');
  const result = await repairReportedToiletCoordinates(prisma, { apply });
  console.info(JSON.stringify(result, null, 2));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main()
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
