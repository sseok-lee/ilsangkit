import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { Prisma } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { prisma } from '../../src/lib/prisma.js';
import { SubscriptionListSchema } from '../../src/schemas/subscription.js';
import { getSubscriptionList } from '../../src/services/subscriptionService.js';

const execFileAsync = promisify(execFile);
const PREFIX = `sl-${Date.now().toString(36)}`;
const FIXED_NOW = new Date('2026-04-21T03:00:00.000Z');
const createdSubscriptionIds: number[] = [];

let secondarySupplyNoticeId = 0;
let sameRowPublicNoticeId = 0;
let crossRowPublicNoticeId = 0;
let literalNoticeId = 0;
let literalWildcardNearMissNoticeId = 0;
let rentOngoingId = 0;
let supersededNoticeId = 0;
let recentUpcomingId = 0;
let recentOngoingId = 0;
let recentUnknownId = 0;
let recentClosedId = 0;
let pageOldestTieId = 0;
let pageNullAnnouncementId = 0;

describe('subscription list live MySQL integration', () => {
  beforeAll(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(FIXED_NOW);
    await seedFixtures();
  });

  afterAll(async () => {
    try {
      await cleanupFixtures();
    } finally {
      vi.useRealTimers();
      await prisma.$disconnect();
    }
  });

  it('rejects missing or unsafe housing test database URLs before loading Prisma', async () => {
    const missing = await runHousingSetupGuard({});
    expect(missing.code).toBe(1);
    expect(missing.output).toContain('HOUSING_TEST_DATABASE_URL is required');
    expect(missing.output).not.toContain('Prisma');
    expect(missing.output).not.toContain('mysql://');

    const unsafe = await runHousingSetupGuard({
      HOUSING_TEST_DATABASE_URL: 'mysql://user:password@localhost:3306/service_db?connection_limit=1&pool_timeout=1',
    });
    expect(unsafe.code).toBe(1);
    expect(unsafe.output).toContain('Dedicated localhost:3307 *_test MySQL database required');
    expect(unsafe.output).not.toContain('service_db');
    expect(unsafe.output).not.toContain('password');
    expect(unsafe.output).not.toContain('Prisma');
  });

  it('finds a PUBLIC_RENT notice from only the second supply row and treats %_ as literal text', async () => {
    const secondSupplyQuery = SubscriptionListSchema.parse({
      category: 'rent',
      q: `수원시 ${PREFIX}`,
      sort: 'recent',
    });
    const secondSupply = await getSubscriptionList(secondSupplyQuery);

    expect(secondSupply.items.map((item) => item.id)).toEqual([secondarySupplyNoticeId]);
    expect(secondSupply.total).toBe(1);

    const literalQuery = SubscriptionListSchema.parse({
      category: 'rent',
      q: `${PREFIX} %_테스트`,
      sort: 'recent',
    });
    const literal = await getSubscriptionList(literalQuery);

    expect(literal.items.map((item) => item.id)).toEqual([literalNoticeId]);
    expect(literal.items.map((item) => item.id)).not.toContain(literalWildcardNearMissNoticeId);
    expect(literal.total).toBe(1);
  });

  it('combines region, category, status, and q on actual SQL while excluding superseded notices', async () => {
    const sameSupplyRegion = SubscriptionListSchema.parse({
      category: 'rent',
      region: '서울 강남구',
      q: `${PREFIX} 지역검증`,
      sort: 'recent',
    });
    const sameSupply = await getSubscriptionList(sameSupplyRegion);

    expect(sameSupply.items.map((item) => item.id)).toEqual([sameRowPublicNoticeId]);
    expect(sameSupply.items.map((item) => item.id)).not.toContain(crossRowPublicNoticeId);
    expect(sameSupply.total).toBe(1);

    const ongoingRent = SubscriptionListSchema.parse({
      category: 'rent',
      status: 'ongoing',
      q: `${PREFIX} 상태검증`,
      sort: 'priority',
    });
    const filtered = await getSubscriptionList(ongoingRent);

    expect(filtered.items.map((item) => item.id)).toEqual([rentOngoingId]);
    expect(filtered.items.map((item) => item.id)).not.toContain(supersededNoticeId);
    expect(filtered.items.map((item) => item.status)).toEqual(['ongoing']);
    expect(filtered.total).toBe(1);
  });

  it('orders 21 tied rows plus a null announcement over the second page deterministically', async () => {
    const query = SubscriptionListSchema.parse({
      category: 'rent',
      q: `${PREFIX} 페이지검증`,
      sort: 'recent',
      page: 2,
      limit: 20,
    });
    const result = await getSubscriptionList(query);

    expect(result.total).toBe(22);
    expect(result.totalPages).toBe(2);
    expect(result.items.map((item) => item.id)).toEqual([pageOldestTieId, pageNullAnnouncementId]);
    expect(result.items.map((item) => item.announcementDate)).toEqual([
      new Date('2026-04-10T00:00:00.000Z'),
      null,
    ]);
  });

  it('sort=recent ignores status grouping and recomputes KST/unknown statuses', async () => {
    const query = SubscriptionListSchema.parse({
      category: 'rent',
      q: `${PREFIX} 최근검증`,
      sort: 'recent',
    });
    const result = await getSubscriptionList(query);

    expect(result.items.map((item) => item.id)).toEqual([
      recentUpcomingId,
      recentOngoingId,
      recentUnknownId,
      recentClosedId,
    ]);
    expect(result.items.map((item) => item.status)).toEqual([
      'upcoming',
      'ongoing',
      'unknown',
      'closed',
    ]);
  });
});

