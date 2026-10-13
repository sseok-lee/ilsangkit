import { createHash, randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import { prisma } from '../../src/lib/prisma.js';
import {
  prepareWasteGeneration,
  publishWasteGeneration,
  rollbackWasteGeneration,
} from '../../src/services/wastePublicationService.js';
import { buildWasteSourceScope } from '../../src/utils/wasteSourceScope.js';
import { reserveRawWasteSchedules, transformTrashData } from '../../src/scripts/syncTrash.js';
import type { ReferenceBundle } from '../../src/types/wasteArea.js';
import { clearStatsCache } from '../../src/services/metaService.js';
import { statsByCityCache } from '../../src/services/facilityStatsService.js';

const PREFIX = `w3-${Date.now()}-${randomUUID().slice(0, 8)}`;
const generationA = `w3-${randomUUID().slice(0, 33)}`;
const generationB = `w3-${randomUUID().slice(0, 33)}`;
const legacySourceId = `${PREFIX}-legacy-source`;
const stagedSourceId = `${PREFIX}-staged-source`;
const areaCodeA = `w3a-${Date.now().toString(36)}`;
const areaCodeB = `w3b-${Date.now().toString(36)}`;
const inputHashA = 'a'.repeat(64);
const inputHashB = 'b'.repeat(64);
const reportHashA = 'c'.repeat(64);
const reportHashB = 'd'.repeat(64);
const fingerprintA = 'e'.repeat(64);
const fingerprintB = 'f'.repeat(64);
const contentHash = '1'.repeat(64);
const coverageKey = '2'.repeat(64);
const staleGenerationCoverageKey = '3'.repeat(64);
const w4GenerationIds: string[] = [];
const W5_PREFIX = `w5${Date.now().toString(36).slice(-6)}${randomUUID().slice(0, 4)}`;
const W5_GENERATION_ID = `w5-${randomUUID().slice(0, 33)}`;
const W5_REMOVED_GENERATION_ID = `w5-removed-${randomUUID().slice(0, 25)}`;
const W5_READY_GENERATION_ID = `w5-ready-${randomUUID().slice(0, 27)}`;
const W5_FAILED_GENERATION_ID = `w5-failed-${randomUUID().slice(0, 26)}`;
const W5_INPUT_HASH = '5'.repeat(64);
const W5_REPORT_HASH = '6'.repeat(64);
const W5_CONTENT_HASH = '7'.repeat(64);
const W5_FINGERPRINT = '8'.repeat(64);
const W5_REGION_BJD_CODE = String(90000 + Math.floor(Math.random() * 9000));
const W5_EVIDENCE = {
  url: 'https://example.test/w5-reference',
  version: 'w5-fixture',
  effectiveFrom: '2020-01-01',
  effectiveTo: null,
  note: 'w5 fixture evidence',
};
let previousW5ActiveGeneration: string | null = null;
let w5AreaA = 0;
let w5AreaB = 0;
let w5AreaEmpty = 0;
let w5AreaExpired = 0;
let w5AreaLegal = 0;
let w5AreaDistrict = 0;
let w5AreaRemoved = 0;
let w5AreaReadyOnly = 0;
let w5AreaFailedOnly = 0;
let w5PrimaryScheduleId = 0;
let w5DirectDistrictOverlapScheduleId = 0;
let w5MultiConditionScheduleId = 0;
let w5LegalOnlyScheduleId = 0;
let w5ExpiredConflictScheduleId = 0;
let w5InactiveScheduleId = 0;
let w5LegacyLiteralId = 0;
let w5LegacyWildcardNearMissId = 0;

const legacyFixture = {
  city: '서울특별시',
  district: '강남구',
  targetRegion: '역삼1동+역삼2동',
  emissionPlace: '내 집 앞',
  details: {
    food: '월/수/금',
    recycle: ['화', '목'],
    note: '원본 JSON 보존',
  },
  sourceId: legacySourceId,
  sourceUrl: 'https://example.test/waste/legacy',
  govCode: '3220000',
};

async function tableExists(tableName: string): Promise<boolean> {
  const rows = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*) AS count
    FROM information_schema.tables
    WHERE table_schema = DATABASE()
      AND table_name = ${tableName}
  `;

  return Number(rows[0]?.count ?? 0) === 1;
}

async function deleteIfExists(tableName: string, whereSql: string): Promise<void> {
  if (await tableExists(tableName)) {
    await prisma.$executeRawUnsafe(`DELETE FROM \`${tableName}\` WHERE ${whereSql}`);
  }
}

async function cleanupFixtures() {
  await deleteIfExists('WasteScheduleCoverage', "`generationId` LIKE 'w3-%'");
  await deleteIfExists('WasteScheduleRevision', "`generationId` LIKE 'w3-%'");
  await deleteIfExists('WasteAreaRelation', "`generationId` LIKE 'w3-%'");
  await deleteIfExists('WasteAreaEntry', "`generationId` LIKE 'w3-%'");
  await deleteIfExists('WastePublication', "`activeGenerationId` LIKE 'w3-%'");
  await deleteIfExists('WasteGeneration', "`id` LIKE 'w3-%'");
  await deleteIfExists(
    'WasteStagedSchedule',
    "`scheduleId` IN (SELECT `id` FROM `WasteSchedule` WHERE `sourceId` LIKE 'w3-%')"
  );
  await prisma.wasteSchedule.deleteMany({ where: { sourceId: { startsWith: 'w3-' } } });
}

afterAll(async () => {
  await cleanupW4Fixtures();
  await cleanupW5Fixtures();
  await cleanupFixtures();
  await prisma.$disconnect();
});

