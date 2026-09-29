import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CI_DATABASE_NAME = 'ilsangkit_test';
const LOCAL_CI_HOSTS = new Set(['localhost', '127.0.0.1']);

export function assertLocalCiDatabaseUrl(rawUrl = process.env.DATABASE_URL): string {
  if (!rawUrl) throw new Error('DATABASE_URL is required');
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('DATABASE_URL must be a valid URL');
  }
  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
  if (
    parsed.protocol !== 'mysql:' ||
    !LOCAL_CI_HOSTS.has(parsed.hostname) ||
    databaseName !== CI_DATABASE_NAME
  ) {
    throw new Error(`Refusing to seed CI summary readiness outside local ${CI_DATABASE_NAME}`);
  }
  return databaseName;
}

export const CI_REAL_ESTATE_TYPES = [
  'apt-sale',
  'apt-rent',
  'villa-sale',
  'villa-rent',
  'offitel-sale',
  'offitel-rent',
] as const;

type CiRealEstateType = (typeof CI_REAL_ESTATE_TYPES)[number];

interface SourceFixture {
  type: CiRealEstateType;
  table:
    | 'aptSaleTransaction'
    | 'aptRentTransaction'
    | 'villaSaleTransaction'
    | 'villaRentTransaction'
    | 'offitelSaleTransaction'
    | 'offitelRentTransaction';
  sourceId: string;
  buildingName: string;
  jibun: string;
  saleAmount?: bigint;
  deposit?: bigint;
  monthlyRent?: number;
  rentType?: '전세' | '월세';
}

type RealEstateSourceTable = SourceFixture['table'];

interface RealEstateSourceDelegate {
  upsert(args: {
    where: { sourceId: string };
    update: Record<string, unknown>;
    create: Record<string, unknown>;
  }): Promise<unknown>;
}

type PrismaWithRealEstateSources = Record<RealEstateSourceTable, RealEstateSourceDelegate>;

export function ciRealEstateSourceFixtures(): SourceFixture[] {
  return [
    {
      type: 'apt-sale',
      table: 'aptSaleTransaction',
      sourceId: 'ci-summary-apt-sale-1',
      buildingName: 'CI요약아파트',
      jibun: '101-1',
      saleAmount: 100000n,
    },
    {
      type: 'apt-rent',
      table: 'aptRentTransaction',
      sourceId: 'ci-summary-apt-rent-1',
      buildingName: 'CI요약아파트',
      jibun: '101-1',
      deposit: 50000n,
      monthlyRent: 80,
      rentType: '월세',
    },
    {
      type: 'villa-sale',
      table: 'villaSaleTransaction',
      sourceId: 'ci-summary-villa-sale-1',
      buildingName: 'CI요약빌라',
      jibun: '202-2',
      saleAmount: 70000n,
    },
    {
      type: 'villa-rent',
      table: 'villaRentTransaction',
      sourceId: 'ci-summary-villa-rent-1',
      buildingName: 'CI요약빌라',
      jibun: '202-2',
      deposit: 30000n,
      monthlyRent: 60,
      rentType: '월세',
    },
    {
      type: 'offitel-sale',
      table: 'offitelSaleTransaction',
      sourceId: 'ci-summary-offitel-sale-1',
      buildingName: 'CI요약오피스텔',
      jibun: '303-3',
      saleAmount: 80000n,
    },
    {
      type: 'offitel-rent',
      table: 'offitelRentTransaction',
      sourceId: 'ci-summary-offitel-rent-1',
      buildingName: 'CI요약오피스텔',
      jibun: '303-3',
      deposit: 35000n,
      monthlyRent: 70,
      rentType: '월세',
    },
  ];
}

function commonSourceData(fixture: SourceFixture) {
  return {
    city: '서울특별시',
    district: '강남구',
    bjdCode: '1168010100',
    dongName: '역삼동',
    buildingName: fixture.buildingName,
    buildYear: 2001,
    floor: 10,
    exclusiveArea: '84.10',
    jibun: fixture.jibun,
    roadName: '테헤란로',
    lat: '37.5010000',
    lng: '127.0310000',
    dealYear: 2026,
    dealMonth: 9,
    dealDay: 29,
    sourceId: fixture.sourceId,
  };
}

export async function seedCiRealEstateSources(prisma: PrismaWithRealEstateSources): Promise<void> {
  for (const fixture of ciRealEstateSourceFixtures()) {
    const base = commonSourceData(fixture);
    if (fixture.type.endsWith('-sale')) {
      await prisma[fixture.table].upsert({
        where: { sourceId: fixture.sourceId },
        update: { ...base, dealAmount: fixture.saleAmount },
        create: { ...base, dealAmount: fixture.saleAmount },
      });
      continue;
    }
    await prisma[fixture.table].upsert({
      where: { sourceId: fixture.sourceId },
      update: {
        ...base,
        rentType: fixture.rentType,
        deposit: fixture.deposit,
        monthlyRent: fixture.monthlyRent,
      },
      create: {
        ...base,
        rentType: fixture.rentType,
        deposit: fixture.deposit,
        monthlyRent: fixture.monthlyRent,
      },
    });
  }
}

export async function runCiSummaryReadinessSeed(): Promise<{
  complete: boolean;
  rowCount: number;
  runId: string;
}> {
  assertLocalCiDatabaseUrl();
  process.env.REAL_ESTATE_SUMMARY_MODE = 'address';
  process.env.REAL_ESTATE_WRITE_LOCK_DIR ||= await mkdtemp(
    join(tmpdir(), 'ilsangkit-ci-summary-lock-')
  );

  const [{ prisma }, { prepareRealEstateSummaryV2 }] = await Promise.all([
    import('../lib/prisma.js'),
    import('../services/realEstateSummaryValidation.js'),
  ]);

  try {
    await seedCiRealEstateSources(prisma as unknown as PrismaWithRealEstateSources);
    const report = await prepareRealEstateSummaryV2();
    const countRows = await prisma.$queryRaw<
      Array<{ cnt: bigint }>
    >`SELECT COUNT(*) AS cnt FROM RealEstateBuildingSummaryV2`;
    return {
      complete: report.complete,
      rowCount: Number(countRows[0]?.cnt ?? 0),
      runId: report.runId,
    };
  } finally {
    await prisma.$disconnect();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCiSummaryReadinessSeed()
    .then((result) => {
      console.info(JSON.stringify({ stage: 'ci-summary-readiness', ...result }));
      if (!result.complete || result.rowCount <= 0) process.exitCode = 4;
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
}
