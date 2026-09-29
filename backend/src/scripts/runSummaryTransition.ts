import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { prisma } from '../lib/prisma.js';
import { applyReleaseSchema, createPrismaSchemaDatabase } from './applyReleaseSchema.js';
import {
  prepareRealEstateSummaryV2,
  verifyRealEstateSummaryV2,
  type SummaryValidationReport,
} from '../services/realEstateSummaryValidation.js';
import { withRealEstateWriteLock } from '../utils/realEstateWriteLock.js';

const execFileAsync = promisify(execFile);

export interface SummaryTransitionOptions {
  inventoryPath: string;
  manifestPath: string;
  releaseScriptPath: string;
  reportOut?: string;
  skipPrepare?: boolean;
  compatibilityManifestPath?: string;
  bootstrapCompatibilityCheck?: boolean;
}

export interface SummaryTransitionReport {
  releaseId: string;
  expectedRunId: string;
  prepared?: SummaryValidationReport;
  verified: SummaryValidationReport;
  checked: unknown;
  switched: unknown;
  schema?: unknown;
  compatibilityChecked?: unknown;
}

interface SummaryTransitionDependencies {
  prepare: typeof prepareRealEstateSummaryV2;
  verify: typeof verifyRealEstateSummaryV2;
  withWriteLock: typeof withRealEstateWriteLock;
  withDeployLock?: <T>(options: SummaryTransitionOptions, run: () => Promise<T>) => Promise<T>;
  applySchema?: () => Promise<unknown>;
  runReleaseCommand: (
    command: 'check' | 'switch',
    options: SummaryTransitionOptions
  ) => Promise<unknown>;
}

