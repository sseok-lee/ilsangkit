import prisma from '../lib/prisma.js';
import {
  hashRealEstatePublicPath,
  isDeferredRealEstateUrlEvidence,
  planRealEstatePublicUrls,
  realEstateBasePath,
  type ExistingRealEstateUrlMapping,
  type PlannedRealEstatePublicUrl,
  type RealEstateUrlCandidate,
} from '../lib/realEstateUrlPlan.js';

const HASH_SEGMENT_RE = /^[a-f0-9]{64}$/i;
const REAL_ESTATE_PATH_RE = /^\/real-estate\/([^/]+)\/[^/]+\/[^/]+\/[^/]+(?:\/[^/]+)?$/;
const INSERT_BATCH_SIZE = 500;

interface RegistryDb {
  $queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T>;
  $executeRawUnsafe(query: string, ...values: unknown[]): Promise<unknown>;
}

type RealEstateUrlEnv = Record<string, string | undefined>;

interface RegistryRow {
  type: string;
  buildingKey: string;
  bjdCode: string;
  buildingName: string;
  canonicalPath: string;
  basePath?: string;
  evidence?: unknown;
}

export interface DeferredRealEstateIdentity {
  type: string;
  bjdCode: string;
  buildingName: string;
  canonicalPath: string;
  legacyGrouped: true;
}

export function isPreservedRealEstateUrlMode(env: RealEstateUrlEnv = process.env): boolean {
  const value = env.REAL_ESTATE_URL_MODE;
  if (value === undefined || value === '' || value === 'keyed') return false;
  if (value === 'preserved') return true;
  throw new Error('REAL_ESTATE_URL_MODE must be unset, empty, "keyed", or "preserved"');
}

export async function attachRealEstateCanonicalPaths<T extends { type?: string; buildingKey?: string | null }>(
  rows: T[],
  type?: string,
): Promise<Array<T & { canonicalPath?: string }>> {
  if (!isPreservedRealEstateUrlMode()) return rows;
  const missingIdentity = rows.find((row) => !(row.type ?? type) || !row.buildingKey);
  if (missingIdentity) {
    throw new Error('REAL_ESTATE_URL_MODE=preserved requires type and buildingKey for real estate rows');
  }
  const keyed = rows
    .map((row, index) => ({ row, index, type: row.type ?? type, buildingKey: row.buildingKey ?? null }))
    .filter((entry): entry is { row: T; index: number; type: string; buildingKey: string } =>
      Boolean(entry.type && entry.buildingKey)
    );
  if (keyed.length === 0) return rows;

  const found = new Map<string, string>();
  for (const chunk of chunks(keyed, 500)) {
    const predicates = chunk.map(() => '(type = ? AND buildingKey = ?)').join(' OR ');
    const params = chunk.flatMap((entry) => [entry.type, entry.buildingKey]);
    const dbRows = await prisma.$queryRawUnsafe<Array<Pick<RegistryRow, 'type' | 'buildingKey' | 'canonicalPath'>>>(
      `SELECT type, buildingKey, canonicalPath FROM RealEstatePublicUrl WHERE ${predicates}`,
      ...params,
    );
    for (const dbRow of dbRows) found.set(mappingKey(dbRow.type, dbRow.buildingKey), dbRow.canonicalPath);
  }

  return rows.map((row) => {
    const rowType = row.type ?? type;
    if (!rowType || !row.buildingKey) return row;
    const canonicalPath = found.get(mappingKey(rowType, row.buildingKey));
    if (!canonicalPath) {
      throw new Error(`Missing RealEstatePublicUrl mapping for ${rowType}:${row.buildingKey}`);
    }
    return { ...row, canonicalPath };
  });
}

export async function getRealEstateCanonicalPath(type: string, key: string): Promise<string | null> {
  const rows = await prisma.$queryRawUnsafe<Array<{ canonicalPath: string }>>(
    'SELECT canonicalPath FROM RealEstatePublicUrl WHERE type = ? AND buildingKey = ? LIMIT 1',
    type,
    key,
  );
  return rows[0]?.canonicalPath ?? null;
}