describe('waste area additive storage migration', () => {
  it('keeps the existing original record and all original fields after additive migration', async () => {
    await cleanupFixtures();
    const created = await prisma.wasteSchedule.create({ data: legacyFixture });
    const before = await prisma.wasteSchedule.findUniqueOrThrow({ where: { id: created.id } });

    expect(await tableExists('WasteGeneration')).toBe(true);
    expect(await tableExists('WasteStagedSchedule')).toBe(true);
    expect('discoveryStaged' in before).toBe(false);

    const after = await prisma.wasteSchedule.findUniqueOrThrow({ where: { id: created.id } });

    expect(after).toEqual(before);
    expect(after.id).toBe(created.id);
    expect(after.targetRegion).toBe('역삼1동+역삼2동');

    const markers = await prisma.$queryRaw<Array<{ scheduleId: number }>>`
      SELECT scheduleId FROM WasteStagedSchedule WHERE scheduleId = ${created.id}
    `;
    expect(markers).toEqual([]);
  });

  it('rejects cross-generation area references and duplicate coverage keys while allowing staged schedule markers', async () => {
    await cleanupFixtures();
    const legacy = await prisma.wasteSchedule.create({ data: legacyFixture });
    const staged = await prisma.wasteSchedule.create({
      data: { ...legacyFixture, sourceId: stagedSourceId },
    });

    await prisma.$executeRaw`
      INSERT INTO WasteGeneration (
        id, baseGenerationId, status, referenceVersion, inputHash, reportHash, sourceComplete, createdAt, publishedAt
      ) VALUES
        (${generationA}, NULL, 'staging', 'reference-v1', ${inputHashA}, ${reportHashA}, true, NOW(3), NULL),
        (${generationB}, ${generationA}, 'ready', 'reference-v1', ${inputHashB}, ${reportHashB}, true, NOW(3), NULL)
    `;
    await prisma.$executeRaw`INSERT INTO WasteStagedSchedule (scheduleId) VALUES (${staged.id})`;
    await prisma.$executeRaw`
      INSERT INTO WasteArea (kind, code) VALUES
        ('administrative', ${areaCodeA}),
        ('administrative', ${areaCodeB})
    `;
    const areas = await prisma.$queryRaw<Array<{ id: number; code: string }>>`
      SELECT id, code FROM WasteArea WHERE code IN (${areaCodeA}, ${areaCodeB})
    `;
    const areaA = areas.find((area) => area.code === areaCodeA)!.id;
    const areaB = areas.find((area) => area.code === areaCodeB)!.id;

    await prisma.$executeRaw`
      INSERT INTO WasteAreaEntry (
        generationId, areaId, level, city, district, districtCode, name, validFrom, validTo,
        evidence, indexEligible, indexReason, contentFingerprint, contentUpdatedAt
      ) VALUES
        (${generationA}, ${areaA}, 'dong', '서울특별시', '강남구', '11680', '역삼1동', '2026-01-01', NULL,
          CAST('{"url":"https://example.test/ref","version":"v1","effectiveFrom":"2026-01-01","effectiveTo":null,"note":"fixture"}' AS JSON),
          true, 'verified fixture', ${fingerprintA}, NOW(3)),
        (${generationB}, ${areaB}, 'dong', '서울특별시', '강남구', '11680', '역삼2동', '2026-01-01', NULL,
          CAST('{"url":"https://example.test/ref","version":"v1","effectiveFrom":"2026-01-01","effectiveTo":null,"note":"fixture"}' AS JSON),
          true, 'verified fixture', ${fingerprintB}, NOW(3))
    `;
    await prisma.$executeRaw`
      INSERT INTO WasteScheduleRevision (
        generationId, scheduleId, city, district, sourceId, targetRegion, emissionPlace, details, sourceUrl, govCode,
        rawPayload, provenance, contentHash, sourceModifiedAt, observedAt, contentUpdatedAt, state,
        missingCompleteRuns, terminationEvidence
      ) VALUES (
        ${generationA}, ${legacy.id}, ${legacyFixture.city}, ${legacyFixture.district}, ${legacyFixture.sourceId},
        ${legacyFixture.targetRegion}, ${legacyFixture.emissionPlace}, CAST(${JSON.stringify(legacyFixture.details)} AS JSON),
        ${legacyFixture.sourceUrl}, ${legacyFixture.govCode}, CAST('{"raw":true}' AS JSON), 'legacy',
        ${contentHash}, NULL, NOW(3), NOW(3), 'active', 0, NULL
      )
    `;
    await prisma.$executeRaw`
      INSERT INTO WasteScheduleCoverage (
        generationId, scheduleId, coverageKey, areaId, districtCode, scope, conditionText, state, reason, evidence
      ) VALUES (
        ${generationA}, ${legacy.id}, ${coverageKey}, ${areaA}, NULL, 'whole', '역삼1동 전체', 'verified',
        'fixture verified area', CAST('{"url":"https://example.test/ref","version":"v1"}' AS JSON)
      )
    `;

    await expect(prisma.$executeRaw`
      INSERT INTO WasteScheduleCoverage (
        generationId, scheduleId, coverageKey, areaId, districtCode, scope, conditionText, state, reason, evidence
      ) VALUES (
        ${generationA}, ${legacy.id}, ${staleGenerationCoverageKey}, ${areaB}, NULL, 'whole', '다른 세대 area',
        'verified', 'must reject generation mismatch', CAST('{"url":"https://example.test/ref","version":"v1"}' AS JSON)
      )
    `).rejects.toThrow();
    await expect(prisma.$executeRaw`
      INSERT INTO WasteScheduleCoverage (
        generationId, scheduleId, coverageKey, areaId, districtCode, scope, conditionText, state, reason, evidence
      ) VALUES (
        ${generationA}, ${legacy.id}, ${coverageKey}, ${areaA}, NULL, 'whole', '중복 coverage',
        'verified', 'must reject duplicate', CAST('{"url":"https://example.test/ref","version":"v1"}' AS JSON)
      )
    `).rejects.toThrow();

    const markers = await prisma.$queryRaw<Array<{ scheduleId: number }>>`
      SELECT scheduleId FROM WasteStagedSchedule WHERE scheduleId = ${staged.id}
    `;
    expect(markers).toEqual([{ scheduleId: staged.id }]);
  });

  it('prepares immutable generations, publishes atomically, breaks missing streak after failed pre-prepare collection, and rolls back pointer only', async () => {
    await cleanupW4Fixtures();
    process.env.WASTE_AREA_DISCOVERY_ENABLED = 'true';

    const first = await prisma.wasteSchedule.create({
      data: {
        city: '서울특별시',
        district: '강남구',
        targetRegion: '역삼1동',
        emissionPlace: '집 앞',
        details: { livingWaste: { dayOfWeek: '월' } },
        sourceId: `${PREFIX}-w4-source-1`,
        sourceUrl: 'https://example.test/waste/source-1',
        govCode: '3220000',
      },
    });
    const refs = refsFor(first);
    const preparedFirst = await prepareWasteGeneration({
      baseGenerationId: null,
      references: refs,
      rows: [legacyRow(first)],
      provenance: 'legacy',
      sourceComplete: true,
      dryRun: false,
    });
    expect(preparedFirst.canPublish).toBe(true);
    expect(preparedFirst.generationId).toEqual(expect.any(String));
    w4GenerationIds.push(preparedFirst.generationId!);

    await publishWasteGeneration(preparedFirst.generationId!, null, preparedFirst.reportHash);
    await expectActiveGeneration(preparedFirst.generationId!);

    await prisma.syncHistory.create({
      data: {
        category: 'waste_schedule',
        status: 'failed',
        errorMessage: 'fixture fetch failed before prepare',
        completedAt: new Date(),
      },
    });

    const second = await prisma.wasteSchedule.create({
      data: {
        city: '서울특별시',
        district: '강남구',
        targetRegion: '역삼1동',
        emissionPlace: '공동 수거장',
        details: { livingWaste: { dayOfWeek: '화' } },
        sourceId: `${PREFIX}-w4-source-2`,
        sourceUrl: 'https://example.test/waste/source-2',
        govCode: '3220000',
      },
    });
    refs.sourceAreaKinds[buildWasteSourceScope(second)] =
      refs.sourceAreaKinds[buildWasteSourceScope(first)];
    const preparedSecond = await prepareWasteGeneration({
      baseGenerationId: preparedFirst.generationId,
      references: refs,
      rows: [legacyRow(second)],
      provenance: 'legacy',
      sourceComplete: true,
      dryRun: false,
    });
    w4GenerationIds.push(preparedSecond.generationId!);
    await publishWasteGeneration(
      preparedSecond.generationId!,
      preparedFirst.generationId,
      preparedSecond.reportHash
    );
    await expectActiveGeneration(preparedSecond.generationId!);

    const missingAfterFailure = await prisma.wasteScheduleRevision.findUniqueOrThrow({
      where: {
        generationId_scheduleId: {
          generationId: preparedSecond.generationId!,
          scheduleId: first.id,
        },
      },
    });
    expect(missingAfterFailure.missingCompleteRuns).toBe(1);
    expect(missingAfterFailure.state).toBe('active');

    const preparedThird = await prepareWasteGeneration({
      baseGenerationId: preparedSecond.generationId,
      references: refs,
      rows: [legacyRow(second)],
      provenance: 'legacy',
      sourceComplete: true,
      dryRun: false,
    });
    w4GenerationIds.push(preparedThird.generationId!);
    await publishWasteGeneration(
      preparedThird.generationId!,
      preparedSecond.generationId,
      preparedThird.reportHash
    );
    await expectActiveGeneration(preparedThird.generationId!);

    const inactiveAfterTwoCompleteRuns = await prisma.wasteScheduleRevision.findUniqueOrThrow({
      where: {
        generationId_scheduleId: {
          generationId: preparedThird.generationId!,
          scheduleId: first.id,
        },
      },
    });
    expect(inactiveAfterTwoCompleteRuns.missingCompleteRuns).toBe(2);
    expect(inactiveAfterTwoCompleteRuns.state).toBe('inactive');

    await rollbackWasteGeneration(preparedThird.generationId!, preparedSecond.generationId!);
    await expectActiveGeneration(preparedSecond.generationId!);
    await expect(
      prisma.wasteScheduleRevision.findUnique({
        where: {
          generationId_scheduleId: {
            generationId: preparedThird.generationId!,
            scheduleId: first.id,
          },
        },
      })
    ).resolves.toMatchObject({ state: 'inactive' });
  });

  it('prepares trash candidates through sync:facilities --only trash without publishing', async () => {
    await cleanupW4Fixtures();
    const previousFlag = process.env.WASTE_AREA_DISCOVERY_ENABLED;
    process.env.WASTE_AREA_DISCOVERY_ENABLED = 'true';
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'ilsangkit-waste-a2-'));
    const sourceId = `${PREFIX}-w4-syncall-source`;
    const previousPublication = await prisma.wastePublication.findUnique({ where: { id: 1 } });

    const referencePaths = await writeReferenceFixture(tempDir, {
      city: '서울특별시',
      district: '강남구',
      sourceId,
    });
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        response: {
          header: { resultCode: '00' },
          body: {
            items: [
              {
                CTPV_NM: '서울특별시',
                SGG_NM: '강남구',
                MNG_ZONE_TRGT_RGN_NM: '역삼1동',
                EMSN_PLC: '집 앞',
                LF_WST_EMSN_DOW: '월,수,금',
                MNG_NO: sourceId,
              },
            ],
            numOfRows: 100,
            pageNo: 1,
            totalCount: 1,
          },
        },
      }),
    } as Response);

    try {
      const { runSyncAll } = await import('../../src/scripts/syncAll.js');
      const result = await runSyncAll({
        argv: ['--only', 'trash'],
        env: {
          OPENAPI_SERVICE_KEY: 'test-key',
          WASTE_REFERENCE_PATH: referencePaths.referencePath,
          WASTE_REFERENCE_MANIFEST_PATH: referencePaths.manifestPath,
          WASTE_REFERENCE_CHECKSUMS_PATH: referencePaths.checksumsPath,
          WASTE_REPORT_OUT: referencePaths.reportOut,
        },
        waitMs: 0,
      });

      expect(result.exitCode).toBe(0);
      expect(result.results[0]).toMatchObject({
        category: 'trash',
        success: true,
        count: 1,
        status: 'prepared',
        canPublish: true,
      });
      expect(result.results[0].generationId).toEqual(expect.any(String));
      w4GenerationIds.push(result.results[0].generationId!);
      const report = JSON.parse(await readFile(referencePaths.reportOut, 'utf8')) as {
        reportHash: string;
      };
      expect(report.reportHash).toBe(result.results[0].reportHash);

      const generation = await prisma.wasteGeneration.findUniqueOrThrow({
        where: { id: result.results[0].generationId! },
      });
      expect(generation.status).toBe('ready');
      const publication = await prisma.wastePublication.findUnique({ where: { id: 1 } });
      expect(publication?.activeGenerationId ?? null).toBe(
        previousPublication?.activeGenerationId ?? null
      );
    } finally {
      fetchSpy.mockRestore();
      await rm(tempDir, { recursive: true, force: true });
      if (previousFlag === undefined) {
        delete process.env.WASTE_AREA_DISCOVERY_ENABLED;
      } else {
        process.env.WASTE_AREA_DISCOVERY_ENABLED = previousFlag;
      }
    }
  });

  it('rejects a stale concurrent publisher using the expected-base guard', async () => {
    await cleanupW4Fixtures();
    process.env.WASTE_AREA_DISCOVERY_ENABLED = 'true';

    const schedule = await prisma.wasteSchedule.create({
      data: {
        city: '서울특별시',
        district: '강남구',
        targetRegion: '역삼1동',
        emissionPlace: '집 앞',
        details: { livingWaste: { dayOfWeek: '수' } },
        sourceId: `${PREFIX}-w4-concurrent-source`,
        sourceUrl: 'https://example.test/waste/concurrent',
        govCode: '3220000',
      },
    });
    const refs = refsFor(schedule);
    const preparedA = await prepareWasteGeneration({
      baseGenerationId: null,
      references: refs,
      rows: [legacyRow(schedule)],
      provenance: 'legacy',
      sourceComplete: true,
      dryRun: false,
    });
    const preparedB = await prepareWasteGeneration({
      baseGenerationId: null,
      references: refs,
      rows: [legacyRow(schedule)],
      provenance: 'legacy',
      sourceComplete: true,
      dryRun: false,
    });
    w4GenerationIds.push(preparedA.generationId!, preparedB.generationId!);

    await publishWasteGeneration(preparedA.generationId!, null, preparedA.reportHash);
    await expect(
      publishWasteGeneration(preparedB.generationId!, null, preparedB.reportHash)
    ).rejects.toMatchObject({ statusCode: 409 });
    await expectActiveGeneration(preparedA.generationId!);
  });

  it('uses an existing raw source identity for a new revision without mutating the legacy row or marker', async () => {
    await cleanupW4Fixtures();
    process.env.WASTE_AREA_DISCOVERY_ENABLED = 'true';

    const existing = await prisma.wasteSchedule.create({
      data: {
        city: '서울특별시',
        district: '강남구',
        targetRegion: '기존동',
        emissionPlace: '기존 장소',
        details: { livingWaste: { dayOfWeek: '월' } },
        sourceId: `${PREFIX}-w4-existing-raw`,
        sourceUrl: 'https://example.test/waste/existing',
        govCode: '3220000',
      },
    });
    const incomingRaw = {
      CTPV_NM: '서울특별시',
      SGG_NM: '강남구',
      MNG_ZONE_TRGT_RGN_NM: '역삼1동',
      EMSN_PLC: '새 장소',
      MNG_NO: `${PREFIX}-w4-existing-raw`,
      LF_WST_EMSN_DOW: '화',
    };
    const incoming = transformTrashData(incomingRaw)!;

    const preparedRows = await reserveRawWasteSchedules([incoming], [incomingRaw]);

    expect(preparedRows[0]).toMatchObject({ scheduleId: existing.id, emissionPlace: '새 장소' });
    await expect(
      prisma.wasteSchedule.findUniqueOrThrow({ where: { id: existing.id } })
    ).resolves.toMatchObject({ targetRegion: '기존동', emissionPlace: '기존 장소' });
    const markers = await prisma.$queryRaw<Array<{ scheduleId: number }>>`
      SELECT scheduleId FROM WasteStagedSchedule WHERE scheduleId = ${existing.id}
    `;
    expect(markers).toEqual([]);
  });

  it('keeps the old publication pointer when staging fails after creating a generation shell', async () => {
    await cleanupW4Fixtures();
    process.env.WASTE_AREA_DISCOVERY_ENABLED = 'true';

    const schedule = await prisma.wasteSchedule.create({
      data: {
        city: '서울특별시',
        district: '강남구',
        targetRegion: '역삼1동',
        emissionPlace: '집 앞',
        details: { livingWaste: { dayOfWeek: '목' } },
        sourceId: `${PREFIX}-w4-pointer-safe`,
        sourceUrl: 'https://example.test/waste/pointer-safe',
        govCode: '3220000',
      },
    });
    const refs = refsFor(schedule);
    const published = await prepareWasteGeneration({
      baseGenerationId: null,
      references: refs,
      rows: [legacyRow(schedule)],
      provenance: 'legacy',
      sourceComplete: true,
      dryRun: false,
    });
    w4GenerationIds.push(published.generationId!);
    await publishWasteGeneration(published.generationId!, null, published.reportHash);

    const brokenRefs: ReferenceBundle = {
      ...refs,
      areas: [{ ...refs.areas[0], name: 'x'.repeat(150) }],
      relations: [],
    };
    await expect(
      prepareWasteGeneration({
        baseGenerationId: published.generationId,
        references: brokenRefs,
        rows: [legacyRow(schedule)],
        provenance: 'legacy',
        sourceComplete: true,
        dryRun: false,
      })
    ).rejects.toThrow();

    await expectActiveGeneration(published.generationId!);
  });

  it('allows only one true concurrent first publisher to switch the singleton pointer', async () => {
    await cleanupW4Fixtures();
    process.env.WASTE_AREA_DISCOVERY_ENABLED = 'true';

    const schedule = await prisma.wasteSchedule.create({
      data: {
        city: '서울특별시',
        district: '강남구',
        targetRegion: '역삼1동',
        emissionPlace: '집 앞',
        details: { livingWaste: { dayOfWeek: '금' } },
        sourceId: `${PREFIX}-w4-first-publisher`,
        sourceUrl: 'https://example.test/waste/first-publisher',
        govCode: '3220000',
      },
    });
    const refs = refsFor(schedule);
    const preparedA = await prepareWasteGeneration({
      baseGenerationId: null,
      references: refs,
      rows: [legacyRow(schedule)],
      provenance: 'legacy',
      sourceComplete: true,
      dryRun: false,
    });
    const preparedB = await prepareWasteGeneration({
      baseGenerationId: null,
      references: refs,
      rows: [legacyRow(schedule)],
      provenance: 'legacy',
      sourceComplete: true,
      dryRun: false,
    });
    w4GenerationIds.push(preparedA.generationId!, preparedB.generationId!);

    const results = await Promise.allSettled([
      publishWasteGeneration(preparedA.generationId!, null, preparedA.reportHash),
      publishWasteGeneration(preparedB.generationId!, null, preparedB.reportHash),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find((result) => result.status === 'rejected');
    expect(rejected).toMatchObject({
      status: 'rejected',
      reason: expect.objectContaining({ statusCode: 409 }),
    });
    const publication = await prisma.wastePublication.findUniqueOrThrow({ where: { id: 1 } });
    expect([preparedA.generationId, preparedB.generationId]).toContain(
      publication.activeGenerationId
    );
  });

  it('stages a high-cardinality reference bundle in bounded batches', async () => {
    await cleanupW4Fixtures();
    process.env.WASTE_AREA_DISCOVERY_ENABLED = 'true';

    const schedule = await prisma.wasteSchedule.create({
      data: {
        city: '서울특별시',
        district: '강남구',
        targetRegion: '역삼1동',
        emissionPlace: '집 앞',
        details: { livingWaste: { dayOfWeek: '토' } },
        sourceId: `${PREFIX}-w4-large-reference`,
        sourceUrl: 'https://example.test/waste/large-reference',
        govCode: '3220000',
      },
    });
    const baseRefs = refsFor(schedule);
    const largeRefs: ReferenceBundle = {
      ...baseRefs,
      areas: Array.from({ length: 1205 }, (_, index) => ({
        ...baseRefs.areas[0],
        key: `administrative:w4${index.toString().padStart(7, '0')}`,
        code: `w4${index.toString().padStart(7, '0')}`,
        name: `대량동${index}`,
      })),
      relations: [],
    };

    const prepared = await prepareWasteGeneration({
      baseGenerationId: null,
      references: largeRefs,
      rows: [legacyRow(schedule)],
      provenance: 'legacy',
      sourceComplete: true,
      dryRun: false,
    });
    w4GenerationIds.push(prepared.generationId!);

    expect(prepared.canPublish).toBe(true);
    await expect(
      prisma.wasteAreaEntry.count({ where: { generationId: prepared.generationId! } })
    ).resolves.toBe(1205);
  });
});

