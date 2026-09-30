import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';
import { pathToFileURL } from 'url';
import type { PrismaClient } from '@prisma/client';
import type { AuditReport, ReferenceBundle, SourceRegionInput } from '../types/wasteArea.js';
import { resolveCoverage } from '../services/wasteAreaResolver.js';
import { buildWasteSourceScope } from '../utils/wasteSourceScope.js';

type WasteScheduleReader = Pick<PrismaClient['wasteSchedule'], 'findMany'>;

interface RawAuditRow {
  id: number;
  city: string;
  district: string;
  targetRegion: string | null;
  sourceId: string;
}

interface CliOptions {
  out: string | null;
  referencePath: string | null;
  asOf: string;
}

const DEFAULT_REFERENCE_PATH = '../.superpowers/waste-area-discovery/references/normalized-reference.json';
const DEFAULT_OUTPUT_PATH = '../.superpowers/waste-area-discovery/data-audit.json';
const MISSING_REFERENCE_VERSION = 'missing-reference';

export function isCliEntrypoint(moduleUrl: string, argvEntry = process.argv[1]): boolean {
  if (!argvEntry) return false;
  return moduleUrl === pathToFileURL(path.resolve(argvEntry)).href;
}

export function validateReferenceBundle(references: ReferenceBundle): void {
  for (const relation of references.relations) {
    const hasFromKey = relation.fromKey !== null;
    const hasAlias = relation.alias !== null;
    if (hasFromKey === hasAlias) {
      throw new Error('SearchRelation must have exactly one of fromKey or alias');
    }
  }
  if (!references.version.startsWith('fixture')) {
    for (const evidence of collectEvidence(references)) {
      if (new URL(evidence.url).hostname === 'example.test') {
        throw new Error('Actual reference audits must not use https://example.test/ fixture evidence.');
      }
    }
  }
}

function collectEvidence(references: ReferenceBundle) {
  return [
    ...references.areas.map((area) => area.evidence),
    ...references.relations.map((relation) => relation.evidence),
    ...Object.values(references.sourceAreaKinds).map((sourceKind) => sourceKind.evidence),
  ];
}

export async function readAuditRows(reader: WasteScheduleReader): Promise<SourceRegionInput[]> {
  const rows = await reader.findMany({
    where: { sourceId: { not: { startsWith: 'seed-waste-schedule-' } } },
    orderBy: { id: 'asc' },
    select: {
      id: true,
      city: true,
      district: true,
      targetRegion: true,
      sourceId: true,
    },
  }) as RawAuditRow[];

  return rows.map((row) => ({
    scheduleId: row.id,
    sourceScope: buildWasteSourceScope(row),
    city: row.city,
    district: row.district,
    targetRegion: row.targetRegion,
  }));
}

export function auditWasteAreas(
  rows: SourceRegionInput[],
  references: ReferenceBundle,
  asOf = currentDateString()
): AuditReport {
  validateReferenceBundle(references);

  const candidates = rows.flatMap((row) => resolveCoverage(row, references, asOf));
  const cases = candidates.map((candidate) => ({
    scheduleId: candidate.scheduleId,
    classification: candidate.state,
    reason: candidate.reason,
  }));
  const verifiedAdministrativeKeys = new Set(
    candidates
      .filter((candidate) => candidate.state === 'verified' && candidate.areaKey?.startsWith('administrative:'))
      .map((candidate) => candidate.areaKey)
  );

  return {
    sourceCount: rows.length,
    candidateCount: candidates.length,
    verifiedAreaCount: verifiedAdministrativeKeys.size,
    unresolvedCount: candidates.filter((candidate) => candidate.state === 'unresolved').length,
    conflictCount: candidates.filter((candidate) => candidate.state === 'conflict').length,
    referenceVersion: references.version,
    asOf,
    cases,
  };
}

export function parseCliOptions(args: string[]): CliOptions {
  let out: string | null = DEFAULT_OUTPUT_PATH;
  let referencePath: string | null = DEFAULT_REFERENCE_PATH;
  let asOf = currentDateString();

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--stdout') {
      out = null;
      continue;
    }
    if (arg === '--out' && args[i + 1]) {
      out = args[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--references' && args[i + 1]) {
      referencePath = args[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--as-of' && args[i + 1]) {
      asOf = args[i + 1];
      i += 1;
    }
  }

  return { out, referencePath, asOf };
}

function currentDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

function emptyReferenceBundle(reason: string): ReferenceBundle {
  return {
    version: `${MISSING_REFERENCE_VERSION}:${reason}`,
    areas: [],
    relations: [],
    sourceAreaKinds: {},
  };
}

async function loadReferences(referencePath: string | null): Promise<ReferenceBundle> {
  if (!referencePath) return emptyReferenceBundle('not-configured');
  try {
    const raw = await readFile(path.resolve(process.cwd(), referencePath), 'utf-8');
    const parsed = JSON.parse(raw) as ReferenceBundle;
    validateReferenceBundle(parsed);
    return parsed;
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') {
      return emptyReferenceBundle('artifact-not-found');
    }
    throw error;
  }
}

function assertLocalReadDatabase(urlValue: string | undefined): void {
  if (!urlValue) {
    throw new Error('DATABASE_URL is required for waste area audit.');
  }
  const parsed = new URL(urlValue);
  const isLocalHost = parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost';
  if (!isLocalHost || parsed.port !== '3307') {
    throw new Error('Waste area audit only reads a local database target on localhost:3307.');
  }
}

async function writeJson(outPath: string | null, value: unknown): Promise<void> {
  const text = `${JSON.stringify(value, null, 2)}\n`;
  if (!outPath) {
    process.stdout.write(text);
    return;
  }
  const resolved = path.resolve(process.cwd(), outPath);
  await mkdir(path.dirname(resolved), { recursive: true });
  await writeFile(resolved, text, 'utf-8');
}

async function main(): Promise<void> {
  await import('dotenv/config');
  const options = parseCliOptions(process.argv.slice(2));
  assertLocalReadDatabase(process.env.DATABASE_URL);

  const [{ default: prisma }, references] = await Promise.all([
    import('../lib/prisma.js'),
    loadReferences(options.referencePath),
  ]);
  try {
    const rows = await readAuditRows(prisma.wasteSchedule);
    const report = auditWasteAreas(rows, references, options.asOf);
    await writeJson(options.out, report);
  } finally {
    await prisma.$disconnect();
  }
}

if (isCliEntrypoint(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
