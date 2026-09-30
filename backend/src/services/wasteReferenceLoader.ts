import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { validateReferenceBundle } from '../scripts/auditWasteAreas.js';
import type { AreaLevel, ReferenceBundle } from '../types/wasteArea.js';

export interface WasteReferenceInput {
  referencePath: string;
  manifestPath: string;
  checksumsPath: string;
}

export interface WasteReferenceMetadata {
  referenceSha256: string;
  manifestSha256: string;
  checksumsSha256: string;
  manifestVersion: string;
}

export interface LoadedWasteReferences {
  references: ReferenceBundle;
  metadata: WasteReferenceMetadata;
}

const VALID_LEVELS = new Set<AreaLevel>(['province', 'district', 'dong', 'ri']);

export async function loadValidatedWasteReferences(input: WasteReferenceInput): Promise<LoadedWasteReferences> {
  const [referenceRaw, manifestRaw, checksumsRaw] = await Promise.all([
    readFile(path.resolve(input.referencePath), 'utf8'),
    readFile(path.resolve(input.manifestPath), 'utf8'),
    readFile(path.resolve(input.checksumsPath), 'utf8'),
  ]);
  const references = JSON.parse(referenceRaw) as ReferenceBundle;
  JSON.parse(manifestRaw) as { normalizedContentHash?: unknown };
  const checksums = JSON.parse(checksumsRaw) as {
    referenceVersion?: unknown;
    referenceSha256?: unknown;
    versionManifest?: unknown;
  };

  validateStrictWasteReferences(references);

  const referenceSha256 = sha256(referenceRaw);
  const manifestSha256 = sha256(manifestRaw);
  const checksumsSha256 = sha256(checksumsRaw);
  if (typeof checksums.referenceSha256 !== 'string' || checksums.referenceSha256 !== referenceSha256) {
    throw new Error('validated waste reference checksum mismatch');
  }
  if (typeof checksums.referenceVersion !== 'string' || checksums.referenceVersion !== references.version) {
    throw new Error('validated waste reference version mismatch');
  }
  if (manifestSha256 !== references.version || manifestSha256 !== checksums.referenceVersion) {
    throw new Error('validated waste reference manifest sha mismatch');
  }
  if (typeof checksums.versionManifest === 'string' && checksums.versionManifest !== path.basename(input.manifestPath)) {
    throw new Error('validated waste reference manifest filename mismatch');
  }
  return {
    references,
    metadata: {
      referenceSha256,
      manifestSha256,
      checksumsSha256,
      manifestVersion: references.version,
    },
  };
}

export function validateStrictWasteReferences(references: ReferenceBundle): void {
  validateReferenceBundle(references);
  const includedKeys = new Set<string>();
  for (const area of references.areas) {
    if (!area.level || !VALID_LEVELS.has(area.level)) {
      throw new Error(`Waste reference ${area.key} is missing required official level`);
    }
    if (area.key !== `${area.kind}:${area.code}`) {
      throw new Error(`Waste reference ${area.key} does not match kind/code identity`);
    }
    includedKeys.add(area.key);
  }
  for (const relation of references.relations) {
    if (relation.fromKey && !includedKeys.has(relation.fromKey)) {
      throw new Error(`Waste relation source ${relation.fromKey} is not included in reference bundle`);
    }
    if (!includedKeys.has(relation.toKey)) {
      throw new Error(`Waste relation target ${relation.toKey} is not included in reference bundle`);
    }
  }
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