describe('waste area public API live MySQL integration', () => {
  beforeAll(async () => {
    process.env.WASTE_AREA_DISCOVERY_ENABLED = 'true';
    await seedW5Fixtures();
  });

  it('returns dong count from the same deduped candidate set while one source covers two dongs', async () => {
    const res = await request(app).get(
      `/api/waste-areas?city=서울&district=${encodeURIComponent(`${W5_PREFIX}구`)}&limit=100`
    );

    expect(res.status).toBe(200);
    expect(res.body.data.generationId).toBe(W5_GENERATION_ID);
    expect(res.body.data.total).toBe(2);
    expect(
      res.body.data.items
        .map((item: { areaId: number }) => item.areaId)
        .sort((a: number, b: number) => a - b)
    ).toEqual([w5AreaA, w5AreaB].sort((a, b) => a - b));
    expect(
      res.body.data.items.find((item: { areaId: number }) => item.areaId === w5AreaA).scheduleCount
    ).toBe(23);
    expect(
      res.body.data.items.find((item: { areaId: number }) => item.areaId === w5AreaA)
        .conditionalCount
    ).toBe(24);
    expect(
      res.body.data.items.find((item: { areaId: number }) => item.areaId === w5AreaB).scheduleCount
    ).toBe(2);
    expect(
      res.body.data.items.find((item: { areaId: number }) => item.areaId === w5AreaB)
        .conditionalCount
    ).toBe(2);
    expect(
      res.body.data.items.find((item: { areaId: number }) => item.areaId === w5AreaB).dataDate
    ).toBe('2026-09-28T00:00:00.000Z');
  });

  it('uses waste area dong totals for the facility regional all aggregate', async () => {
    const res = await request(app)
      .get(`/api/facilities/region/서울특별시/${encodeURIComponent(`${W5_PREFIX}구`)}`)
      .query({ limit: 100 });

    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(2);
    expect(
      res.body.data.items.map(
        (item: { id: string; category: string; destination?: { href: string } }) => ({
          id: item.id,
          category: item.category,
          href: item.destination?.href,
        })
      )
    ).toEqual([
      { id: String(w5AreaA), category: 'trash', href: `/trash/areas/${w5AreaA}` },
      { id: String(w5AreaB), category: 'trash', href: `/trash/areas/${w5AreaB}` },
    ]);
  });

  it('keeps legacy source totals for the facility regional all aggregate when the flag is disabled', async () => {
    delete process.env.WASTE_AREA_DISCOVERY_ENABLED;
    try {
      const legacySourceCount = await prisma.wasteSchedule.count({
        where: { city: '서울특별시', district: `${W5_PREFIX}구` },
      });
      const res = await request(app)
        .get(`/api/facilities/region/서울특별시/${encodeURIComponent(`${W5_PREFIX}구`)}`)
        .query({ limit: 100 });

      expect(res.status).toBe(200);
      expect(res.body.data.total).toBe(legacySourceCount);
      expect(res.body.data.total).toBeGreaterThan(2);
      expect(res.body.data.items[0].category).toBe('trash');
      expect(res.body.data.items[0].destination).toBeUndefined();
    } finally {
      process.env.WASTE_AREA_DISCOVERY_ENABLED = 'true';
    }
  });

  it('keeps unpublished raw candidates hidden while published rows stay readable and retries reuse source identity', async () => {
    const stagedSource = `${W5_PREFIX}-staged-retry`;
    const staged = await prisma.wasteSchedule.create({
      data: {
        city: '서울특별시',
        district: `${W5_PREFIX}구`,
        targetRegion: `${W5_PREFIX}후보동`,
        emissionPlace: '후보 장소',
        details: { livingWaste: { dayOfWeek: '금' } },
        sourceId: stagedSource,
        sourceUrl: 'https://example.test/w5/staged-retry',
        govCode: '3220000',
      },
    });
    await prisma.wasteStagedSchedule.create({ data: { scheduleId: staged.id } });

    await prisma.wastePublication.update({ where: { id: 1 }, data: { activeGenerationId: null } });
    delete process.env.WASTE_AREA_DISCOVERY_ENABLED;
    try {
      clearStatsCache();
      statsByCityCache.clear();

      const visibleLegacySourceCount = await prisma.wasteSchedule.count({
        where: { city: '서울특별시', district: `${W5_PREFIX}구`, stagedMarker: null },
      });
      await expect(
        prisma.wasteSchedule.count({
          where: { city: '서울특별시', district: `${W5_PREFIX}구` },
        })
      ).resolves.toBe(visibleLegacySourceCount + 1);

      const legacyList = await request(app)
        .get('/api/waste-schedules')
        .query({
          city: '서울특별시',
          district: `${W5_PREFIX}구`,
          keyword: `${W5_PREFIX}후보동`,
          limit: 100,
        });
      const legacyDetail = await request(app).get(`/api/waste-schedules/${staged.id}`);
      const facilitySearch = await request(app)
        .post('/api/facilities/search')
        .send({
          category: 'trash',
          keyword: `${W5_PREFIX}후보동`,
          city: '서울특별시',
          district: `${W5_PREFIX}구`,
          page: 1,
          limit: 100,
        });
      const facilityBrowse = await request(app)
        .get('/api/facilities/browse')
        .query({
          category: 'trash',
          city: 'seoul',
          district: W5_PREFIX,
          keyword: `${W5_PREFIX}후보동`,
          page: 1,
          limit: 20,
        });
      const regionTrash = await request(app)
        .get(`/api/facilities/region/서울특별시/${encodeURIComponent(`${W5_PREFIX}구`)}/trash`)
        .query({ limit: 100 });
      const regionAll = await request(app)
        .get(`/api/facilities/region/서울특별시/${encodeURIComponent(`${W5_PREFIX}구`)}`)
        .query({ limit: 100 });
      const metaStats = await request(app).get('/api/meta/stats');
      const cityStats = await request(app).get('/api/meta/stats/seoul');
      const visibleGlobalTrashCount = await prisma.wasteSchedule.count({
        where: { stagedMarker: null },
      });
      const visibleSeoulTrashCount = await prisma.wasteSchedule.count({
        where: { city: { in: ['서울특별시', '서울'] }, stagedMarker: null },
      });

      expect(legacyList.status).toBe(200);
      expect(legacyList.body.data.items.map((item: { id: number }) => item.id)).not.toContain(
        staged.id
      );
      expect(legacyDetail.status).toBe(404);
      expect(facilitySearch.status).toBe(200);
      expect(facilitySearch.body.data.total).toBe(0);
      expect(facilityBrowse.status).toBe(200);
      expect(facilityBrowse.body.data.total).toBe(0);
      expect(regionTrash.status).toBe(200);
      expect(regionTrash.body.data.total).toBe(visibleLegacySourceCount);
      expect(regionTrash.body.data.items.map((item: { id: string }) => item.id)).not.toContain(
        String(staged.id)
      );
      expect(regionAll.status).toBe(200);
      expect(regionAll.body.data.total).toBe(visibleLegacySourceCount);
      expect(regionAll.body.data.items.map((item: { id: string }) => item.id)).not.toContain(
        String(staged.id)
      );
      expect(metaStats.status).toBe(200);
      expect(metaStats.body.data.trash).toBe(visibleGlobalTrashCount);
      expect(cityStats.status).toBe(200);
      expect(cityStats.body.data.categories.trash).toBe(visibleSeoulTrashCount);
    } finally {
      process.env.WASTE_AREA_DISCOVERY_ENABLED = 'true';
      await prisma.wastePublication.update({
        where: { id: 1 },
        data: { activeGenerationId: W5_GENERATION_ID },
      });
    }

    const publishedDetail = await request(app).get(`/api/waste-schedules/${w5LegacyLiteralId}`);
    expect(publishedDetail.status).toBe(200);
    expect(publishedDetail.body.data.id).toBe(w5LegacyLiteralId);

    const incoming = transformTrashData({
      CTPV_NM: '서울특별시',
      SGG_NM: `${W5_PREFIX}구`,
      MNG_ZONE_TRGT_RGN_NM: `${W5_PREFIX}후보동`,
      EMSN_PLC: '후보 장소 재시도',
      MNG_NO: stagedSource,
    })!;
    const reserved = await reserveRawWasteSchedules(
      [incoming],
      [
        {
          CTPV_NM: '서울특별시',
          SGG_NM: `${W5_PREFIX}구`,
          MNG_ZONE_TRGT_RGN_NM: `${W5_PREFIX}후보동`,
          EMSN_PLC: '후보 장소 재시도',
          MNG_NO: stagedSource,
        },
      ]
    );

    expect(reserved[0].scheduleId).toBe(staged.id);
    await expect(
      prisma.wasteSchedule.count({
        where: { city: '서울특별시', district: `${W5_PREFIX}구`, sourceId: stagedSource },
      })
    ).resolves.toBe(1);
  });

  it('returns every applicable schedule on detail without the list page limit', async () => {
    const res = await request(app).get(`/api/waste-areas/${w5AreaA}`);

    expect(res.status).toBe(200);
    expect(res.body.data.schedules).toHaveLength(24);
    expect(
      new Set(res.body.data.schedules.map((item: { schedule: { id: number } }) => item.schedule.id))
        .size
    ).toBe(23);
  });

  it('serializes applicableAreas from actual source detail and every href target contains the same schedule', async () => {
    const sourceDetail = await request(app).get(
      `/api/waste-schedules/${w5DirectDistrictOverlapScheduleId}`
    );

    expect(sourceDetail.status).toBe(200);
    expect(sourceDetail.body.data.appliesTo).toHaveLength(2);
    expect(
      sourceDetail.body.data.applicableAreas
        .map((area: { areaId: number }) => area.areaId)
        .sort((a: number, b: number) => a - b)
    ).toEqual([w5AreaA, w5AreaB].sort((a, b) => a - b));
    expect(
      sourceDetail.body.data.applicableAreas.every((area: { href: string }) =>
        area.href.startsWith('/trash/areas/')
      )
    ).toBe(true);

    for (const area of sourceDetail.body.data.applicableAreas as Array<{
      areaId: number;
      href: string;
    }>) {
      const areaDetail = await request(app).get(
        area.href.replace('/trash/areas/', '/api/waste-areas/')
      );
      expect(areaDetail.status).toBe(200);
      expect(
        areaDetail.body.data.schedules.map((item: { schedule: { id: number } }) => item.schedule.id)
      ).toContain(w5DirectDistrictOverlapScheduleId);
    }

    const [areaDetail, multiConditionDetail, legalOnlyDetail, expiredConflictDetail] =
      await Promise.all([
        request(app).get(`/api/waste-areas/${w5AreaA}`),
        request(app).get(`/api/waste-schedules/${w5MultiConditionScheduleId}`),
        request(app).get(`/api/waste-schedules/${w5LegalOnlyScheduleId}`),
        request(app).get(`/api/waste-schedules/${w5ExpiredConflictScheduleId}`),
      ]);
    expect(areaDetail.status).toBe(200);
    expect(areaDetail.body.data.predecessorOrSuccessorLinks).toEqual([
      { name: `${W5_PREFIX}2동`, href: `/trash/areas/${w5AreaB}` },
    ]);
    expect(multiConditionDetail.status).toBe(200);
    expect(legalOnlyDetail.status).toBe(200);
    expect(expiredConflictDetail.status).toBe(200);
    expect(multiConditionDetail.body.data.applicableAreas).toContainEqual(
      expect.objectContaining({
        areaId: w5AreaA,
        scope: 'conditional',
        conditionText: `${W5_PREFIX} 조건 A\n${W5_PREFIX} 조건 B`,
      })
    );
    expect(legalOnlyDetail.body.data.applicableAreas).toEqual([]);
    expect(legalOnlyDetail.body.data.appliesTo).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          areaId: w5AreaLegal,
          conditionText: `${W5_PREFIX} 법정 관계 제외`,
          state: 'verified',
        }),
      ])
    );
    expect(expiredConflictDetail.body.data.applicableAreas).toEqual([]);
    expect(expiredConflictDetail.body.data.appliesTo).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          areaId: w5AreaExpired,
          conditionText: `${W5_PREFIX} 만료 제외`,
          state: 'verified',
        }),
        expect.objectContaining({
          areaId: w5AreaA,
          conditionText: `${W5_PREFIX} conflict 제외`,
          state: 'conflict',
        }),
      ])
    );

    const contract = normalizeWasteAreaApiContract({
      areaList: (
        await request(app).get(
          `/api/waste-areas?city=서울특별시&district=${encodeURIComponent(`${W5_PREFIX}구`)}&limit=2`
        )
      ).body,
      areaDetail: areaDetail.body,
      sourceDetail: sourceDetail.body,
      sourceDetailMultiCondition: multiConditionDetail.body,
      sourceDetailLegal: legalOnlyDetail.body,
      sourceDetailEmptyAreas: expiredConflictDetail.body,
      sourceList: (
        await request(app)
          .get('/api/waste-schedules')
          .query({
            city: '서울특별시',
            district: `${W5_PREFIX}구`,
            coverage: 'unresolved',
            limit: 1,
          })
      ).body,
    });
    const fixturePath = path.resolve(
      process.cwd(),
      '__tests__/fixtures/waste-area-api-contract.json'
    );
    if (process.env.UPDATE_WASTE_AREA_CONTRACT === '1') {
      await writeFile(fixturePath, `${JSON.stringify(contract, null, 2)}\n`, 'utf8');
    }
    await expect(JSON.parse(await readFile(fixturePath, 'utf8'))).toEqual(contract);
  });

  it('searches relation aliases and treats wildcard characters literally', async () => {
    const wildcard = await request(app)
      .get('/api/waste-areas')
      .query({ keyword: '%_', limit: 100 });

    expect(wildcard.status).toBe(200);
    expect(wildcard.body.data.items.map((item: { areaId: number }) => item.areaId)).toEqual([
      w5AreaB,
    ]);
    expect(wildcard.body.data.items[0].href).toBe(`/trash/areas/${w5AreaB}`);
  });

  it('treats source keyword wildcards literally in published and legacy fallback readers', async () => {
    const published = await request(app)
      .get('/api/waste-schedules')
      .query({
        city: '서울특별시',
        district: `${W5_PREFIX}구`,
        keyword: `%_\\${W5_PREFIX}`,
        limit: 100,
      });

    await prisma.wastePublication.update({ where: { id: 1 }, data: { activeGenerationId: null } });
    const legacy = await request(app)
      .get('/api/waste-schedules')
      .query({
        city: '서울특별시',
        district: `${W5_PREFIX}구`,
        keyword: `%_\\${W5_PREFIX}`,
        limit: 100,
      });
    await prisma.wastePublication.update({
      where: { id: 1 },
      data: { activeGenerationId: W5_GENERATION_ID },
    });

    expect(published.status).toBe(200);
    expect(published.body.data.items.map((item: { id: number }) => item.id)).toEqual([
      w5LegacyLiteralId,
    ]);
    expect(published.body.data.items.map((item: { id: number }) => item.id)).not.toContain(
      w5LegacyWildcardNearMissId
    );
    expect(legacy.status).toBe(200);
    expect(legacy.body.data.items.map((item: { id: number }) => item.id)).toEqual([
      w5LegacyLiteralId,
    ]);
    expect(legacy.body.data.items.map((item: { id: number }) => item.id)).not.toContain(
      w5LegacyWildcardNearMissId
    );
  });

  it('filters expired dong entries and expired relation aliases from public area reads', async () => {
    const list = await request(app)
      .get('/api/waste-areas')
      .query({
        city: '서울특별시',
        district: `${W5_PREFIX}구`,
        limit: 100,
      });
    const expiredAlias = await request(app)
      .get('/api/waste-areas')
      .query({
        keyword: `만료별칭-${W5_PREFIX}`,
        limit: 100,
      });

    expect(list.status).toBe(200);
    expect(list.body.data.items.map((item: { areaId: number }) => item.areaId)).not.toContain(
      w5AreaExpired
    );
    expect(expiredAlias.status).toBe(200);
    expect(expiredAlias.body.data.items).toEqual([]);
  });

  it('keeps unresolved source rows out of area totals but exposes matching source count', async () => {
    const areas = await request(app).get(
      `/api/waste-areas?city=서울특별시&district=${encodeURIComponent(`${W5_PREFIX}구`)}`
    );
    const unresolvedHref = areas.body.data.unresolved.href;
    const sources = await request(app).get(
      unresolvedHref.replace('/trash', '/api/waste-schedules')
    );

    expect(areas.status).toBe(200);
    expect(areas.body.data.unresolved.count).toBe(1);
    expect(unresolvedHref).toContain('/trash?');
    expect(sources.status).toBe(200);
    expect(sources.body.data.total).toBe(1);
    expect(sources.body.data.items[0].appliesTo[0].state).toBe('unresolved');
  });

  it('returns known empty area detail as 200 noindex data and unknown area as 404', async () => {
    const empty = await request(app).get(`/api/waste-areas/${w5AreaEmpty}`);
    const unknown = await request(app).get('/api/waste-areas/2147483647');

    expect(empty.status).toBe(200);
    expect(empty.body.data.schedules).toEqual([]);
    expect(empty.body.data.indexEligible).toBe(false);
    expect(empty.body.data.indexReason).toBe('no active schedules');
    expect(unknown.status).toBe(404);
  });

  it('returns 410 for formerly public administrative-dong details that are expired or removed from the active generation', async () => {
    const expired = await request(app).get(`/api/waste-areas/${w5AreaExpired}`);
    const removed = await request(app).get(`/api/waste-areas/${w5AreaRemoved}`);

    expect(expired.status).toBe(410);
    expect(removed.status).toBe(410);
  });

  it('returns 404 for internal legal, district, and unpublished staged area references', async () => {
    const legal = await request(app).get(`/api/waste-areas/${w5AreaLegal}`);
    const district = await request(app).get(`/api/waste-areas/${w5AreaDistrict}`);
    const readyOnly = await request(app).get(`/api/waste-areas/${w5AreaReadyOnly}`);
    const failedOnly = await request(app).get(`/api/waste-areas/${w5AreaFailedOnly}`);

    expect(legal.status).toBe(404);
    expect(district.status).toBe(404);
    expect(readyOnly.status).toBe(404);
    expect(failedOnly.status).toBe(404);
  });

  it('returns 410 for inactive published source detail', async () => {
    const res = await request(app).get(`/api/waste-schedules/${w5InactiveScheduleId}`);

    expect(res.status).toBe(410);
  });
});

