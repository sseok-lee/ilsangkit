import { createHash } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { syncTrashData } from '../../src/scripts/syncTrash.js';

const {
  publicationMock,
  txCreate,
  txMarkerCreate,
  transaction,
  syncHistoryCreate,
} = vi.hoisted(() => ({
  publicationMock: {
    assertWasteAreaDiscoveryWriteEnabled: vi.fn(),
    prepareWasteGeneration: vi.fn(),
    publishWasteGeneration: vi.fn(),
  },
  txCreate: vi.fn(),
  txMarkerCreate: vi.fn(),
  transaction: vi.fn(),
  syncHistoryCreate: vi.fn(),
}));

vi.mock('../../src/services/wastePublicationService.js', () => publicationMock);

vi.mock('../../src/lib/prisma.js', () => {
  const prismaClient = {
    wasteSchedule: {
      create: vi.fn(),
    },
    wasteGeneration: {
      create: vi.fn(),
    },
    syncHistory: {
      create: syncHistoryCreate,
    },
    $transaction: transaction,
  };
  return { default: prismaClient, prisma: prismaClient };
});

const fetchMock = vi.fn();
global.fetch = fetchMock;

const evidence = {
  url: 'https://www.data.go.kr/data/15155080/openapi.do',
  version: 'fixture',
  effectiveFrom: '2020-01-01',
  effectiveTo: null,
  note: 'fixture',
};

describe('syncTrashData preflight', () => {
  let tempRoot: string;

  beforeEach(async () => {
    tempRoot = path.join(tmpdir(), `sync-trash-preflight-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    await mkdir(tempRoot, { recursive: true });
    vi.clearAllMocks();
    process.env.WASTE_AREA_DISCOVERY_ENABLED = 'true';
    transaction.mockImplementation(async (callback) => callback({
      wasteSchedule: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: txCreate.mockResolvedValue({ id: 1 }),
      },
      wasteStagedSchedule: {
        create: txMarkerCreate.mockResolvedValue({}),
      },
    }));
  });

  afterEach(async () => {
    delete process.env.WASTE_AREA_DISCOVERY_ENABLED;
    await rm(tempRoot, { recursive: true, force: true });
  });

  it('rejects checksum mismatches before fetching pages or writing any waste rows', async () => {
    const referenceInput = await writeReferenceFiles(tempRoot, { badReferenceChecksum: true });

    await expect(syncTrashData({
      serviceKey: 'test-key',
      dryRun: false,
      referenceInput,
      reportOut: path.join(tempRoot, 'report.json'),
    })).rejects.toThrow(/checksum/i);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(transaction).not.toHaveBeenCalled();
    expect(txCreate).not.toHaveBeenCalled();
    expect(txMarkerCreate).not.toHaveBeenCalled();
    expect(syncHistoryCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ status: 'failed' }),
    });
  });

  it('rejects an unwritable report destination before fetching pages or writing any waste rows', async () => {
    const referenceInput = await writeReferenceFiles(tempRoot);
    const reportOut = path.join(tempRoot, 'as-directory');
    await mkdir(reportOut);

    await expect(syncTrashData({
      serviceKey: 'test-key',
      dryRun: false,
      referenceInput,
      reportOut,
    })).rejects.toThrow(/report/i);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(transaction).not.toHaveBeenCalled();
    expect(txCreate).not.toHaveBeenCalled();
    expect(txMarkerCreate).not.toHaveBeenCalled();
    expect(syncHistoryCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ status: 'failed' }),
    });
  });
});

async function writeReferenceFiles(
  dir: string,
  options: { badReferenceChecksum?: boolean } = {}
) {
  const manifestRaw = JSON.stringify({ schemaVersion: 1, normalizedContentHash: 'fixture' }, null, 2);
  const manifestSha = sha256(manifestRaw);
  const reference = {
    version: manifestSha,
    areas: [{
      key: 'administrative:1168064000',
      kind: 'administrative',
      level: 'dong',
      code: '1168064000',
      city: '서울특별시',
      district: '강남구',
      districtCode: '11680',
      name: '역삼1동',
      evidence,
    }],
    relations: [],
    sourceAreaKinds: {},
  };
  const referenceRaw = JSON.stringify(reference, null, 2);
  const checksumsRaw = JSON.stringify({
    referenceVersion: manifestSha,
    referenceSha256: options.badReferenceChecksum ? '0'.repeat(64) : sha256(referenceRaw),
    versionManifest: 'manifest.json',
  }, null, 2);
  const referencePath = path.join(dir, 'reference.json');
  const manifestPath = path.join(dir, 'manifest.json');
  const checksumsPath = path.join(dir, 'checksums.json');
  await Promise.all([
    writeFile(referencePath, referenceRaw, 'utf8'),
    writeFile(manifestPath, manifestRaw, 'utf8'),
    writeFile(checksumsPath, checksumsRaw, 'utf8'),
  ]);
  return { referencePath, manifestPath, checksumsPath };
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
