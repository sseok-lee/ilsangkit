import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import type { Application } from 'express';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { assertAffiliateTestDatabase } from './affiliateBannerDatabase.js';

const fsMockState = vi.hoisted(() => ({
  unlinkInterceptor: undefined as undefined | ((filePath: string, actualUnlink: (filePath: string) => Promise<void>) => Promise<void>),
}));

const productPrismaState = vi.hoisted(() => ({
  clients: [] as Array<{ $disconnect: () => Promise<void> }>,
  observedAssetId: '',
  observedLockCount: 0,
  waiters: [] as Array<{ expectedCount: number; resolve: (count: number) => void }>,
}));

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return {
    ...actual,
    unlink: async (filePath: string) => {
      if (fsMockState.unlinkInterceptor) {
        return fsMockState.unlinkInterceptor(String(filePath), actual.unlink);
      }
      return actual.unlink(filePath);
    },
  };
});

process.env.NODE_ENV = 'test';
process.env.CORS_ORIGIN = 'http://localhost:3000';

vi.mock('../../src/services/adminSessionService.js', () => ({
  verifySession: vi.fn(async () => true),
  createSession: vi.fn(),
  revokeSession: vi.fn(),
}));

const AFFILIATE_URL = process.env.AFFILIATE_TEST_DATABASE_URL ?? '';
assertAffiliateTestDatabase(AFFILIATE_URL);

const ORIGIN = 'http://localhost:3000';
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const expiredAt = new Date(Date.now() - ONE_DAY_MS - 60_000);
const execFileAsync = promisify(execFile);
const prisma = new PrismaClient({ datasources: { db: { url: AFFILIATE_URL } } });
const lockPrisma = new PrismaClient({ datasources: { db: { url: AFFILIATE_URL } } });
const fixtureAssetIds = new Set<string>();
const fixtureBannerIds = new Set<string>();
const fixtureStorageKeys = new Map<string, string>();
const triggerNames = new Set<string>();

let uploadRoot: string;
let app: Application;
let pngBytes: Buffer;
let webpBytes: Buffer;
let gifBytes: Buffer;