async function cleanupW4Fixtures() {
  if (w4GenerationIds.length > 0) {
    await prisma.wastePublication.updateMany({
      where: { activeGenerationId: { in: w4GenerationIds } },
      data: { activeGenerationId: null },
    });
    await prisma.wasteScheduleCoverage.deleteMany({
      where: { generationId: { in: w4GenerationIds } },
    });
    await prisma.wasteScheduleRevision.deleteMany({
      where: { generationId: { in: w4GenerationIds } },
    });
    await prisma.wasteAreaRelation.deleteMany({ where: { generationId: { in: w4GenerationIds } } });
    await prisma.wasteAreaEntry.deleteMany({ where: { generationId: { in: w4GenerationIds } } });
    await prisma.wasteGeneration.deleteMany({ where: { id: { in: w4GenerationIds } } });
    w4GenerationIds.length = 0;
  }
  await prisma.syncHistory.deleteMany({
    where: {
      category: 'waste_schedule',
      errorMessage: 'fixture fetch failed before prepare',
    },
  });
  await deleteIfExists(
    'WasteStagedSchedule',
    `scheduleId IN (SELECT id FROM WasteSchedule WHERE sourceId LIKE '${PREFIX}-w4-%')`
  );
  await prisma.wasteSchedule.deleteMany({ where: { sourceId: { startsWith: `${PREFIX}-w4-` } } });
}

