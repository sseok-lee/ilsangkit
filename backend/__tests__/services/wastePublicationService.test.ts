import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import type { ReferenceBundle } from '../../src/types/wasteArea.js';

const prismaMock = vi.hoisted(() => {
  const tx = {
    $executeRaw: vi.fn(),
    $queryRaw: vi.fn(),
    wasteGeneration: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    wastePublication: {
      create: vi.fn(),
      update: vi.fn(),
    },
  };

  return {
    tx,
    prisma: {
      syncHistory: {
        create: vi.fn(),
        update: vi.fn(),
        findFirst: vi.fn(),
      },
      wasteGeneration: {
        create: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      wastePublication: {
        create: vi.fn(),
        update: vi.fn(),
      },
      wasteSchedule: {
        findMany: vi.fn(),
      },
      wasteArea: {
        createMany: vi.fn(),
        findMany: vi.fn(),
      },
      wasteAreaEntry: {
        createMany: vi.fn(),
      },
      wasteAreaRelation: {
        createMany: vi.fn(),
      },
      wasteScheduleRevision: {
        findMany: vi.fn(),
        createMany: vi.fn(),
      },
      wasteScheduleCoverage: {
        createMany: vi.fn(),
      },
      wasteStagedSchedule: {
        createMany: vi.fn(),
      },
      $transaction: vi.fn(async (callback: (tx: typeof tx) => Promise<unknown>) => callback(tx)),
    },
  };
});

vi.mock('../../src/lib/prisma.js', () => ({
  default: prismaMock.prisma,
  prisma: prismaMock.prisma,
}));

const emptyRefs: ReferenceBundle = {
  version: 'test',
  areas: [],
  relations: [],
  sourceAreaKinds: {},
};

function rawMysqlError(code: string): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Raw query failed', {
    code: 'P2010',
    clientVersion: 'test',
    meta: {
      code,
      message: code === '1213'
        ? 'Deadlock found when trying to get lock; try restarting transaction'
        : 'Duplicate entry',
    },
  });
}