function deferred<T = void>(): { promise: Promise<T>; resolve: (value: T | PromiseLike<T>) => void; reject: (reason?: unknown) => void } {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

function observeAssetLocks(assetId: string): void {
  productPrismaState.observedAssetId = assetId;
  productPrismaState.observedLockCount = 0;
  productPrismaState.waiters = [];
}

function stopObservingAssetLocks(): void {
  productPrismaState.observedAssetId = '';
  productPrismaState.observedLockCount = 0;
  productPrismaState.waiters = [];
}

function noteAffiliateAssetLock(args: unknown[]): void {
  const first = args[0];
  const sqlObject = first as { strings?: unknown[]; values?: unknown[] };
  const serialized = JSON.stringify(args, (_key, value) => typeof value === 'bigint' ? value.toString() : value);
  const sql = Array.isArray(first)
    ? first.join('?')
    : Array.isArray(sqlObject.strings)
      ? sqlObject.strings.join('?')
      : String(first);
  const lockedId = String(args[1] ?? sqlObject.values?.[0] ?? '');
  if (
    productPrismaState.observedAssetId &&
    (
      (lockedId === productPrismaState.observedAssetId &&
        sql.includes('SELECT id FROM AffiliateBannerAsset') &&
        sql.includes('FOR UPDATE')) ||
      (serialized.includes(productPrismaState.observedAssetId) &&
        serialized.includes('AffiliateBannerAsset') &&
        serialized.includes('FOR UPDATE'))
    )
  ) {
    productPrismaState.observedLockCount += 1;
    const ready = productPrismaState.waiters.filter((waiter) => productPrismaState.observedLockCount >= waiter.expectedCount);
    productPrismaState.waiters = productPrismaState.waiters.filter((waiter) => productPrismaState.observedLockCount < waiter.expectedCount);
    for (const waiter of ready) waiter.resolve(productPrismaState.observedLockCount);
  }
}

function waitForObservedAssetLockCalls(expectedCount: number): Promise<number> {
  if (productPrismaState.observedLockCount >= expectedCount) {
    return Promise.resolve(productPrismaState.observedLockCount);
  }
  return new Promise((resolve) => {
    productPrismaState.waiters.push({ expectedCount, resolve });
  });
}

function wrapTransactionClient<T extends object>(tx: T): T {
  return new Proxy(tx, {
    get(target, property, receiver) {
      if (property === '$queryRaw') {
        return (...args: unknown[]) => {
          noteAffiliateAssetLock(args);
          return Reflect.get(target, property, receiver).apply(target, args);
        };
      }
      const value = Reflect.get(target, property, receiver);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}

function wrapPrismaClient<T extends object>(client: T): T {
  return new Proxy(client, {
    get(target, property, receiver) {
      if (property === '$transaction') {
        return (arg: unknown, options?: unknown) => {
          const transaction = Reflect.get(target, property, receiver);
          if (typeof arg === 'function') {
            return transaction.call(target, (tx: object) => arg(wrapTransactionClient(tx)), options);
          }
          return transaction.call(target, arg, options);
        };
      }
      const value = Reflect.get(target, property, receiver);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}

function mockProductPrisma(): void {
  vi.doMock('../../src/lib/prisma.js', async () => {
    const { PrismaClient: ProductPrismaClient } = await import('@prisma/client');
    const realClient = new ProductPrismaClient({ datasources: { db: { url: AFFILIATE_URL } } });
    const wrappedClient = wrapPrismaClient(realClient) as { $disconnect: () => Promise<void> };
    productPrismaState.clients.push(wrappedClient);
    return {
      default: wrappedClient,
      prisma: wrappedClient,
      validateDatabaseUrl: vi.fn(),
    };
  });
}

async function importApp(): Promise<Application> {
  mockProductPrisma();
  const module = await import('../../src/app.js') as { default: Application };
  return module.default;
}

async function importRestartedApp(): Promise<Application> {
  vi.resetModules();
  return importApp();
}

function uuid(): string {
  return crypto.randomUUID();
}

function storageKeyFor(id: string, extension = 'png'): string {
  return `affiliate-banners/${id}.${extension}`;
}

function trackAsset(id: string, storageKey = storageKeyFor(id)): void {
  fixtureAssetIds.add(id);
  fixtureStorageKeys.set(id, storageKey);
}

function trackBanner(id: string): void {
  fixtureBannerIds.add(id);
}

function imagePath(storageKey: string): string {
  return path.join(uploadRoot, storageKey);
}

async function retryCleanup(work: () => Promise<void>): Promise<void> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await work();
      return;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

async function cleanupOwnedFixtures(): Promise<void> {
  for (const triggerName of triggerNames) {
    await mysqlExecute(`DROP TRIGGER IF EXISTS \`${triggerName}\``);
  }
  triggerNames.clear();
  fsMockState.unlinkInterceptor = undefined;

  await retryCleanup(async () => {
    const bannerIds = [...fixtureBannerIds];
    const assetIds = [...fixtureAssetIds];

    if (bannerIds.length > 0) {
      await prisma.affiliateBanner.deleteMany({ where: { id: { in: bannerIds } } });
    }
    if (assetIds.length > 0) {
      await prisma.affiliateBannerAsset.deleteMany({ where: { id: { in: assetIds } } });
    }

    await Promise.all(
      [...fixtureStorageKeys.values()].flatMap((storageKey) => [
        rm(imagePath(storageKey), { force: true }),
        rm(path.join(uploadRoot, '.affiliate-banner-staging', `${path.basename(storageKey, path.extname(storageKey))}.part`), {
          force: true,
        }),
      ]),
    );
  });
  fixtureBannerIds.clear();
  fixtureAssetIds.clear();
  fixtureStorageKeys.clear();
}

async function insertReadyAsset(bytes = pngBytes): Promise<{ id: string; storageKey: string }> {
  const id = uuid();
  const storageKey = storageKeyFor(id);
  trackAsset(id, storageKey);
  await mkdir(path.dirname(imagePath(storageKey)), { recursive: true });
  await writeFile(imagePath(storageKey), bytes);
  await prisma.affiliateBannerAsset.create({
    data: {
      id,
      storageKey,
      mimeType: 'image/png',
      byteSize: bytes.length,
      status: 'ready',
      unlinkedAt: expiredAt,
      createdAt: expiredAt,
    },
  });
  return { id, storageKey };
}

async function insertExternalBanner(): Promise<string> {
  const id = uuid();
  trackBanner(id);
  await prisma.affiliateBanner.create({
    data: {
      id,
      provider: 'coupang',
      name: `fixture-${id.slice(0, 8)}`,
      imageSourceType: 'url',
      imageAssetId: null,
      externalImageUrl: 'https://images.example.com/fixture.png',
      targetUrl: 'https://example.com/go?a=%2B&a=2+b',
      altText: 'fixture banner',
      isEnabled: false,
    },
  });
  return id;
}

async function withHeldAssetLock<T>(
  assetId: string,
  work: (releaseLock: () => void) => Promise<T>,
): Promise<T> {
  observeAssetLocks(assetId);
  const locked = deferred();
  const release = deferred();
  let released = false;
  const releaseLock = (): void => {
    if (!released) {
      released = true;
      release.resolve();
    }
  };
  const holding = lockPrisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM AffiliateBannerAsset WHERE id = ${assetId} FOR UPDATE`;
    locked.resolve();
    await release.promise;
  }, {
    maxWait: 5000,
    timeout: 15000,
  });

  await locked.promise;
  try {
    return await work(releaseLock);
  } finally {
    releaseLock();
    await holding;
    stopObservingAssetLocks();
  }
}

async function mysqlExecute(sql: string): Promise<void> {
  await execFileAsync('docker', [
    'exec',
    'ilsangkit-mysql',
    'mysql',
    '-uroot',
    '-prootpassword',
    'ilsangkit_affiliate_test',
    '-e',
    sql,
  ]);
}

async function mysqlExecuteWithDelimiter(sql: string): Promise<void> {
  await execFileAsync('docker', [
    'exec',
    'ilsangkit-mysql',
    'mysql',
    '-uroot',
    '-prootpassword',
    'ilsangkit_affiliate_test',
    '--delimiter=//',
    '-e',
    sql,
  ]);
}

async function waitForObservedAssetLockEntries(assetId: string, expectedCount: number): Promise<number> {
  void assetId;
  return waitForObservedAssetLockCalls(expectedCount);
}

async function countDatabaseAssetLockWaiters(assetId: string): Promise<number> {
  const rows = await prisma.$queryRaw<Array<{ waitingCount: bigint }>>`
    SELECT COUNT(DISTINCT waits.REQUESTING_ENGINE_LOCK_ID) AS waitingCount
    FROM performance_schema.data_lock_waits waits
    JOIN performance_schema.data_locks locks
      ON locks.ENGINE = waits.ENGINE
     AND locks.ENGINE_LOCK_ID = waits.REQUESTING_ENGINE_LOCK_ID
    WHERE locks.OBJECT_SCHEMA = 'ilsangkit_affiliate_test'
      AND locks.OBJECT_NAME = 'AffiliateBannerAsset'
      AND locks.LOCK_STATUS = 'WAITING'
      AND locks.LOCK_DATA LIKE ${`%${assetId}%`}
  `;
  return Number(rows[0]?.waitingCount ?? 0);
}

async function waitForDatabaseAssetLockWaiters(assetId: string, expectedCount: number): Promise<number> {
  for (let attempt = 0; attempt < 5000; attempt += 1) {
    const count = await countDatabaseAssetLockWaiters(assetId);
    if (count >= expectedCount) return count;
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
  throw new Error(`Timed out waiting for ${expectedCount} database lock waiters on ${assetId}`);
}

async function waitForAssetStatus(assetId: string, status: 'pending' | 'ready' | 'deleting'): Promise<void> {
  for (let attempt = 0; attempt < 5000; attempt += 1) {
    const asset = await prisma.affiliateBannerAsset.findUnique({ where: { id: assetId } });
    if (asset?.status === status) return;
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
  throw new Error(`Timed out waiting for ${assetId} to become ${status}`);
}

function installUnlinkBarrier(blockedFilePath: string): { reached: Promise<void>; release: () => void } {
  const reached = deferred();
  const release = deferred();
  let released = false;
  fsMockState.unlinkInterceptor = async (filePath, actualUnlink) => {
    if (filePath === blockedFilePath) {
      reached.resolve();
      await release.promise;
    }
    return actualUnlink(filePath);
  };
  return {
    reached: reached.promise,
    release: () => {
      if (!released) {
        released = true;
        release.resolve();
      }
    },
  };
}

async function installAssetUpdateFailureTrigger(assetId: string): Promise<void> {
  const triggerName = `affiliate_it_fail_${assetId.replace(/-/g, '_')}`;
  triggerNames.add(triggerName);
  await mysqlExecute(`DROP TRIGGER IF EXISTS \`${triggerName}\``);
  await mysqlExecuteWithDelimiter(`
    CREATE TRIGGER \`${triggerName}\`
    BEFORE UPDATE ON AffiliateBannerAsset
    FOR EACH ROW
    BEGIN
      IF NEW.id = '${assetId}' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'affiliate integration rollback fault';
      END IF;
    END//
  `);
}

async function postUpload(bytes: Buffer): Promise<{ imageAssetId: string; imageUrl: string }> {
  const res = await request(app)
    .post('/api/admin/affiliate-banner-images')
    .set('Origin', ORIGIN)
    .set('Content-Type', 'application/octet-stream')
    .send(bytes);

  expect(res.status).toBe(201);
  expect(res.body.success).toBe(true);
  const imageAssetId = String(res.body.data.imageAssetId);
  const imageUrl = String(res.body.data.imageUrl);
  trackAsset(imageAssetId, imageUrl.replace('/api/images/', ''));
  return { imageAssetId, imageUrl };
}

async function assertAffiliateInvariant(bannerId: string, assetId: string): Promise<void> {
  const banner = await prisma.affiliateBanner.findUnique({ where: { id: bannerId } });
  const asset = await prisma.affiliateBannerAsset.findUnique({ where: { id: assetId } });

  if (banner?.imageAssetId === assetId) {
    expect(asset?.status).toBe('ready');
    expect(asset?.unlinkedAt).toBeNull();
    expect((await stat(imagePath(storageKeyFor(assetId)))).isFile()).toBe(true);
  } else {
    expect(banner?.imageAssetId ?? null).not.toBe(assetId);
  }
}

beforeAll(async () => {
  uploadRoot = await mkdtemp(path.join(os.tmpdir(), 'affiliate-banner-integration-'));
  process.env.UPLOAD_DIR = uploadRoot;
  [pngBytes, webpBytes, gifBytes] = await Promise.all([
    readFile(new URL('../fixtures/affiliate-banner.png', import.meta.url)),
    readFile(new URL('../fixtures/affiliate-banner.webp', import.meta.url)),
    readFile(new URL('../fixtures/affiliate-banner.gif', import.meta.url)),
  ]);
  app = await importApp();
});

afterEach(async () => {
  await cleanupOwnedFixtures();
});

afterAll(async () => {
  await cleanupOwnedFixtures();
  const productClients = [...new Set(productPrismaState.clients)];
  await Promise.all([
    prisma.$disconnect(),
    lockPrisma.$disconnect(),
    ...productClients.map((client) => client.$disconnect()),
  ]);
  await rm(uploadRoot, { recursive: true, force: true });
});

describe('affiliate banner real API and storage integration', () => {
  it('uploads, creates, reads, enables, replaces, rolls back failed replacement, and serves persisted bytes', async () => {
    const first = await postUpload(pngBytes);

    const staticUpload = await request(app).get(first.imageUrl);
    expect(staticUpload.status).toBe(200);
    expect(Buffer.compare(staticUpload.body, pngBytes)).toBe(0);

    const createRes = await request(app)
      .post('/api/admin/affiliate-banners')
      .set('Origin', ORIGIN)
      .send({
        provider: 'coupang',
        name: 'integration upload banner',
        imageSourceType: 'upload',
        imageAssetId: first.imageAssetId,
        externalImageUrl: null,
        targetUrl: 'https://example.com/go?a=%2B&a=2+b',
        altText: 'integration upload banner',
      });
    expect(createRes.status).toBe(201);
    const bannerId = String(createRes.body.data.id);
    trackBanner(bannerId);
    expect(createRes.body.data.isEnabled).toBe(false);
    expect(createRes.body.data.imageUrl).toBe(first.imageUrl);

    const readRes = await request(app).get(`/api/admin/affiliate-banners/${bannerId}`);
    expect(readRes.status).toBe(200);
    expect(readRes.body.data.targetUrl).toBe('https://example.com/go?a=%2B&a=2+b');

    const enableRes = await request(app)
      .patch(`/api/admin/affiliate-banners/${bannerId}/status`)
      .set('Origin', ORIGIN)
      .send({ isEnabled: true });
    expect(enableRes.status).toBe(200);
    expect(enableRes.body.data.isEnabled).toBe(true);

    const second = await postUpload(webpBytes);
    const replaceRes = await request(app)
      .patch(`/api/admin/affiliate-banners/${bannerId}`)
      .set('Origin', ORIGIN)
      .send({
        imageSourceType: 'upload',
        imageAssetId: second.imageAssetId,
        externalImageUrl: null,
      });
    expect(replaceRes.status).toBe(200);
    expect(replaceRes.body.data.imageAssetId).toBe(second.imageAssetId);

    const previous = await prisma.affiliateBannerAsset.findUnique({ where: { id: first.imageAssetId } });
    const replacement = await prisma.affiliateBannerAsset.findUnique({ where: { id: second.imageAssetId } });
    expect(previous?.unlinkedAt).toBeInstanceOf(Date);
    expect(replacement?.unlinkedAt).toBeNull();

    const broken = await postUpload(gifBytes);
    await rm(imagePath(fixtureStorageKeys.get(broken.imageAssetId)!), { force: true });
    const failedReplace = await request(app)
      .patch(`/api/admin/affiliate-banners/${bannerId}`)
      .set('Origin', ORIGIN)
      .send({
        imageSourceType: 'upload',
        imageAssetId: broken.imageAssetId,
        externalImageUrl: null,
      });
    expect(failedReplace.status).toBe(409);

    const afterRollback = await request(app).get(`/api/admin/affiliate-banners/${bannerId}`);
    expect(afterRollback.status).toBe(200);
    expect(afterRollback.body.data.imageAssetId).toBe(second.imageAssetId);
    expect(afterRollback.body.data.imageUrl).toBe(second.imageUrl);

    const transactionalFault = await postUpload(pngBytes);
    await installAssetUpdateFailureTrigger(transactionalFault.imageAssetId);
    const transactionalFailure = await request(app)
      .patch(`/api/admin/affiliate-banners/${bannerId}`)
      .set('Origin', ORIGIN)
      .send({
        imageSourceType: 'upload',
        imageAssetId: transactionalFault.imageAssetId,
        externalImageUrl: null,
      });
    expect(transactionalFailure.status).toBe(500);

    const afterTransactionalRollback = await prisma.affiliateBanner.findUnique({ where: { id: bannerId } });
    const stillLinked = await prisma.affiliateBannerAsset.findUnique({ where: { id: second.imageAssetId } });
    const rejected = await prisma.affiliateBannerAsset.findUnique({ where: { id: transactionalFault.imageAssetId } });
    expect(afterTransactionalRollback?.imageAssetId).toBe(second.imageAssetId);
    expect(stillLinked?.unlinkedAt).toBeNull();
    expect(rejected?.unlinkedAt).toBeInstanceOf(Date);

    const restartedApp = await importRestartedApp();
    expect(restartedApp).not.toBe(app);

    const restartedRead = await request(restartedApp).get(`/api/admin/affiliate-banners/${bannerId}`);
    expect(restartedRead.status).toBe(200);
    expect(restartedRead.body.data.imageAssetId).toBe(second.imageAssetId);

    const staticReplacement = await request(restartedApp).get(second.imageUrl);
    expect(staticReplacement.status).toBe(200);
    expect(Buffer.compare(staticReplacement.body, webpBytes)).toBe(0);
    app = restartedApp;
  });
});

describe('affiliate banner asset cleanup races on MySQL locks', () => {
  it('keeps a ready asset when attach commits before cleanup runs', async () => {
    const bannerId = await insertExternalBanner();
    const asset = await insertReadyAsset();
    const { cleanupAffiliateBannerAssets } = await import('../../src/services/affiliateBannerCleanupService.js');

    await withHeldAssetLock(asset.id, async (releaseLock) => {
      const attachPromise = request(app)
        .patch(`/api/admin/affiliate-banners/${bannerId}`)
        .set('Origin', ORIGIN)
        .send({
          imageSourceType: 'upload',
          imageAssetId: asset.id,
          externalImageUrl: null,
        })
        .then((attach) => attach);
      await waitForObservedAssetLockEntries(asset.id, 1);
      await waitForDatabaseAssetLockWaiters(asset.id, 1);
      releaseLock();

      const attach = await attachPromise;
      expect(attach.status).toBe(200);

      const cleanup = await cleanupAffiliateBannerAssets(new Date());
      expect(cleanup.failed).toBe(0);
    });

    await assertAffiliateInvariant(bannerId, asset.id);
  });

  it('rejects attach after cleanup commits deleting while the file and row still exist', async () => {
    const bannerId = await insertExternalBanner();
    const asset = await insertReadyAsset();
    const { cleanupAffiliateBannerAssets } = await import('../../src/services/affiliateBannerCleanupService.js');
    const barrier = installUnlinkBarrier(imagePath(asset.storageKey));

    const cleanupPromise = cleanupAffiliateBannerAssets(new Date());
    let cleanup: Awaited<ReturnType<typeof cleanupAffiliateBannerAssets>> | undefined;
    let caughtError: unknown;

    try {
      await barrier.reached;
      await waitForAssetStatus(asset.id, 'deleting');
      expect((await stat(imagePath(asset.storageKey))).isFile()).toBe(true);

      const attach = await request(app)
        .patch(`/api/admin/affiliate-banners/${bannerId}`)
        .set('Origin', ORIGIN)
        .send({
          imageSourceType: 'upload',
          imageAssetId: asset.id,
          externalImageUrl: null,
        });
      expect(attach.status).toBe(409);
      const claimed = await prisma.affiliateBannerAsset.findUnique({ where: { id: asset.id } });
      expect(claimed?.status).toBe('deleting');
      expect((await stat(imagePath(asset.storageKey))).isFile()).toBe(true);
    } catch (error) {
      caughtError = error;
    } finally {
      barrier.release();
      try {
        cleanup = await cleanupPromise;
      } catch (error) {
        if (!caughtError) caughtError = error;
      }
    }

    if (caughtError) throw caughtError;
    expect(cleanup?.failed).toBe(0);
    expect(cleanup?.deleted).toBeGreaterThanOrEqual(1);

    await assertAffiliateInvariant(bannerId, asset.id);
  });

  it('allows either concurrent winner without a dangling banner reference', async () => {
    const { cleanupAffiliateBannerAssets } = await import('../../src/services/affiliateBannerCleanupService.js');

    for (let i = 0; i < 3; i += 1) {
      const bannerId = await insertExternalBanner();
      const asset = await insertReadyAsset();

      const [attach, cleanup] = await withHeldAssetLock(asset.id, async (releaseLock) => {
        const attachPromise = request(app)
          .patch(`/api/admin/affiliate-banners/${bannerId}`)
          .set('Origin', ORIGIN)
          .send({
            imageSourceType: 'upload',
            imageAssetId: asset.id,
            externalImageUrl: null,
          })
          .then((attachResult) => attachResult);
        const cleanupPromise = cleanupAffiliateBannerAssets(new Date())
          .then((cleanupResult) => cleanupResult);
        await waitForObservedAssetLockEntries(asset.id, 2);
        await waitForDatabaseAssetLockWaiters(asset.id, 2);
        releaseLock();
        return Promise.allSettled([attachPromise, cleanupPromise]);
      });

      expect(attach.status).toBe('fulfilled');
      expect(cleanup.status).toBe('fulfilled');
      if (attach.status === 'fulfilled') {
        expect([200, 409]).toContain(attach.value.status);
      }
      if (cleanup.status === 'fulfilled') {
        expect(cleanup.value.failed).toBe(0);
      }
      await assertAffiliateInvariant(bannerId, asset.id);
    }
  });

  it('treats concurrent cleanup workers and missing files as idempotent for owned expired assets', async () => {
    const asset = await insertReadyAsset();
    await rm(imagePath(asset.storageKey), { force: true });
    const { cleanupAffiliateBannerAssets } = await import('../../src/services/affiliateBannerCleanupService.js');

    const results = await Promise.all([
      cleanupAffiliateBannerAssets(new Date()),
      cleanupAffiliateBannerAssets(new Date()),
      cleanupAffiliateBannerAssets(new Date()),
    ]);

    expect(results.every((result) => result.failed === 0)).toBe(true);
    expect(results.reduce((total, result) => total + result.deleted, 0)).toBeGreaterThanOrEqual(1);
    expect(await prisma.affiliateBannerAsset.findUnique({ where: { id: asset.id } })).toBeNull();

    const afterGone = await Promise.all([
      cleanupAffiliateBannerAssets(new Date()),
      cleanupAffiliateBannerAssets(new Date()),
    ]);
    expect(afterGone).toEqual([
      { deleted: 0, failed: 0 },
      { deleted: 0, failed: 0 },
    ]);
  });
});