async function seedW5Fixtures() {
  await cleanupW5Fixtures();
  previousW5ActiveGeneration =
    (await prisma.wastePublication.findUnique({ where: { id: 1 } }))?.activeGenerationId ?? null;

  await prisma.wasteGeneration.createMany({
    data: [
      {
        id: W5_GENERATION_ID,
        status: 'published',
        referenceVersion: `reference-${W5_PREFIX}`,
        inputHash: W5_INPUT_HASH,
        reportHash: W5_REPORT_HASH,
        sourceComplete: true,
        publishedAt: new Date('2026-09-28T00:00:00Z'),
      },
      {
        id: W5_REMOVED_GENERATION_ID,
        status: 'published',
        referenceVersion: `reference-${W5_PREFIX}-removed`,
        inputHash: 'a'.repeat(64),
        reportHash: 'b'.repeat(64),
        sourceComplete: true,
        publishedAt: new Date('2026-09-20T00:00:00Z'),
      },
      {
        id: W5_READY_GENERATION_ID,
        status: 'ready',
        referenceVersion: `reference-${W5_PREFIX}-ready`,
        inputHash: 'c'.repeat(64),
        reportHash: 'd'.repeat(64),
        sourceComplete: true,
        publishedAt: null,
      },
      {
        id: W5_FAILED_GENERATION_ID,
        status: 'failed',
        referenceVersion: `reference-${W5_PREFIX}-failed`,
        inputHash: 'e'.repeat(64),
        reportHash: 'f'.repeat(64),
        sourceComplete: true,
        publishedAt: null,
      },
    ],
  });

  await prisma.wasteArea.createMany({
    data: [
      { kind: 'administrative', code: `${W5_PREFIX}-a` },
      { kind: 'administrative', code: `${W5_PREFIX}-b` },
      { kind: 'administrative', code: `${W5_PREFIX}-empty` },
      { kind: 'administrative', code: `${W5_PREFIX}-expired` },
      { kind: 'legal', code: `${W5_PREFIX}-legal` },
      { kind: 'administrative', code: `${W5_PREFIX}-dist` },
      { kind: 'administrative', code: `${W5_PREFIX}-removed` },
      { kind: 'administrative', code: `${W5_PREFIX}-ready` },
      { kind: 'administrative', code: `${W5_PREFIX}-fail` },
    ],
    skipDuplicates: true,
  });
  const w5AreaCodes = [
    `${W5_PREFIX}-a`,
    `${W5_PREFIX}-b`,
    `${W5_PREFIX}-empty`,
    `${W5_PREFIX}-expired`,
    `${W5_PREFIX}-legal`,
    `${W5_PREFIX}-dist`,
    `${W5_PREFIX}-removed`,
    `${W5_PREFIX}-ready`,
    `${W5_PREFIX}-fail`,
  ];
  const areas = await prisma.wasteArea.findMany({
    where: { code: { in: w5AreaCodes } },
  });
  w5AreaA = areas.find((area) => area.code === `${W5_PREFIX}-a`)!.id;
  w5AreaB = areas.find((area) => area.code === `${W5_PREFIX}-b`)!.id;
  w5AreaEmpty = areas.find((area) => area.code === `${W5_PREFIX}-empty`)!.id;
  w5AreaExpired = areas.find((area) => area.code === `${W5_PREFIX}-expired`)!.id;
  w5AreaLegal = areas.find((area) => area.code === `${W5_PREFIX}-legal`)!.id;
  w5AreaDistrict = areas.find((area) => area.code === `${W5_PREFIX}-dist`)!.id;
  w5AreaRemoved = areas.find((area) => area.code === `${W5_PREFIX}-removed`)!.id;
  w5AreaReadyOnly = areas.find((area) => area.code === `${W5_PREFIX}-ready`)!.id;
  w5AreaFailedOnly = areas.find((area) => area.code === `${W5_PREFIX}-fail`)!.id;

  await prisma.wasteAreaEntry.createMany({
    data: [
      w5Entry(w5AreaA, `${W5_PREFIX}1동`, 'dong'),
      w5Entry(w5AreaB, `${W5_PREFIX}2동`, 'dong'),
      { ...w5Entry(w5AreaEmpty, `${W5_PREFIX}빈동`, 'dong'), districtCode: '99999' },
      {
        ...w5Entry(w5AreaExpired, `${W5_PREFIX}만료동`, 'dong'),
        validTo: new Date('2020-01-01T00:00:00Z'),
      },
      w5Entry(w5AreaLegal, `${W5_PREFIX}법정동`, 'dong'),
      w5Entry(w5AreaDistrict, `${W5_PREFIX}구`, 'district'),
      {
        ...w5Entry(w5AreaRemoved, `${W5_PREFIX}삭제동`, 'dong'),
        generationId: W5_REMOVED_GENERATION_ID,
      },
      {
        ...w5Entry(w5AreaReadyOnly, `${W5_PREFIX}준비동`, 'dong'),
        generationId: W5_READY_GENERATION_ID,
      },
      {
        ...w5Entry(w5AreaFailedOnly, `${W5_PREFIX}실패동`, 'dong'),
        generationId: W5_FAILED_GENERATION_ID,
      },
    ],
  });
  await prisma.region.upsert({
    where: { city_district: { city: '서울특별시', district: `${W5_PREFIX}구` } },
    update: { slug: W5_PREFIX, bjdCode: W5_REGION_BJD_CODE, lat: 37.5, lng: 127 },
    create: {
      city: '서울특별시',
      district: `${W5_PREFIX}구`,
      slug: W5_PREFIX,
      bjdCode: W5_REGION_BJD_CODE,
      lat: 37.5,
      lng: 127,
    },
  });
  await prisma.wasteAreaRelation.create({
    data: {
      generationId: W5_GENERATION_ID,
      relationKey: `${W5_PREFIX}-alias-relation`,
      fromAreaId: null,
      alias: `%_별칭-${W5_PREFIX}`,
      toAreaId: w5AreaB,
      evidence: W5_EVIDENCE,
      validFrom: new Date('2020-01-01T00:00:00Z'),
    },
  });
  await prisma.wasteAreaRelation.create({
    data: {
      generationId: W5_GENERATION_ID,
      relationKey: `${W5_PREFIX}-expired-alias`,
      fromAreaId: null,
      alias: `만료별칭-${W5_PREFIX}`,
      toAreaId: w5AreaA,
      evidence: W5_EVIDENCE,
      validFrom: new Date('2010-01-01T00:00:00Z'),
      validTo: new Date('2020-01-01T00:00:00Z'),
    },
  });

  await prisma.wasteAreaRelation.create({
    data: {
      generationId: W5_GENERATION_ID,
      relationKey: `${W5_PREFIX}-predecessor-successor`,
      fromAreaId: w5AreaA,
      alias: null,
      toAreaId: w5AreaB,
      evidence: W5_EVIDENCE,
      validFrom: new Date('2020-01-01T00:00:00Z'),
    },
  });

  const primary = await createW5Schedule('shared', `${W5_PREFIX}1동+${W5_PREFIX}2동`);
  const directDistrictOverlap = await createW5Schedule('direct-district-overlap', `${W5_PREFIX}구`);
  w5PrimaryScheduleId = primary.id;
  w5DirectDistrictOverlapScheduleId = directDistrictOverlap.id;
  const multiCondition = await createW5Schedule('multi-condition', `${W5_PREFIX}조건동`);
  const legalOnly = await createW5Schedule('legal-only', `${W5_PREFIX}법정동`);
  const expiredConflict = await createW5Schedule('expired-conflict', `${W5_PREFIX}만료충돌동`);
  w5MultiConditionScheduleId = multiCondition.id;
  w5LegalOnlyScheduleId = legalOnly.id;
  w5ExpiredConflictScheduleId = expiredConflict.id;
  const seedCovered = await createW5Schedule('seed-covered', `${W5_PREFIX}1동`);
  await prisma.wasteSchedule.update({
    where: { id: seedCovered.id },
    data: { sourceId: `seed-${W5_PREFIX}-covered` },
  });
  seedCovered.sourceId = `seed-${W5_PREFIX}-covered`;
  const extra = [];
  for (let index = 0; index < 20; index += 1) {
    extra.push(await createW5Schedule(`area-a-${index}`, `${W5_PREFIX}1동`));
  }
  const unresolved = await createW5Schedule('unresolved', `불명확 ${W5_PREFIX}`);
  const inactive = await createW5Schedule('inactive', `${W5_PREFIX}종료동`);
  const literal = await createW5Schedule('literal', `문자 %_\\${W5_PREFIX}`);
  const wildcardNearMiss = await createW5Schedule('wildcard-near-miss', `문자 AAA${W5_PREFIX}`);
  w5InactiveScheduleId = inactive.id;
  w5LegacyLiteralId = literal.id;
  w5LegacyWildcardNearMissId = wildcardNearMiss.id;

  const activeSchedules = [
    primary,
    directDistrictOverlap,
    multiCondition,
    legalOnly,
    expiredConflict,
    seedCovered,
    ...extra,
    unresolved,
    literal,
    wildcardNearMiss,
  ];
  await prisma.wasteScheduleRevision.createMany({
    data: [
      w5Revision(primary, 'active', { sourceModifiedAt: new Date('2026-02-03T00:00:00Z') }),
      w5Revision(directDistrictOverlap, 'active'),
      w5Revision(multiCondition, 'active'),
      w5Revision(legalOnly, 'active'),
      w5Revision(expiredConflict, 'active'),
      w5Revision(seedCovered, 'active'),
      ...extra.map((schedule) => w5Revision(schedule, 'active')),
      w5Revision(unresolved, 'active'),
      w5Revision(literal, 'active'),
      w5Revision(wildcardNearMiss, 'active'),
      w5Revision(inactive, 'inactive'),
    ],
  });
  await prisma.wasteScheduleCoverage.createMany({
    data: [
      w5Coverage(primary.id, 'primary-a', w5AreaA, null, 'whole', '', 'verified'),
      w5Coverage(primary.id, 'primary-b', w5AreaB, null, 'whole', '', 'verified'),
      w5Coverage(
        directDistrictOverlap.id,
        'overlap-direct',
        w5AreaA,
        null,
        'whole',
        '',
        'verified'
      ),
      w5Coverage(
        directDistrictOverlap.id,
        'overlap-district',
        null,
        '11680',
        'whole',
        '',
        'verified'
      ),
      w5Coverage(
        multiCondition.id,
        'multi-condition-a',
        w5AreaA,
        null,
        'conditional',
        `${W5_PREFIX} 조건 A`,
        'verified'
      ),
      w5Coverage(
        multiCondition.id,
        'multi-condition-b',
        w5AreaA,
        null,
        'partial',
        `${W5_PREFIX} 조건 B`,
        'verified'
      ),
      w5Coverage(
        legalOnly.id,
        'legal-only',
        w5AreaLegal,
        null,
        'whole',
        `${W5_PREFIX} 법정 관계 제외`,
        'verified'
      ),
      w5Coverage(
        expiredConflict.id,
        'expired-only',
        w5AreaExpired,
        null,
        'whole',
        `${W5_PREFIX} 만료 제외`,
        'verified'
      ),
      w5Coverage(
        expiredConflict.id,
        'conflict-only',
        w5AreaA,
        null,
        'partial',
        `${W5_PREFIX} conflict 제외`,
        'conflict'
      ),
      w5Coverage(
        seedCovered.id,
        'seed-covered',
        w5AreaA,
        null,
        'whole',
        `${W5_PREFIX}1동 seed 제외`,
        'verified'
      ),
      ...extra.map((schedule, index) =>
        w5Coverage(
          schedule.id,
          `extra-${index}`,
          w5AreaA,
          null,
          'conditional',
          `조건 ${index}`,
          'verified'
        )
      ),
      w5Coverage(
        unresolved.id,
        'unresolved',
        null,
        null,
        'partial',
        `불명확 ${W5_PREFIX}`,
        'unresolved'
      ),
      w5Coverage(
        literal.id,
        'literal',
        w5AreaExpired,
        null,
        'whole',
        `문자 %_\\${W5_PREFIX}`,
        'verified'
      ),
      w5Coverage(
        wildcardNearMiss.id,
        'wildcard-near-miss',
        w5AreaExpired,
        null,
        'whole',
        `문자 AAA${W5_PREFIX}`,
        'verified'
      ),
    ],
  });

  expect(activeSchedules).toHaveLength(29);
  await prisma.wastePublication.upsert({
    where: { id: 1 },
    update: { activeGenerationId: W5_GENERATION_ID },
    create: { id: 1, activeGenerationId: W5_GENERATION_ID },
  });
}