async function seedFixtures(): Promise<void> {
  await cleanupFixturesByPrefix();

  await createSubscription(1, {
    sourceType: 'APT',
    houseName: `${PREFIX} 분양검증 APT`,
    houseType: 'APT',
    rentType: null,
    regionName: '서울특별시 강남구',
    supplyLocation: `서울특별시 강남구 ${PREFIX}`,
    status: 'upcoming',
    announcementDate: date('2026-04-01'),
    receptionStartDate: date('2026-04-25'),
    receptionEndDate: date('2026-04-27'),
  });

  await createSubscription(2, {
    sourceType: 'APT',
    houseName: `${PREFIX} 임대검증 APT`,
    houseType: 'APT',
    rentType: '임대주택',
    regionName: '서울특별시 강남구',
    supplyLocation: `서울특별시 강남구 ${PREFIX}`,
    status: 'upcoming',
    announcementDate: date('2026-04-02'),
    receptionStartDate: date('2026-04-26'),
    receptionEndDate: date('2026-04-28'),
  });

  rentOngoingId = await createSubscription(3, {
    sourceType: 'PRIVATE_RENT',
    houseName: `${PREFIX} 상태검증 민간임대`,
    houseType: 'APT',
    rentType: '민간임대',
    regionName: '서울특별시 강남구',
    supplyLocation: `서울특별시 강남구 ${PREFIX}`,
    status: 'upcoming',
    announcementDate: date('2026-04-03'),
    receptionStartDate: date('2026-04-20'),
    receptionEndDate: date('2026-04-22'),
  });

  secondarySupplyNoticeId = await createSubscription(4, {
    sourceType: 'PUBLIC_RENT',
    houseName: `${PREFIX} 공급행검증 공공임대`,
    houseType: 'APT',
    rentType: '임대주택',
    publicRentType: '국민임대',
    regionName: '서울특별시 강남구',
    supplyLocation: `대표 서울 강남구 ${PREFIX}`,
    status: 'unknown',
    announcementDate: date('2026-04-04'),
    receptionStartDate: null,
    receptionEndDate: null,
    publicRental: {
      supplies: [
        { region: '서울', address: `서울 강남구 ${PREFIX}` },
        { region: '경기', address: `경기 수원시 ${PREFIX}` },
      ],
    },
  });

  sameRowPublicNoticeId = await createSubscription(5, {
    sourceType: 'PUBLIC_RENT',
    houseName: `${PREFIX} 지역검증 같은행`,
    houseType: 'APT',
    rentType: '임대주택',
    publicRentType: '행복주택',
    regionName: '전국',
    supplyLocation: `전국 ${PREFIX}`,
    status: 'unknown',
    announcementDate: date('2026-04-05'),
    receptionStartDate: null,
    receptionEndDate: null,
    publicRental: {
      supplies: [
        { region: '서울', address: `서울 강남구 ${PREFIX} 지역검증` },
        { region: '경기', address: `경기 성남시 ${PREFIX} 지역검증` },
      ],
    },
  });

  crossRowPublicNoticeId = await createSubscription(6, {
    sourceType: 'PUBLIC_RENT',
    houseName: `${PREFIX} 지역검증 교차행`,
    houseType: 'APT',
    rentType: '임대주택',
    publicRentType: '행복주택',
    regionName: '전국',
    supplyLocation: `전국 ${PREFIX}`,
    status: 'unknown',
    announcementDate: date('2026-04-06'),
    receptionStartDate: null,
    receptionEndDate: null,
    publicRental: {
      supplies: [
        { region: '서울', address: `서울 중구 ${PREFIX} 지역검증` },
        { region: '부산', address: `부산 강남구 ${PREFIX} 지역검증` },
      ],
    },
  });

  literalNoticeId = await createSubscription(7, {
    sourceType: 'PRIVATE_RENT',
    houseName: `${PREFIX} %_테스트 문자검색`,
    houseType: 'APT',
    rentType: '민간임대',
    regionName: '서울특별시 강남구',
    supplyLocation: `서울특별시 강남구 ${PREFIX}`,
    status: 'upcoming',
    announcementDate: date('2026-04-07'),
    receptionStartDate: date('2026-04-25'),
    receptionEndDate: date('2026-04-26'),
  });

  literalWildcardNearMissNoticeId = await createSubscription(10, {
    sourceType: 'PRIVATE_RENT',
    houseName: `${PREFIX} 일반테스트 문자검색`,
    houseType: 'APT',
    rentType: '민간임대',
    regionName: '서울특별시 강남구',
    supplyLocation: `서울특별시 강남구 ${PREFIX}`,
    status: 'upcoming',
    announcementDate: date('2026-04-07'),
    receptionStartDate: date('2026-04-25'),
    receptionEndDate: date('2026-04-26'),
  });

  const replacementId = await createSubscription(8, {
    sourceType: 'PRIVATE_RENT',
    houseName: `${PREFIX} 상태검증 대체대표`,
    houseType: 'APT',
    rentType: '민간임대',
    regionName: '서울특별시 강남구',
    supplyLocation: `서울특별시 강남구 ${PREFIX}`,
    status: 'upcoming',
    announcementDate: date('2026-04-08'),
    receptionStartDate: date('2026-04-25'),
    receptionEndDate: date('2026-04-26'),
  });
  supersededNoticeId = await createSubscription(9, {
    sourceType: 'PRIVATE_RENT',
    houseName: `${PREFIX} 상태검증 대체공고`,
    houseType: 'APT',
    rentType: '민간임대',
    regionName: '서울특별시 강남구',
    supplyLocation: `서울특별시 강남구 ${PREFIX}`,
    status: 'upcoming',
    announcementDate: date('2026-04-09'),
    receptionStartDate: date('2026-04-20'),
    receptionEndDate: date('2026-04-22'),
    supersededById: replacementId,
  });

  await seedPagedFixtures();
  await seedRecentFixtures();
}