export async function resolveRealEstatePublicPath(path: string): Promise<{
  type: string;
  buildingKey?: string;
  bjdCode: string;
  buildingName: string;
  canonicalPath: string;
  redirect: boolean;
  legacyGrouped?: true;
} | null> {
  const normalizedPath = normalizeRealEstatePath(path);
  if (!normalizedPath) return null;
  const match = normalizedPath.match(REAL_ESTATE_PATH_RE);
  if (!match) return null;
  const segments = normalizedPath.split('/');
  if (segments.length === 7 && HASH_SEGMENT_RE.test(segments[6] ?? '')) return null;

  const exactRows = await prisma.$queryRawUnsafe<RegistryRow[]>(
    'SELECT type, buildingKey, bjdCode, buildingName, canonicalPath, basePath, evidence FROM RealEstatePublicUrl WHERE pathHash = ?',
    hashRealEstatePublicPath(normalizedPath),
  );
  const exactMatches = exactRows.filter((row) => row.canonicalPath === normalizedPath);
  const deferred = deferredIdentityFromRows(exactMatches as Array<RegistryRow & { basePath: string }>);
  if (deferred) return { ...deferred, redirect: normalizedPath !== path };
  if (exactMatches.length === 1) return toResolveResult(exactMatches[0], normalizedPath !== path);
  if (exactMatches.length > 1) return null;

  if (segments.length === 7) return null;
  const deferredBase = await resolveDeferredBasePath(normalizedPath, match[1]);
  return deferredBase ? { ...deferredBase, redirect: normalizedPath !== path } : null;
}

export async function getDeferredRealEstateIdentity(
  type: string,
  bjdCode: string,
  buildingName: string,
): Promise<DeferredRealEstateIdentity | null> {
  if (!isPreservedRealEstateUrlMode()) return null;
  if (!bjdCode || !buildingName) return null;
  const rows = await prisma.$queryRawUnsafe<Array<RegistryRow & { basePath: string }>>(
    `SELECT type, buildingKey, bjdCode, buildingName, canonicalPath, basePath, evidence
       FROM RealEstatePublicUrl
      WHERE type = ? AND bjdCode = ? AND buildingName = ?
      ORDER BY buildingKey`,
    type,
    bjdCode,
    buildingName,
  );
  return deferredIdentityFromRows(rows);
}

export async function assertRealEstateUrlsReady(env: RealEstateUrlEnv = process.env): Promise<void> {
  if (!isPreservedRealEstateUrlMode(env)) return;
  if (env.REAL_ESTATE_SUMMARY_MODE === 'compatibility') {
    throw new Error('REAL_ESTATE_URL_MODE=preserved requires REAL_ESTATE_SUMMARY_MODE=address');
  }

  await assertReadyWithDb(prisma, env, true);
}

export async function appendRealEstateUrlsForSummaryBatch(
  tx: RegistryDb,
  type: string,
  city: string,
  env: RealEstateUrlEnv = process.env,
): Promise<{ scanned: number; inserted: number; blockers: Array<{ kind: string; basePath: string; buildingKeys: string[] }> }> {
  if (!isPreservedRealEstateUrlMode(env)) return { scanned: 0, inserted: 0, blockers: [] };
  const state = await assertReadyWithDb(tx, env, false);
  const current = await tx.$queryRawUnsafe<RealEstateUrlCandidate[]>(
    `SELECT s.type, s.buildingKey, s.bjdCode, s.city, s.district, s.buildingName, s.dongName, s.jibun
       FROM RealEstateBuildingSummaryV2 s
       LEFT JOIN RealEstatePublicUrl u
         ON u.type = s.type AND u.buildingKey = s.buildingKey
      WHERE s.type = ? AND s.city = ? AND u.id IS NULL
      ORDER BY s.id`,
    type,
    city,
  );
  if (current.length === 0) return { scanned: 0, inserted: 0, blockers: [] };

  const basePairs = [...new Map(current.map((candidate) => {
    const basePath = realEstateBasePath(candidate);
    return [`${candidate.type}\x1f${basePath}`, { type: candidate.type, basePath, basePathHash: hashRealEstatePublicPath(basePath) }];
  })).values()];
  const existing = await readExistingForBases(tx, basePairs);
  const plan = planRealEstatePublicUrls({
    existing,
    current,
    legacyBaseline: [],
    sourceFingerprint: state.sourceFingerprint,
    baselineProvenance: state.baselineProvenance,
    generatedAt: new Date(),
  });
  if (plan.blockers.length > 0) {
    throw new Error(`Cannot append real estate public URLs with ${plan.blockers.length} unresolved URL blockers`);
  }
  await insertMappings(tx, plan.toCreate);
  return { scanned: current.length, inserted: plan.toCreate.length, blockers: [] };
}

