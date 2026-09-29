import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadValidatedWasteReferences } from '../../src/services/wasteReferenceLoader.js';

const evidence = {
  url: 'https://www.data.go.kr/ref',
  version: 'fixture',
  effectiveFrom: '2020-01-01',
  effectiveTo: null,
  note: 'fixture',
};

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

describe('loadValidatedWasteReferences', () => {
  it('rejects a manifest whose sha does not match the reference version', async () => {
    const dir = path.join(tmpdir(), `waste-reference-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    await mkdir(dir, { recursive: true });
    const manifestRaw = JSON.stringify({ schemaVersion: 1, normalizedContentHash: 'not-version' }, null, 2);
    const reference = {
      version: '0'.repeat(64),
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
      referenceVersion: reference.version,
      referenceSha256: sha256(referenceRaw),
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

    await expect(loadValidatedWasteReferences({ referencePath, manifestPath, checksumsPath }))
      .rejects.toThrow(/manifest sha/i);
  });
});