async function seedPagedFixtures(): Promise<void> {
  for (let i = 0; i < 21; i += 1) {
    const id = await createSubscription(20 + i, {
      sourceType: 'PRIVATE_RENT',
      houseName: `${PREFIX} 페이지검증 동률 ${i.toString().padStart(2, '0')}`,
      houseType: 'APT',
      rentType: '민간임대',
      regionName: '서울특별시 강남구',
      supplyLocation: `서울특별시 강남구 ${PREFIX}`,
      status: 'upcoming',
      announcementDate: date('2026-04-10'),
      receptionStartDate: date('2026-04-25'),
      receptionEndDate: date('2026-04-30'),
    });
    if (i === 0) pageOldestTieId = id;
  }

  pageNullAnnouncementId = await createSubscription(41, {
    sourceType: 'PRIVATE_RENT',
    houseName: `${PREFIX} 페이지검증 null`,
    houseType: 'APT',
    rentType: '민간임대',
    regionName: '서울특별시 강남구',
    supplyLocation: `서울특별시 강남구 ${PREFIX}`,
    status: 'upcoming',
    announcementDate: null,
    receptionStartDate: date('2026-04-25'),
    receptionEndDate: date('2026-04-30'),
  });
}

async function seedRecentFixtures(): Promise<void> {
  recentClosedId = await createSubscription(50, {
    sourceType: 'PRIVATE_RENT',
    houseName: `${PREFIX} 최근검증 마감`,
    houseType: 'APT',
    rentType: '민간임대',
    regionName: '서울특별시 강남구',
    supplyLocation: `서울특별시 강남구 ${PREFIX}`,
    status: 'upcoming',
    announcementDate: date('2026-04-01'),
    receptionStartDate: date('2026-04-01'),
    receptionEndDate: date('2026-04-10'),
  });

  recentUnknownId = await createSubscription(51, {
    sourceType: 'PUBLIC_RENT',
    houseName: `${PREFIX} 최근검증 미정`,
    houseType: 'APT',
    rentType: '임대주택',
    publicRentType: '영구임대',
    regionName: '서울특별시 강남구',
    supplyLocation: `서울특별시 강남구 ${PREFIX}`,
    status: 'unknown',
    announcementDate: date('2026-04-02'),
    receptionStartDate: null,
    receptionEndDate: null,
    publicRental: { supplies: [{ region: '서울', address: `서울 강남구 ${PREFIX} 최근검증` }] },
  });

  recentOngoingId = await createSubscription(52, {
    sourceType: 'PRIVATE_RENT',
    houseName: `${PREFIX} 최근검증 접수중`,
    houseType: 'APT',
    rentType: '민간임대',
    regionName: '서울특별시 강남구',
    supplyLocation: `서울특별시 강남구 ${PREFIX}`,
    status: 'upcoming',
    announcementDate: date('2026-04-03'),
    receptionStartDate: date('2026-04-21'),
    receptionEndDate: date('2026-04-21'),
  });

  recentUpcomingId = await createSubscription(53, {
    sourceType: 'PRIVATE_RENT',
    houseName: `${PREFIX} 최근검증 예정`,
    houseType: 'APT',
    rentType: '민간임대',
    regionName: '서울특별시 강남구',
    supplyLocation: `서울특별시 강남구 ${PREFIX}`,
    status: 'closed',
    announcementDate: date('2026-04-04'),
    receptionStartDate: date('2026-04-22'),
    receptionEndDate: date('2026-04-23'),
  });
}