describe('wastePublicationService', () => {
  const originalDiscoveryEnabled = process.env.WASTE_AREA_DISCOVERY_ENABLED;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.WASTE_AREA_DISCOVERY_ENABLED = 'true';
    prismaMock.tx.$queryRaw.mockResolvedValue([{ activeGenerationId: null }]);
    prismaMock.tx.wasteGeneration.findUnique.mockResolvedValue({
      id: 'prepared-generation',
      status: 'ready',
      reportHash: 'a'.repeat(64),
    });
    prismaMock.prisma.wasteScheduleRevision.findMany.mockResolvedValue([]);
    prismaMock.prisma.syncHistory.findFirst.mockResolvedValue(null);
  });

  afterEach(() => {
    if (originalDiscoveryEnabled === undefined) {
      delete process.env.WASTE_AREA_DISCOVERY_ENABLED;
    } else {
      process.env.WASTE_AREA_DISCOVERY_ENABLED = originalDiscoveryEnabled;
    }
  });

  it('does not create history or generations during dry-run', async () => {
    delete process.env.WASTE_AREA_DISCOVERY_ENABLED;
    const { prepareWasteGeneration } = await import('../../src/services/wastePublicationService.js');

    const result = await prepareWasteGeneration({
      baseGenerationId: null,
      references: emptyRefs,
      rows: [],
      provenance: 'legacy',
      sourceComplete: true,
      dryRun: true,
    });

    expect(result.generationId).toBeNull();
    expect(result.reviewReport).toMatchObject({ generationId: null, reportHash: result.reportHash, canPublish: false });
    expect(JSON.stringify(result.reviewReport)).not.toContain('rawPayload');
    expect(prismaMock.prisma.syncHistory.create).not.toHaveBeenCalled();
    expect(prismaMock.prisma.wasteGeneration.create).not.toHaveBeenCalled();
  });

  it('preserves all area identities while keeping database lookups within the batch budget', async () => {
    const { prepareWasteGeneration } = await import('../../src/services/wastePublicationService.js');
    const areas: ReferenceBundle['areas'] = Array.from({ length: 1001 }, (_, index) => ({
      key: `administrative:${index + 1}`,
      kind: 'administrative',
      code: String(index + 1),
      level: 'dong',
      city: '서울특별시',
      district: '강남구',
      districtCode: '11680',
      name: `테스트${index + 1}동`,
      evidence: { url: 'https://example.test/ref', version: 'fixture', effectiveFrom: '2020-01-01', effectiveTo: null },
    }));
    prismaMock.prisma.syncHistory.create.mockResolvedValue({ id: 'history' });
    prismaMock.prisma.wasteArea.findMany.mockImplementation(async ({ where }) => {
      if (where.OR.length > 500) throw new Error('Area identity lookup exceeded bounded query budget');
      return where.OR.map((identity: { kind: string; code: string }) => ({
        ...identity, id: Number(identity.code),
      }));
    });

    await prepareWasteGeneration({
      baseGenerationId: null,
      references: { ...emptyRefs, version: 'fixture-bounded', areas },
      rows: [],
      provenance: 'legacy',
      sourceComplete: true,
      dryRun: false,
    });

    const saved = prismaMock.prisma.wasteAreaEntry.createMany.mock.calls.flatMap(([input]) => input.data);
    expect(saved.map((entry: { areaId: number }) => entry.areaId))
      .toEqual(expect.arrayContaining(areas.map((area) => Number(area.code))));
    expect(saved).toHaveLength(areas.length);
  });

  it('persists duplicateOfScheduleId of collapsed revisions into revision createMany data', async () => {
    const { prepareWasteGeneration } = await import('../../src/services/wastePublicationService.js');
    prismaMock.prisma.syncHistory.create.mockResolvedValue({ id: 'history' });
    const makeRow = (scheduleId: number, sourceId: string) => ({
      scheduleId,
      city: '서울특별시',
      district: '강남구',
      sourceId,
      targetRegion: '역삼1동',
      emissionPlace: '집 앞',
      details: { livingWaste: { dayOfWeek: '월' }, dataCreatedDate: '2025-01-01', lastModified: '2025-02-01 00:00:00' },
      sourceUrl: 'https://example.test/source',
      govCode: '3220000',
      rawPayload: null,
    });

    await prepareWasteGeneration({
      baseGenerationId: null,
      references: emptyRefs,
      rows: [makeRow(1, 'dup-a'), makeRow(2, 'dup-b')],
      provenance: 'raw',
      sourceComplete: true,
      dryRun: false,
    });

    const saved = prismaMock.prisma.wasteScheduleRevision.createMany.mock.calls
      .flatMap(([input]) => input.data) as Array<{ scheduleId: number; state: string; duplicateOfScheduleId: number | null }>;
    expect(saved).toHaveLength(2);
    expect(saved.find((r) => r.scheduleId === 1)).toMatchObject({ state: 'duplicate', duplicateOfScheduleId: 2 });
    expect(saved.find((r) => r.scheduleId === 2)).toMatchObject({ state: 'active', duplicateOfScheduleId: null });
  });

  it('blocks persisted prepare writes unless discovery is explicitly enabled', async () => {
    delete process.env.WASTE_AREA_DISCOVERY_ENABLED;
    const { prepareWasteGeneration } = await import('../../src/services/wastePublicationService.js');

    await expect(prepareWasteGeneration({
      baseGenerationId: null,
      references: emptyRefs,
      rows: [],
      provenance: 'legacy',
      sourceComplete: true,
      dryRun: false,
    })).rejects.toMatchObject({ statusCode: 409 });

    expect(prismaMock.prisma.syncHistory.create).not.toHaveBeenCalled();
    expect(prismaMock.prisma.wasteGeneration.create).not.toHaveBeenCalled();
  });

  it('requires caller supplied approval hash before publishing', async () => {
    const { publishWasteGeneration } = await import('../../src/services/wastePublicationService.js');

    await expect(publishWasteGeneration('prepared-generation', null, 'b'.repeat(64)))
      .rejects.toMatchObject({ statusCode: 409 });

    expect(prismaMock.tx.wastePublication.update).not.toHaveBeenCalled();
  });

  it('rejects publication while discovery writes are disabled', async () => {
    delete process.env.WASTE_AREA_DISCOVERY_ENABLED;
    const { publishWasteGeneration } = await import('../../src/services/wastePublicationService.js');

    await expect(publishWasteGeneration('prepared-generation', null, 'a'.repeat(64)))
      .rejects.toMatchObject({ statusCode: 409 });

    expect(prismaMock.tx.wastePublication.update).not.toHaveBeenCalled();
  });

  it('publishes only when the locked singleton still points at the expected base', async () => {
    const { publishWasteGeneration } = await import('../../src/services/wastePublicationService.js');
    prismaMock.tx.$queryRaw.mockResolvedValueOnce([{ activeGenerationId: 'other-generation' }]);

    await expect(publishWasteGeneration('prepared-generation', null, 'a'.repeat(64)))
      .rejects.toMatchObject({ statusCode: 409 });

    expect(prismaMock.tx.wastePublication.update).not.toHaveBeenCalled();
  });

  it('rejects incomplete, already published, or failed generations without moving the pointer', async () => {
    const { publishWasteGeneration } = await import('../../src/services/wastePublicationService.js');
    prismaMock.tx.wasteGeneration.findUnique.mockResolvedValueOnce({
      id: 'prepared-generation',
      status: 'published',
      reportHash: 'a'.repeat(64),
      baseGenerationId: null,
    });

    await expect(publishWasteGeneration('prepared-generation', null, 'a'.repeat(64)))
      .rejects.toMatchObject({ statusCode: 409 });

    expect(prismaMock.tx.wastePublication.update).not.toHaveBeenCalled();
  });

  it('retries a publication deadlock once so the expected-base guard returns the public conflict contract', async () => {
    const { publishWasteGeneration } = await import('../../src/services/wastePublicationService.js');
    prismaMock.prisma.$transaction.mockRejectedValueOnce(rawMysqlError('1213'));
    prismaMock.tx.$queryRaw.mockResolvedValueOnce([{ activeGenerationId: 'winner-generation' }]);

    await expect(publishWasteGeneration('prepared-generation', null, 'a'.repeat(64)))
      .rejects.toMatchObject({ statusCode: 409, code: 'CONFLICT' });

    expect(prismaMock.prisma.$transaction).toHaveBeenCalledTimes(2);
    expect(prismaMock.tx.wastePublication.update).not.toHaveBeenCalled();
  });

  it('passes unrelated raw publication transaction errors through without retrying', async () => {
    const { publishWasteGeneration } = await import('../../src/services/wastePublicationService.js');
    const duplicateError = rawMysqlError('1062');
    prismaMock.prisma.$transaction.mockRejectedValueOnce(duplicateError);

    await expect(publishWasteGeneration('prepared-generation', null, 'a'.repeat(64)))
      .rejects.toBe(duplicateError);

    expect(prismaMock.prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('bounds publication deadlock retry exhaustion and returns a conflict', async () => {
    const { publishWasteGeneration } = await import('../../src/services/wastePublicationService.js');
    prismaMock.prisma.$transaction
      .mockRejectedValueOnce(rawMysqlError('1213'))
      .mockRejectedValueOnce(rawMysqlError('1213'));

    await expect(publishWasteGeneration('prepared-generation', null, 'a'.repeat(64)))
      .rejects.toMatchObject({ statusCode: 409, code: 'CONFLICT' });

    expect(prismaMock.prisma.$transaction).toHaveBeenCalledTimes(2);
  });

  it('rolls back by moving the publication pointer only', async () => {
    const { rollbackWasteGeneration } = await import('../../src/services/wastePublicationService.js');
    prismaMock.tx.$queryRaw.mockResolvedValueOnce([{ activeGenerationId: 'current-generation' }]);
    prismaMock.tx.wasteGeneration.findUnique.mockResolvedValueOnce({
      id: 'previous-generation',
      status: 'published',
      sourceComplete: true,
    });

    await rollbackWasteGeneration('current-generation', 'previous-generation');

    expect(prismaMock.tx.wastePublication.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { activeGenerationId: 'previous-generation' },
    });
    expect(prismaMock.tx.wasteGeneration.update).not.toHaveBeenCalled();
  });

  it('rejects rollback targets that were not previously published complete generations', async () => {
    const { rollbackWasteGeneration } = await import('../../src/services/wastePublicationService.js');
    prismaMock.tx.$queryRaw.mockResolvedValue([{ activeGenerationId: 'current-generation' }]);
    prismaMock.tx.wasteGeneration.findUnique.mockResolvedValueOnce({
      id: 'failed-generation',
      status: 'failed',
      sourceComplete: true,
    });

    await expect(rollbackWasteGeneration('current-generation', 'failed-generation'))
      .rejects.toMatchObject({ statusCode: 409 });

    expect(prismaMock.tx.wastePublication.update).not.toHaveBeenCalled();
  });

  it('creates then locks the singleton publication row in the same transaction', async () => {
    const { publishWasteGeneration } = await import('../../src/services/wastePublicationService.js');
    prismaMock.tx.$queryRaw.mockResolvedValueOnce([{ activeGenerationId: null }]);
    prismaMock.tx.wasteGeneration.findUnique.mockResolvedValueOnce({
      id: 'prepared-generation',
      status: 'ready',
      reportHash: 'a'.repeat(64),
      baseGenerationId: null,
      sourceComplete: true,
    });

    await publishWasteGeneration('prepared-generation', null, 'a'.repeat(64));

    expect(prismaMock.tx.$executeRaw).toHaveBeenCalled();
    expect(prismaMock.tx.$queryRaw).toHaveBeenCalled();
  });

});
