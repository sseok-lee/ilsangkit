import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  parseSummaryTransitionArgs,
  runSummaryTransition,
} from '../../src/scripts/runSummaryTransition.js';
import type { SummaryValidationReport } from '../../src/services/realEstateSummaryValidation.js';
import { validateManifest } from '../../../scripts/deploy/release.mjs';

function readyReport(runId = 'summary-run-1'): SummaryValidationReport {
  return {
    runId,
    complete: true,
    sourceFingerprint: 'f'.repeat(64),
    missingKeys: 0,
    duplicateKeys: 0,
    mismatchedGroups: 0,
    originalChanged: false,
    batches: [],
  };
}


function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

const sameAKey = 'a'.repeat(64);
const sameBKey = 'b'.repeat(64);
const modeKey = 'c'.repeat(64);

async function writeFullReleaseFixtures(dir: string): Promise<{
  inventoryPath: string;
  addressManifestPath: string;
  compatibilityManifestPath: string;
  inventory: Record<string, unknown>;
}> {
  const deployRoot = join(dir, 'deploy');
  const releasesRoot = join(deployRoot, 'releases');
  const sharedRoot = join(deployRoot, 'shared');
  const nginxDir = join(deployRoot, 'nginx');
  const assetPath = join(dir, 'entry.abc123.js');
  const backendArtifactPath = join(dir, 'backend.tgz');
  const frontendArtifactPath = join(dir, 'frontend.tgz');
  await mkdir(join(sharedRoot, 'assets'), { recursive: true });
  await mkdir(join(sharedRoot, 'sitemaps'), { recursive: true });
  await mkdir(nginxDir, { recursive: true });
  await writeFile(assetPath, 'console.log("asset")');
  await writeFile(backendArtifactPath, 'backend artifact');
  await writeFile(frontendArtifactPath, 'frontend artifact');
  const inventory = {
    deployRoot,
    releasesRoot,
    nginxConfigPath: join(nginxDir, 'nginx.conf'),
    nginxIncludePath: join(nginxDir, 'active.conf'),
    nginxBinary: '/usr/sbin/nginx',
    pm2Binary: '/usr/bin/pm2',
    active: {
      backend: { port: 8000 },
      frontend: { port: 3000 },
    },
    reservePorts: [13000, 13001, 18000, 18001, 19000],
    assets: { publicDir: join(sharedRoot, 'assets') },
    sitemap: { releaseDir: join(sharedRoot, 'sitemaps', 'address-release') },
    envFile: join(sharedRoot, 'backend.env'),
    realEstateWriteLockDir: join(sharedRoot, 'locks'),
    activeBackendLink: join(deployRoot, 'current-backend'),
    activeFrontendLink: join(deployRoot, 'current-frontend'),
  };
  const baseProbes = (releaseId: string, mode: 'address' | 'compatibility', runId: string) => {
    const listProbe = (name: string, type: string) => ({
      name,
      path: `/api/real-estate/${type}/complexes?city=서울특별시&district=강남구&limit=1`,
      target: 'backend',
      expectedReleaseId: releaseId,
      expectedJson: { success: true },
      expectedJsonTypes: { 'data.total': 'nonnegativeNumber', 'data.items': 'array', 'data.items[0].buildingName': 'nonemptyString' },
      expectedJsonMinItems: { 'data.items': 1 },
    });
    const buildingInfoProbe = (name: string, key: string, jibun: string) => ({
      name,
      path: `/api/real-estate/apt-sale/building-info?bjdCode=1168010100&buildingName=${encodeURIComponent('같은아파트')}&buildingKey=${key}`,
      target: 'backend',
      expectedReleaseId: releaseId,
      expectedJson: { success: true, 'data.buildingKey': key, 'data.dongName': '역삼동', 'data.jibun': jibun, 'data.buildingName': '같은아파트' },
    });
    const detailProbe = (name: string, type: string, detailMode: string) => ({
      name,
      path: `/api/real-estate/${type}/detail?bjdCode=1168010100&buildingName=${encodeURIComponent('모드아파트')}&buildingKey=${modeKey}&mode=${detailMode}`,
      target: 'backend',
      expectedReleaseId: releaseId,
      expectedJson: { success: true, 'data.filters.mode': detailMode, 'data.filters.buildingKey': modeKey },
    });
    return [
      { name: 'release-readiness', path: '/api/internal/release-readiness', target: 'backend', expectedReleaseId: releaseId, expectedJson: { ready: true, releaseId, 'summary.mode': mode, 'summary.runId': runId } },
      listProbe('apt-sale-list', 'apt-sale'),
      listProbe('apt-rent-list', 'apt-rent'),
      listProbe('villa-sale-list', 'villa-sale'),
      listProbe('villa-rent-list', 'villa-rent'),
      listProbe('offitel-sale-list', 'offitel-sale'),
      listProbe('offitel-rent-list', 'offitel-rent'),
      buildingInfoProbe('same-name-address-a', sameAKey, '101-1'),
      buildingInfoProbe('same-name-address-b', sameBKey, '202-2'),
      detailProbe('sale-mode', 'apt-sale', 'sale'),
      detailProbe('rent-mode', 'apt-rent', 'wolse'),
      { name: 'sitemap', path: '/sitemap.xml', target: 'frontend', expectedReleaseId: releaseId, expectBodyIncludes: '<loc>' },
      {
        name: 'waste',
        path: '/api/waste-schedules?city=서울특별시&district=강남구&limit=1',
        target: 'backend',
        expectedReleaseId: releaseId,
        expectedJson: { success: true },
        expectedJsonTypes: { 'data.total': 'nonnegativeNumber', 'data.items': 'array', 'data.items[0].id': 'nonnegativeNumber' },
        expectedJsonMinItems: { 'data.items': 1 },
      },
    ];
  };
  const common = {
    commitSha: 'a'.repeat(40),
    workflowSha: 'a'.repeat(40),
    backendArtifact: { path: backendArtifactPath, sha256: sha256('backend artifact') },
    frontendArtifact: { path: frontendArtifactPath, sha256: sha256('frontend artifact') },
    runtime: {
      backendEnvFile: join(sharedRoot, 'backend.env'),
      realEstateWriteLockDir: join(sharedRoot, 'locks'),
      sitemapDir: join(sharedRoot, 'sitemaps', 'address-release'),
    },
    activePointers: {
      backend: join(deployRoot, 'current-backend'),
      frontend: join(deployRoot, 'current-frontend'),
    },
    publicOrigin: 'http://127.0.0.1:19000',
    hashedAssets: [{ path: assetPath, fileName: 'entry.abc123.js', sha256: sha256('console.log("asset")') }],
    publicSmokeProbes: [
      { name: 'public-health', path: '/api/health', target: 'proxy', expectedReleaseId: 'address-release' },
      { name: 'public-sitemap', path: '/sitemap.xml', target: 'proxy', expectedReleaseId: 'address-release' },
    ],
  };
  const staleRun = 'stale-run';
  const compatibility = {
    ...common,
    releaseId: 'compat-release',
    ports: { frontend: 13000, backend: 18000, proxy: 19000 },
    rollbackReleaseId: 'old-release',
    rollback: {
      releaseId: 'old-release',
      frontendPort: 3000,
      backendPort: 8000,
      retained: true,
      supportsKeyedUrls: false,
      businessProbesPass: false,
      probes: [{ name: 'rollback-readiness', path: '/api/internal/release-readiness', target: 'backend', expectedJson: { 'summary.runId': staleRun } }],
    },
    summary: { mode: 'compatibility', runId: staleRun, expectedRunId: staleRun, state: 'ready' },
    probes: baseProbes('compat-release', 'compatibility', staleRun),
    publicSmokeProbes: [
      { name: 'public-health', path: '/api/health', target: 'proxy', expectedReleaseId: 'compat-release' },
      { name: 'public-sitemap', path: '/sitemap.xml', target: 'proxy', expectedReleaseId: 'compat-release' },
    ],
  };
  const address = {
    ...common,
    releaseId: 'address-release',
    ports: { frontend: 13001, backend: 18001, proxy: 19000 },
    rollbackReleaseId: 'compat-release',
    rollback: {
      releaseId: 'compat-release',
      frontendPort: 13000,
      backendPort: 18000,
      retained: true,
      supportsKeyedUrls: true,
      businessProbesPass: true,
      probes: [{ name: 'rollback-readiness', path: '/api/internal/release-readiness', target: 'backend', expectedJson: { 'summary.runId': staleRun } }],
    },
    summary: { mode: 'address', runId: staleRun, expectedRunId: staleRun, state: 'ready' },
    probes: baseProbes('address-release', 'address', staleRun),
  };
  const inventoryPath = join(dir, 'inventory.json');
  const addressManifestPath = join(dir, 'address-manifest.json');
  const compatibilityManifestPath = join(dir, 'compatibility-manifest.json');
  await writeFile(inventoryPath, JSON.stringify(inventory));
  await writeFile(addressManifestPath, JSON.stringify(address));
  await writeFile(compatibilityManifestPath, JSON.stringify(compatibility));
  return { inventoryPath, addressManifestPath, compatibilityManifestPath, inventory };
}