async function cleanupW5Fixtures() {
  await prisma.wastePublication.updateMany({
    where: { activeGenerationId: W5_GENERATION_ID },
    data: { activeGenerationId: previousW5ActiveGeneration },
  });
  await prisma.wasteScheduleCoverage.deleteMany({ where: { generationId: W5_GENERATION_ID } });
  await prisma.wasteScheduleRevision.deleteMany({ where: { generationId: W5_GENERATION_ID } });
  await prisma.wasteAreaRelation.deleteMany({ where: { generationId: W5_GENERATION_ID } });
  await prisma.wasteAreaEntry.deleteMany({
    where: {
      generationId: {
        in: [
          W5_GENERATION_ID,
          W5_REMOVED_GENERATION_ID,
          W5_READY_GENERATION_ID,
          W5_FAILED_GENERATION_ID,
        ],
      },
    },
  });
  await prisma.wasteGeneration.deleteMany({
    where: {
      id: {
        in: [
          W5_GENERATION_ID,
          W5_REMOVED_GENERATION_ID,
          W5_READY_GENERATION_ID,
          W5_FAILED_GENERATION_ID,
        ],
      },
    },
  });
  await deleteIfExists(
    'WasteStagedSchedule',
    `scheduleId IN (SELECT id FROM WasteSchedule WHERE sourceId LIKE '%${W5_PREFIX}%')`
  );
  await prisma.wasteSchedule.deleteMany({ where: { sourceId: { contains: W5_PREFIX } } });
  const codes = [
    `${W5_PREFIX}-a`,
    `${W5_PREFIX}-b`,
    `${W5_PREFIX}-empty`,
    `${W5_PREFIX}-expired`,
    `${W5_PREFIX}-legal`,
    `${W5_PREFIX}-dist`,
    `${W5_PREFIX}-removed`,
    `${W5_PREFIX}-ready`,
    `${W5_PREFIX}-fail`,
  ];
  await prisma.wasteArea.deleteMany({ where: { code: { in: codes } } });
  await prisma.region.deleteMany({ where: { city: '서울특별시', district: `${W5_PREFIX}구` } });
}