async function assertReadyWithDb(db: Pick<RegistryDb, '$queryRawUnsafe'>, env: RealEstateUrlEnv, checkMissingMappings: boolean): Promise<{
  sourceFingerprint: string;
  baselineProvenance: string;
}> {
  if (env.REAL_ESTATE_SUMMARY_MODE === 'compatibility') {
    throw new Error('REAL_ESTATE_URL_MODE=preserved requires REAL_ESTATE_SUMMARY_MODE=address');
  }
  const stateRows = await db.$queryRawUnsafe<Array<{
    status: string;
    sourceFingerprint: string;
    baselineProvenance: string | null;
    validatedAt: Date | null;
  }>>(
    'SELECT status, sourceFingerprint, baselineProvenance, validatedAt FROM RealEstatePublicUrlState WHERE id = 1 LIMIT 1'
  );
  const state = stateRows[0];
  if (!state || state.status !== 'ready' || !state.validatedAt) {
    throw new Error('Real estate public URL registry is not ready');
  }
  if (!state.baselineProvenance) {
    throw new Error('Real estate public URL registry is missing baseline provenance');
  }

  if (checkMissingMappings) {
    const missingRows = await db.$queryRawUnsafe<Array<{ cnt: bigint | number }>>(
      `SELECT COUNT(*) AS cnt
         FROM RealEstateBuildingSummaryV2 s
         LEFT JOIN RealEstatePublicUrl u
           ON u.type = s.type AND u.buildingKey = s.buildingKey
        WHERE u.id IS NULL`
    );
    const missing = Number(missingRows[0]?.cnt ?? 0);
    if (missing > 0) {
      throw new Error(`Real estate public URL registry is missing ${missing} V2 mappings`);
    }
  }
  return { sourceFingerprint: state.sourceFingerprint, baselineProvenance: state.baselineProvenance };
}

async function readExistingForBases(
  db: Pick<RegistryDb, '$queryRawUnsafe'>,
  bases: Array<{ type: string; basePath: string; basePathHash: string }>,
): Promise<ExistingRealEstateUrlMapping[]> {
  const existing: ExistingRealEstateUrlMapping[] = [];
  for (const chunk of chunks(bases, 200)) {
    const predicates = chunk.map(() => '(type = ? AND basePathHash = ?)').join(' OR ');
    const params = chunk.flatMap((base) => [base.type, base.basePathHash]);
    const rows = await db.$queryRawUnsafe<ExistingRealEstateUrlMapping[]>(
      `SELECT type, buildingKey, bjdCode, buildingName, canonicalPath, basePath, dongName, jibun, evidence
         FROM RealEstatePublicUrl
        WHERE ${predicates}`,
      ...params,
    );
    for (const row of rows) {
      if (chunk.some((base) => base.type === row.type && base.basePath === row.basePath)) existing.push(row);
    }
  }
  return existing;
}