async function writeManifest(
  dir: string,
  summary = { mode: 'address', expectedRunId: 'summary-run-1', runId: 'summary-run-1' },
  fileName = 'manifest.json'
): Promise<string> {
  const path = join(dir, fileName);
  const compatibility = fileName.includes('compat');
  const releaseId = compatibility ? 'compat-release' : 'address-20260929-abc123';
  await writeFile(path, JSON.stringify({
    releaseId,
    summary,
    ...(compatibility
      ? {
          rollbackReleaseId: 'old-release',
          rollback: { releaseId: 'old-release' },
        }
      : {
          rollbackReleaseId: 'compat-release',
          rollback: { releaseId: 'compat-release' },
        }),
  }));
  return path;
}

function deps(
  events: string[],
  overrides: Partial<Parameters<typeof runSummaryTransition>[1]> = {}
) {
  return {
    prepare: vi.fn(async () => {
      events.push('prepare');
      return readyReport();
    }),
    verify: vi.fn(async () => {
      events.push('verify');
      return readyReport();
    }),
    withWriteLock: vi.fn(async (_label, run) => {
      events.push('lock-start');
      try {
        return await run();
      } finally {
        events.push('lock-end');
      }
    }),
    applySchema: vi.fn(async () => {
      events.push('schema');
      return { applied: true };
    }),
    runReleaseCommand: vi.fn(async (command) => {
      events.push(command);
      return { command };
    }),
    withDeployLock: vi.fn(async (_options, run) => {
      events.push('deploy-lock-start');
      try {
        return await run();
      } finally {
        events.push('deploy-lock-end');
      }
    }),
    ...overrides,
  };
}