async function createW5Schedule(suffix: string, targetRegion: string) {
  return prisma.wasteSchedule.create({
    data: {
      city: '서울특별시',
      district: `${W5_PREFIX}구`,
      targetRegion,
      emissionPlace: '집 앞',
      details: { livingWaste: { dayOfWeek: '월' }, lastModified: '2026-09-28' },
      sourceId: `${W5_PREFIX}-${suffix}`,
      sourceUrl: `https://example.test/w5/${suffix}`,
      govCode: '3220000',
    },
  });
}

function w5Entry(areaId: number, name: string, level: 'dong' | 'ri' | 'district') {
  return {
    generationId: W5_GENERATION_ID,
    areaId,
    level,
    city: '서울특별시',
    district: `${W5_PREFIX}구`,
    districtCode: '11680',
    name,
    validFrom: new Date('2020-01-01T00:00:00Z'),
    validTo: null,
    evidence: W5_EVIDENCE,
    indexEligible: false,
    indexReason: 'pending W9 public indexing policy',
    contentFingerprint: W5_FINGERPRINT,
    contentUpdatedAt: new Date('2026-09-28T00:00:00Z'),
  };
}

function w5Revision(
  schedule: Awaited<ReturnType<typeof createW5Schedule>>,
  state: 'active' | 'inactive',
  overrides: Partial<{ sourceModifiedAt: Date | null; contentUpdatedAt: Date }> = {}
) {
  return {
    generationId: W5_GENERATION_ID,
    scheduleId: schedule.id,
    city: schedule.city,
    district: schedule.district,
    sourceId: schedule.sourceId,
    targetRegion: schedule.targetRegion,
    emissionPlace: schedule.emissionPlace,
    details: schedule.details,
    sourceUrl: schedule.sourceUrl,
    govCode: schedule.govCode,
    rawPayload: { fixture: true },
    provenance: 'legacy' as const,
    contentHash: W5_CONTENT_HASH,
    sourceModifiedAt: overrides.sourceModifiedAt ?? null,
    observedAt: new Date('2026-09-28T00:00:00Z'),
    contentUpdatedAt: overrides.contentUpdatedAt ?? new Date('2026-09-28T00:00:00Z'),
    state,
    missingCompleteRuns: state === 'inactive' ? 2 : 0,
    terminationEvidence: state === 'inactive' ? { reason: 'w5 fixture inactive' } : null,
  };
}

