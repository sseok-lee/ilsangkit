import { describe, expect, it } from 'vitest';
import { resolveWasteSyncCliOptions } from '../../src/scripts/wasteSyncOptions.js';

const env = {
  OPENAPI_SERVICE_KEY: 'env-service-key',
  WASTE_REFERENCE_PATH: '/env/reference.json',
  WASTE_REFERENCE_MANIFEST_PATH: '/env/manifest.json',
  WASTE_REFERENCE_CHECKSUMS_PATH: '/env/checksums.json',
  WASTE_REPORT_OUT: '/env/report.json',
};

describe('resolveWasteSyncCliOptions', () => {
  it('lets CLI values override environment values without touching external systems', () => {
    const options = resolveWasteSyncCliOptions([
      '--service-key=cli-service-key',
      '--reference-path=/cli/reference.json',
      '--reference-manifest-path=/cli/manifest.json',
      '--reference-checksums-path=/cli/checksums.json',
      '--report-out=/cli/report.json',
      '--dry-run',
    ], env);

    expect(options).toEqual({
      serviceKey: 'cli-service-key',
      dryRun: true,
      referenceInput: {
        referencePath: '/cli/reference.json',
        manifestPath: '/cli/manifest.json',
        checksumsPath: '/cli/checksums.json',
      },
      reportOut: '/cli/report.json',
    });
  });

  it('rejects a blank explicit reference path instead of falling back to env', () => {
    expect(() => resolveWasteSyncCliOptions([
      '--reference-path=',
      '--reference-manifest-path=/cli/manifest.json',
      '--reference-checksums-path=/cli/checksums.json',
      '--report-out=/cli/report.json',
    ], env)).toThrow(/reference-path/i);
  });

  it('requires every reference path, report path, and service key', () => {
    expect(() => resolveWasteSyncCliOptions([], {})).toThrow(/OPENAPI_SERVICE_KEY/i);
    expect(() => resolveWasteSyncCliOptions(['--service-key=key'], {})).toThrow(/WASTE_REFERENCE_PATH/i);
    expect(() => resolveWasteSyncCliOptions([
      '--service-key=key',
      '--reference-path=/tmp/reference.json',
      '--reference-manifest-path=/tmp/manifest.json',
      '--reference-checksums-path=/tmp/checksums.json',
    ], {})).toThrow(/WASTE_REPORT_OUT/i);
  });

  it('rejects deprecated publication flags before resolving collection inputs', () => {
    expect(() => resolveWasteSyncCliOptions([
      `--approval-report-hash=${'a'.repeat(64)}`,
    ], {})).toThrow(/waste:publish/i);

    expect(() => resolveWasteSyncCliOptions([
      '--expected-base',
      'active-generation',
    ], {})).toThrow(/waste:publish/i);
  });
});