describe('runSummaryTransition', () => {
  it('holds the real-estate writer lock through prepare, verify, check, and switch', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'c2-summary-transition-'));
    const manifestPath = await writeManifest(dir);
    const compatibilityManifestPath = await writeManifest(dir, { mode: 'compatibility' }, 'compatibility-manifest.json');
    const events: string[] = [];
    const reportOut = join(dir, 'report.json');

    const report = await runSummaryTransition(
      {
        inventoryPath: join(dir, 'inventory.json'),
        manifestPath,
        releaseScriptPath: join(dir, 'release.mjs'),
        compatibilityManifestPath,
        reportOut,
      },
      deps(events)
    );

    expect(events).toEqual(['lock-start', 'deploy-lock-start', 'schema', 'prepare', 'verify', 'check', 'check', 'switch', 'deploy-lock-end', 'lock-end']);
    expect(report).toMatchObject({
      releaseId: 'address-20260929-abc123',
      expectedRunId: 'summary-run-1',
    });
    expect(JSON.parse(await readFile(reportOut, 'utf8'))).toMatchObject({
      releaseId: 'address-20260929-abc123',
    });
  });



  it('uses the prepare-generated runId for the first transition manifest before check', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'c2-summary-transition-'));
    const manifestPath = await writeManifest(dir, { mode: 'address' });
    const compatibilityManifestPath = await writeManifest(dir, { mode: 'compatibility' }, 'compatibility-manifest.json');
    const events: string[] = [];
    const generatedRunId = 'generated-run-id';

    const report = await runSummaryTransition(
      {
        inventoryPath: join(dir, 'inventory.json'),
        manifestPath,
        releaseScriptPath: join(dir, 'release.mjs'),
        compatibilityManifestPath,
      },
      deps(events, {
        prepare: vi.fn(async () => {
          events.push('prepare');
          return readyReport(generatedRunId);
        }),
        verify: vi.fn(async () => {
          events.push('verify');
          return readyReport(generatedRunId);
        }),
        runReleaseCommand: vi.fn(async (command, opts) => {
          const manifest = JSON.parse(await readFile(opts.manifestPath, 'utf8'));
          const kind = opts.manifestPath === manifestPath ? 'address' : 'compat';
          events.push(`${command}:${kind}:${manifest.summary.runId}:${opts.bootstrapCompatibilityCheck === true ? 'bootstrap' : 'strict'}`);
          return { command };
        }),
      })
    );

    expect(report.expectedRunId).toBe(generatedRunId);
    expect(events).toEqual([
      'lock-start',
      'deploy-lock-start',
      'schema',
      'prepare',
      'verify',
      `check:compat:${generatedRunId}:bootstrap`,
      `check:address:${generatedRunId}:strict`,
      `switch:address:${generatedRunId}:strict`,
      'deploy-lock-end',
      'lock-end',
    ]);
    expect(JSON.parse(await readFile(manifestPath, 'utf8')).summary).toMatchObject({
      runId: generatedRunId,
      expectedRunId: generatedRunId,
      state: 'ready',
    });
  });



  it('requires schema and compatibility release checks before address switch on first transition', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'c2-summary-transition-'));
    const manifestPath = await writeManifest(dir, { mode: 'address' });
    const compatibilityManifestPath = await writeManifest(dir, { mode: 'compatibility' }, 'compatibility-manifest.json');
    const events: string[] = [];

    await runSummaryTransition(
      {
        inventoryPath: join(dir, 'inventory.json'),
        manifestPath,
        releaseScriptPath: join(dir, 'release.mjs'),
        compatibilityManifestPath,
      },
      deps(events, {
        runReleaseCommand: vi.fn(async (command, opts) => {
          events.push(`${command}:${opts.manifestPath === manifestPath ? 'address' : 'compat'}:${opts.bootstrapCompatibilityCheck === true ? 'bootstrap' : 'strict'}`);
          return { command };
        }),
      })
    );

    expect(events).toEqual([
      'lock-start',
      'deploy-lock-start',
      'schema',
      'prepare',
      'verify',
      'check:compat:bootstrap',
      'check:address:strict',
      'switch:address:strict',
      'deploy-lock-end',
      'lock-end',
    ]);
  });


  it('stamps generated runId into address and compatibility manifests before validating release checks', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'c2-summary-transition-'));
    const { inventoryPath, addressManifestPath, compatibilityManifestPath, inventory } = await writeFullReleaseFixtures(dir);
    const events: string[] = [];
    const generatedRunId = 'generated-run-id';

    await runSummaryTransition(
      {
        inventoryPath,
        manifestPath: addressManifestPath,
        releaseScriptPath: join(dir, 'release.mjs'),
        compatibilityManifestPath,
      },
      deps(events, {
        prepare: vi.fn(async () => {
          events.push('prepare');
          return readyReport(generatedRunId);
        }),
        verify: vi.fn(async () => {
          events.push('verify');
          return readyReport(generatedRunId);
        }),
        runReleaseCommand: vi.fn(async (command, opts) => {
          const manifest = JSON.parse(await readFile(opts.manifestPath, 'utf8'));
          validateManifest(manifest, inventory, { bootstrapCompatibilityCheck: opts.bootstrapCompatibilityCheck === true });
          const kind = opts.manifestPath === addressManifestPath ? 'address' : 'compat';
          events.push(`${command}:${kind}:${manifest.summary.runId}:${manifest.probes[0].expectedJson['summary.runId']}:${opts.bootstrapCompatibilityCheck === true ? 'bootstrap' : 'strict'}`);
          return { command, kind };
        }),
      })
    );

    expect(events).toEqual([
      'lock-start',
      'deploy-lock-start',
      'schema',
      'prepare',
      'verify',
      `check:compat:${generatedRunId}:${generatedRunId}:bootstrap`,
      `check:address:${generatedRunId}:${generatedRunId}:strict`,
      `switch:address:${generatedRunId}:${generatedRunId}:strict`,
      'deploy-lock-end',
      'lock-end',
    ]);
    expect(JSON.parse(await readFile(addressManifestPath, 'utf8')).rollbackReleaseId).toBe('compat-release');
    expect(JSON.parse(await readFile(compatibilityManifestPath, 'utf8')).summary).toMatchObject({
      mode: 'compatibility',
      runId: generatedRunId,
      expectedRunId: generatedRunId,
      state: 'ready',
    });
  });

  it('requires a compatibility manifest for first transition', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'c2-summary-transition-'));
    const manifestPath = await writeManifest(dir, { mode: 'address' });
    const events: string[] = [];

    await expect(
      runSummaryTransition(
        {
          inventoryPath: join(dir, 'inventory.json'),
          manifestPath,
          releaseScriptPath: join(dir, 'release.mjs'),
        },
        deps(events)
      )
    ).rejects.toThrow(/compatibility manifest is required/);
    expect(events).toEqual([]);
  });

  it('rejects wrong first-transition manifest modes before schema or prepare writes', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'c2-summary-transition-'));
    const manifestPath = await writeManifest(dir, { mode: 'compatibility' });
    const compatibilityManifestPath = await writeManifest(dir, { mode: 'compatibility' }, 'compatibility-manifest.json');
    const events: string[] = [];

    await expect(
      runSummaryTransition(
        {
          inventoryPath: join(dir, 'inventory.json'),
          manifestPath,
          releaseScriptPath: join(dir, 'release.mjs'),
          compatibilityManifestPath,
        },
        deps(events)
      )
    ).rejects.toThrow(/address manifest summary mode must be address/);
    expect(events).toEqual([]);
  });

  it('rejects a wrong address rollback link before schema or prepare writes', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'c2-summary-transition-'));
    const manifestPath = await writeManifest(dir, { mode: 'address' });
    const compatibilityManifestPath = await writeManifest(dir, { mode: 'compatibility' }, 'compatibility-manifest.json');
    const addressManifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    addressManifest.rollbackReleaseId = 'old-release';
    addressManifest.rollback.releaseId = 'old-release';
    await writeFile(manifestPath, JSON.stringify(addressManifest));
    const events: string[] = [];

    await expect(
      runSummaryTransition(
        {
          inventoryPath: join(dir, 'inventory.json'),
          manifestPath,
          releaseScriptPath: join(dir, 'release.mjs'),
          compatibilityManifestPath,
        },
        deps(events)
      )
    ).rejects.toThrow(/address rollbackReleaseId must point to compatibility release/);
    expect(events).toEqual([]);
  });

  it('rejects first transition when schema apply dependency is missing', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'c2-summary-transition-'));
    const manifestPath = await writeManifest(dir, { mode: 'address' });
    const compatibilityManifestPath = await writeManifest(dir, { mode: 'compatibility' }, 'compatibility-manifest.json');
    const events: string[] = [];
    const dependencies = deps(events);
    delete (dependencies as Partial<typeof dependencies>).applySchema;

    await expect(
      runSummaryTransition(
        {
          inventoryPath: join(dir, 'inventory.json'),
          manifestPath,
          releaseScriptPath: join(dir, 'release.mjs'),
          compatibilityManifestPath,
        },
        dependencies
      )
    ).rejects.toThrow(/schema apply dependency is required/);
  });

  it('supports skipPrepare for normal deploy paths while still verifying before switch', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'c2-summary-transition-'));
    const manifestPath = await writeManifest(dir);
    const events: string[] = [];

    await runSummaryTransition(
      {
        inventoryPath: join(dir, 'inventory.json'),
        manifestPath,
        releaseScriptPath: join(dir, 'release.mjs'),
        skipPrepare: true,
      },
      deps(events)
    );

    expect(events).toEqual(['lock-start', 'verify', 'check', 'switch', 'lock-end']);
  });

  it('rejects wrong runId before candidate execution', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'c2-summary-transition-'));
    const manifestPath = await writeManifest(dir);
    const events: string[] = [];

    await expect(
      runSummaryTransition(
        {
          inventoryPath: join(dir, 'inventory.json'),
          manifestPath,
          releaseScriptPath: join(dir, 'release.mjs'),
          skipPrepare: true,
        },
        deps(events, { verify: vi.fn(async () => readyReport('wrong-run')) })
      )
    ).rejects.toThrow(/runId mismatch/);
    expect(events).toEqual(['lock-start', 'lock-end']);
  });

  it('parses required CLI paths and skipPrepare flag', () => {
    const parsed = parseSummaryTransitionArgs([
      '--inventory',
      'inventory.json',
      '--manifest=manifest.json',
      '--release-script',
      'scripts/deploy/release.mjs',
      '--compatibility-manifest',
      'compat.json',
      '--skip-prepare',
    ]);

    expect(parsed.inventoryPath.endsWith('inventory.json')).toBe(true);
    expect(parsed.manifestPath.endsWith('manifest.json')).toBe(true);
    expect(parsed.releaseScriptPath.endsWith('scripts/deploy/release.mjs')).toBe(true);
    expect(parsed.compatibilityManifestPath?.endsWith('compat.json')).toBe(true);
    expect(parsed.skipPrepare).toBe(true);
  });
});