function w5Coverage(
  scheduleId: number,
  key: string,
  areaId: number | null,
  districtCode: string | null,
  scope: 'whole' | 'partial' | 'conditional',
  conditionText: string,
  state: 'verified' | 'unresolved' | 'conflict'
) {
  return {
    generationId: W5_GENERATION_ID,
    scheduleId,
    coverageKey: `${W5_PREFIX}-${key}`,
    areaId,
    districtCode,
    scope,
    conditionText,
    state,
    reason: 'w5 fixture',
    evidence: [W5_EVIDENCE],
  };
}

function normalizeWasteAreaApiContract(contract: Record<string, unknown>) {
  const text = JSON.stringify(contract)
    .replaceAll(W5_GENERATION_ID, 'fixture-generation-id')
    .replaceAll(W5_PREFIX, '계약')
    .replaceAll(String(w5AreaA), '101')
    .replaceAll(String(w5AreaB), '102')
    .replaceAll(String(w5AreaEmpty), '103')
    .replaceAll(String(w5AreaExpired), '104')
    .replaceAll(String(w5AreaLegal), '105')
    .replaceAll(String(w5DirectDistrictOverlapScheduleId), '201')
    .replaceAll(String(w5PrimaryScheduleId), '202')
    .replaceAll(String(w5MultiConditionScheduleId), '203')
    .replaceAll(String(w5LegalOnlyScheduleId), '204')
    .replaceAll(String(w5ExpiredConflictScheduleId), '205');
  const parsed = JSON.parse(text);
  normalizeContractScheduleIds(parsed);
  return parsed;
}

function normalizeContractScheduleIds(value: unknown): void {
  if (Array.isArray(value)) {
    for (const item of value) normalizeContractScheduleIds(item);
    return;
  }
  if (!value || typeof value !== 'object') return;
  const record = value as Record<string, unknown>;
  if (typeof record.sourceUrl === 'string' && typeof record.id === 'number') {
    const extra = record.sourceUrl.match(/area-a-(\d+)$/);
    if (extra) record.id = 300 + Number(extra[1]);
    if (record.sourceUrl.endsWith('/unresolved')) record.id = 401;
  }
  for (const child of Object.values(record)) normalizeContractScheduleIds(child);
}

function legacyRow(row: {
  id: number;
  city: string;
  district: string;
  sourceId: string;
  targetRegion: string | null;
  emissionPlace: string | null;
  details: unknown;
  sourceUrl: string | null;
  govCode: string | null;
}) {
  return {
    scheduleId: row.id,
    city: row.city,
    district: row.district,
    sourceId: row.sourceId,
    targetRegion: row.targetRegion,
    emissionPlace: row.emissionPlace,
    details: row.details,
    sourceUrl: row.sourceUrl,
    govCode: row.govCode,
    rawPayload: null,
  };
}

function refsFor(row: { city: string; district: string; sourceId: string }): ReferenceBundle {
  const evidence = {
    url: 'https://example.test/w4-reference',
    version: 'fixture',
    effectiveFrom: '2020-01-01',
    effectiveTo: null,
    note: 'w4 fixture reference',
  };
  return {
    version: `fixture-w4-${PREFIX}`,
    areas: [
      {
        key: 'administrative:1168064000',
        kind: 'administrative',
        level: 'dong',
        code: '1168064000',
        city: '서울특별시',
        district: '강남구',
        districtCode: '11680',
        name: '역삼1동',
        evidence,
      },
    ],
    relations: [],
    sourceAreaKinds: {
      [buildWasteSourceScope(row)]: { kind: 'administrative', evidence },
    },
  };
}

async function writeReferenceFixture(
  tempDir: string,
  row: { city: string; district: string; sourceId: string }
): Promise<{
  referencePath: string;
  manifestPath: string;
  checksumsPath: string;
  reportOut: string;
}> {
  const manifestPath = path.join(tempDir, 'manifest.json');
  const referencePath = path.join(tempDir, 'reference.json');
  const checksumsPath = path.join(tempDir, 'checksums.json');
  const reportOut = path.join(tempDir, 'review-report.json');
  const manifestRaw = `${JSON.stringify({ normalizedContentHash: 'fixture' }, null, 2)}\n`;
  const manifestSha = sha256(manifestRaw);
  await writeFile(manifestPath, manifestRaw, 'utf8');

  const references = refsFor(row);
  references.version = manifestSha;
  for (const area of references.areas) {
    area.evidence.url = 'https://www.data.go.kr/data/15155080/openapi.do';
  }
  for (const source of Object.values(references.sourceAreaKinds)) {
    source.evidence.url = 'https://www.data.go.kr/data/15155080/openapi.do';
  }
  const referenceRaw = `${JSON.stringify(references, null, 2)}\n`;
  await writeFile(referencePath, referenceRaw, 'utf8');

  await writeFile(
    checksumsPath,
    `${JSON.stringify(
      {
        referenceVersion: manifestSha,
        referenceSha256: sha256(referenceRaw),
        versionManifest: path.basename(manifestPath),
      },
      null,
      2
    )}\n`,
    'utf8'
  );

  return { referencePath, manifestPath, checksumsPath, reportOut };
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

async function expectActiveGeneration(generationId: string) {
  const publication = await prisma.wastePublication.findUniqueOrThrow({ where: { id: 1 } });
  expect(publication.activeGenerationId).toBe(generationId);
}