function parseRequiredArg(args: string[], name: string): string {
  const inline = args.find((arg) => arg.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  const index = args.indexOf(name);
  if (index >= 0 && args[index + 1]) return args[index + 1];
  throw new Error(`${name} is required`);
}

function parseOptionalArg(args: string[], name: string): string | undefined {
  const inline = args.find((arg) => arg.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  const index = args.indexOf(name);
  if (index >= 0) return args[index + 1];
  return undefined;
}

export function parseSummaryTransitionArgs(args = process.argv.slice(2)): SummaryTransitionOptions {
  return {
    inventoryPath: resolve(parseRequiredArg(args, '--inventory')),
    manifestPath: resolve(parseRequiredArg(args, '--manifest')),
    releaseScriptPath: resolve(parseRequiredArg(args, '--release-script')),
    reportOut: parseOptionalArg(args, '--report-out'),
    skipPrepare: args.includes('--skip-prepare'),
    compatibilityManifestPath: parseOptionalArg(args, '--compatibility-manifest')
      ? resolve(parseOptionalArg(args, '--compatibility-manifest') as string)
      : undefined,
  };
}

async function defaultApplySchema(): Promise<unknown> {
  return applyReleaseSchema(createPrismaSchemaDatabase(prisma));
}

async function defaultWithDeployLock<T>(
  options: SummaryTransitionOptions,
  run: () => Promise<T>
): Promise<T> {
  const inventory = JSON.parse(await readFile(options.inventoryPath, 'utf8')) as { deployRoot?: string };
  if (!inventory.deployRoot) throw new Error('inventory.deployRoot is required for deploy lock');
  const lockPath = join(inventory.deployRoot, 'locks', 'release.lock');
  const token = randomUUID();
  await mkdir(dirname(lockPath), { recursive: true });
  try {
    await mkdir(lockPath);
  } catch (error) {
    if ((error as { code?: string }).code === 'EEXIST') {
      throw new Error(`deploy lock already held: ${lockPath}`);
    }
    throw error;
  }
  await atomicWriteJson(join(lockPath, 'owner.json'), {
    pid: process.pid,
    token,
    startedAtMs: Date.now(),
    startedAt: new Date().toISOString(),
    stage: 'summary-transition',
  });
  const previousToken = process.env.ILSK_DEPLOY_LOCK_TOKEN;
  process.env.ILSK_DEPLOY_LOCK_TOKEN = token;
  try {
    return await run();
  } finally {
    if (previousToken === undefined) delete process.env.ILSK_DEPLOY_LOCK_TOKEN;
    else process.env.ILSK_DEPLOY_LOCK_TOKEN = previousToken;
    await rm(lockPath, { recursive: true, force: true });
  }
}

async function defaultRunReleaseCommand(
  command: 'check' | 'switch',
  options: SummaryTransitionOptions
): Promise<unknown> {
  const { stdout } = await execFileAsync(process.execPath, [
    options.releaseScriptPath,
    command,
    '--inventory',
    options.inventoryPath,
    '--manifest',
    options.manifestPath,
    ...(options.bootstrapCompatibilityCheck ? ['--bootstrap-compat-check'] : []),
  ]);
  return stdout.trim() ? JSON.parse(stdout) : { command };
}

type ReleaseManifest = Record<string, unknown> & {
  releaseId?: string;
  rollbackReleaseId?: string;
  summary?: Record<string, unknown>;
  probes?: Array<Record<string, unknown>>;
  rollback?: Record<string, unknown> & { probes?: Array<Record<string, unknown>> };
};

async function readManifest(path: string): Promise<ReleaseManifest> {
  return JSON.parse(await readFile(path, 'utf8')) as ReleaseManifest;
}

function stampProbeRunId(probes: Array<Record<string, unknown>> | undefined, runId: string, mode?: string): void {
  for (const probe of probes ?? []) {
    const expectedJson = probe.expectedJson as Record<string, unknown> | undefined;
    if (!expectedJson) continue;
    if (Object.hasOwn(expectedJson, 'summary.runId')) expectedJson['summary.runId'] = runId;
    if (mode && Object.hasOwn(expectedJson, 'summary.mode')) expectedJson['summary.mode'] = mode;
  }
}

async function stampSummaryManifest(path: string, runId: string, mode: 'address' | 'compatibility'): Promise<ReleaseManifest> {
  const manifest = await readManifest(path);
  manifest.summary = {
    ...(manifest.summary ?? {}),
    mode,
    runId,
    expectedRunId: runId,
    state: 'ready',
  };
  stampProbeRunId(manifest.probes, runId, mode);
  stampProbeRunId(manifest.rollback?.probes, runId);
  await atomicWriteJson(path, manifest);
  return manifest;
}

function assertInitialManifestPair(address: ReleaseManifest, compatibility: ReleaseManifest): void {
  if (!compatibility.releaseId) throw new Error('compatibility manifest releaseId is required');
  if (address.summary?.mode !== 'address') throw new Error('address manifest summary mode must be address');
  if (compatibility.summary?.mode !== 'compatibility') {
    throw new Error('compatibility manifest summary mode must be compatibility');
  }
  if (address.rollbackReleaseId !== compatibility.releaseId) {
    throw new Error('address rollbackReleaseId must point to compatibility release');
  }
  if (address.rollback?.releaseId !== compatibility.releaseId) {
    throw new Error('address rollback manifest must point to compatibility release');
  }
}

async function atomicWriteJson(path: string, value: unknown): Promise<void> {
  await writeFile(`${path}.tmp-${process.pid}`, `${JSON.stringify(value, null, 2)}\n`, {
    flag: 'w',
  });
  await rename(`${path}.tmp-${process.pid}`, path);
}

function assertReadyReport(
  report: SummaryValidationReport,
  expectedRunId: string,
  label: string
): void {
  if (!report.complete) throw new Error(`${label} summary validation is incomplete`);
  if (report.runId !== expectedRunId) {
    throw new Error(
      `${label} summary runId mismatch: expected ${expectedRunId}, got ${report.runId}`
    );
  }
  if (report.originalChanged) throw new Error(`${label} source data changed during validation`);
  if (report.missingKeys || report.duplicateKeys || report.mismatchedGroups) {
    throw new Error(`${label} summary validation found drift`);
  }
}

export async function runSummaryTransition(
  options: SummaryTransitionOptions,
  dependencies: SummaryTransitionDependencies = {
    prepare: prepareRealEstateSummaryV2,
    verify: verifyRealEstateSummaryV2,
    withWriteLock: withRealEstateWriteLock,
    withDeployLock: defaultWithDeployLock,
    applySchema: defaultApplySchema,
    runReleaseCommand: defaultRunReleaseCommand,
  }
): Promise<SummaryTransitionReport> {
  const manifest = await readManifest(options.manifestPath);
  const releaseId = manifest.releaseId;
  let expectedRunId =
    (manifest.summary?.expectedRunId as string | undefined) ??
    (manifest.summary?.runId as string | undefined);
  if (!releaseId) throw new Error('manifest.releaseId is required');
  if (options.skipPrepare && !expectedRunId) throw new Error('manifest.summary.expectedRunId is required');
  if (!options.skipPrepare) {
    if (!options.compatibilityManifestPath) {
      throw new Error('compatibility manifest is required for first transition');
    }
    const initialCompatibilityManifest = await readManifest(options.compatibilityManifestPath);
    assertInitialManifestPair(manifest, initialCompatibilityManifest);
  }

  return dependencies.withWriteLock('runSummaryTransition:first-release', async () => {
    const runTransition = async (): Promise<SummaryTransitionReport> => {
      let schema: unknown;
      let compatibilityChecked: unknown;
      if (!options.skipPrepare) {
        if (!dependencies.applySchema) throw new Error('schema apply dependency is required');
        schema = await dependencies.applySchema();
      }
      const prepared = options.skipPrepare
        ? undefined
        : await dependencies.prepare({ reportOut: undefined });
      if (prepared) {
        expectedRunId = prepared.runId;
        assertReadyReport(prepared, expectedRunId, 'prepared');
      }
      if (!expectedRunId) throw new Error('manifest.summary.expectedRunId is required');

      if (!options.skipPrepare && options.compatibilityManifestPath) {
        await stampSummaryManifest(options.compatibilityManifestPath, expectedRunId, 'compatibility');
        await stampSummaryManifest(options.manifestPath, expectedRunId, 'address');
      } else if (prepared) {
        await stampSummaryManifest(options.manifestPath, expectedRunId, 'address');
      }

      const verified = await dependencies.verify({ reportOut: undefined });
      assertReadyReport(verified, expectedRunId, 'verified');

      if (!options.skipPrepare && options.compatibilityManifestPath) {
        const compatibilityOptions = {
          ...options,
          manifestPath: options.compatibilityManifestPath,
          bootstrapCompatibilityCheck: true,
        };
        compatibilityChecked = await dependencies.runReleaseCommand('check', compatibilityOptions);
      }

      const checked = await dependencies.runReleaseCommand('check', options);
      const switched = await dependencies.runReleaseCommand('switch', options);
      const report: SummaryTransitionReport = {
        releaseId,
        expectedRunId,
        prepared,
        verified,
        schema,
        compatibilityChecked,
        checked,
        switched,
      };
      if (options.reportOut) await atomicWriteJson(options.reportOut, report);
      return report;
    };

    if (options.skipPrepare) return runTransition();
    const withDeployLock = dependencies.withDeployLock ?? defaultWithDeployLock;
    return withDeployLock(options, runTransition);
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runSummaryTransition(parseSummaryTransitionArgs())
    .then(async (report) => {
      console.info(JSON.stringify(report, null, 2));
      await prisma.$disconnect();
    })
    .catch(async (error) => {
      console.error(error instanceof Error ? error.message : String(error));
      await prisma.$disconnect();
      process.exitCode = 1;
    });
}