async function insertMappings(db: Pick<RegistryDb, '$executeRawUnsafe'>, rows: PlannedRealEstatePublicUrl[]): Promise<void> {
  for (const batch of chunks(rows, INSERT_BATCH_SIZE)) {
    const values = batch.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CAST(? AS JSON), CAST(? AS JSON), ?, ?)').join(', ');
    const params = batch.flatMap((row) => [
      row.type,
      row.buildingKey,
      row.bjdCode,
      row.buildingName,
      row.basePath,
      row.basePathHash,
      row.canonicalPath,
      row.pathHash,
      row.dongName,
      row.jibun,
      JSON.stringify(row.addressSnapshot),
      JSON.stringify(row.evidence),
      row.sourceFingerprint,
      row.baselineProvenance,
    ]);
    await db.$executeRawUnsafe(
      `INSERT INTO \`RealEstatePublicUrl\`
        (type, buildingKey, bjdCode, buildingName, basePath, basePathHash, canonicalPath, pathHash, dongName, jibun, addressSnapshot, evidence, sourceFingerprint, baselineProvenance)
       VALUES ${values}`,
      ...params,
    );
  }
}

function normalizeRealEstatePath(path: string): string | null {
  const rawPath = (path.split(/[?#]/, 1)[0] || '').trim();
  if (!rawPath.startsWith('/real-estate/')) return null;
  const segments = rawPath.split('/');
  if (segments.length !== 6 && segments.length !== 7) return null;
  const normalized = segments.map((segment, index) => {
    if (index !== 5 && index !== 6) return segment;
    try {
      return encodeURIComponent(decodeURIComponent(segment).normalize('NFC'));
    } catch {
      return encodeURIComponent(segment.normalize('NFC'));
    }
  });
  return normalized.join('/');
}

async function resolveDeferredBasePath(
  normalizedPath: string,
  type: string,
): Promise<(DeferredRealEstateIdentity & { redirect: boolean }) | null> {
  const rows = await prisma.$queryRawUnsafe<Array<RegistryRow & { basePath: string }>>(
    `SELECT type, buildingKey, bjdCode, buildingName, canonicalPath, basePath, evidence
       FROM RealEstatePublicUrl
      WHERE type = ? AND basePathHash = ?
      ORDER BY buildingKey`,
    type,
    hashRealEstatePublicPath(normalizedPath),
  );
  const matchingRows = rows.filter((row) => row.basePath === normalizedPath);
  const identity = deferredIdentityFromRows(matchingRows);
  return identity ? { ...identity, redirect: false } : null;
}

function deferredIdentityFromRows(rows: Array<RegistryRow & { basePath: string }>): DeferredRealEstateIdentity | null {
  if (rows.length === 0) return null;
  if (!rows.every((row) => isDeferredRealEstateUrlEvidence(row.evidence))) return null;
  const types = new Set(rows.map((row) => row.type));
  const bjdCodes = new Set(rows.map((row) => row.bjdCode));
  const names = new Set(rows.map((row) => row.buildingName));
  const basePaths = new Set(rows.map((row) => row.basePath));
  if (types.size !== 1 || bjdCodes.size !== 1 || names.size !== 1 || basePaths.size !== 1) return null;
  return {
    type: rows[0].type,
    bjdCode: rows[0].bjdCode,
    buildingName: rows[0].buildingName,
    canonicalPath: rows[0].basePath,
    legacyGrouped: true,
  };
}

function toResolveResult(row: RegistryRow, redirect: boolean): {
  type: string;
  buildingKey: string;
  bjdCode: string;
  buildingName: string;
  canonicalPath: string;
  redirect: boolean;
} {
  return {
    type: row.type,
    buildingKey: row.buildingKey,
    bjdCode: row.bjdCode,
    buildingName: row.buildingName,
    canonicalPath: row.canonicalPath,
    redirect,
  };
}

function mappingKey(type: string, buildingKey: string): string {
  return `${type}\x1f${buildingKey}`;
}

function chunks<T>(rows: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < rows.length; i += size) result.push(rows.slice(i, i + size));
  return result;
}