async function createSubscription(
  seq: number,
  data: Partial<Prisma.SubscriptionCreateInput>,
): Promise<number> {
  const row = await prisma.subscription.create({
    data: {
      houseManageNo: `${PREFIX}-${seq.toString(36)}`,
      pblancNo: `${PREFIX}-p${seq.toString(36)}`,
      sourceType: 'APT',
      houseName: `${PREFIX} fixture ${seq}`,
      houseType: 'APT',
      regionName: '서울특별시 강남구',
      status: 'upcoming',
      ...data,
    },
  });
  createdSubscriptionIds.push(row.id);
  return row.id;
}

async function cleanupFixtures(): Promise<number> {
  if (createdSubscriptionIds.length === 0) return 0;
  const result = await prisma.subscription.deleteMany({
    where: { id: { in: createdSubscriptionIds } },
  });
  return result.count;
}

async function cleanupFixturesByPrefix(): Promise<void> {
  await prisma.subscription.deleteMany({
    where: {
      OR: [
        { houseManageNo: { startsWith: PREFIX } },
        { pblancNo: { startsWith: PREFIX } },
      ],
    },
  });
}

async function runHousingSetupGuard(extraEnv: Record<string, string>): Promise<{ code: number; output: string }> {
  try {
    await execFileAsync(
      process.execPath,
      ['--import', 'tsx', '__tests__/integration/housingSetup.ts'],
      {
        cwd: process.cwd(),
        env: {
          PATH: process.env.PATH,
          NODE_ENV: 'test',
          ...extraEnv,
        },
      },
    );
    return { code: 0, output: '' };
  } catch (error) {
    const failed = error as { code?: number; stdout?: string; stderr?: string };
    return {
      code: failed.code ?? 1,
      output: `${failed.stdout ?? ''}${failed.stderr ?? ''}`,
    };
  }
}

function date(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}
