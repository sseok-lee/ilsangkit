import type { WasteReferenceInput } from '../services/wasteReferenceLoader.js';

type EnvLike = Record<string, string | undefined>;

export interface WasteSyncCliOptions {
  serviceKey: string;
  dryRun: boolean;
  referenceInput: WasteReferenceInput;
  reportOut: string;
}

export function resolveWasteSyncCliOptions(
  argv: readonly string[],
  env: EnvLike
): WasteSyncCliOptions {
  rejectDeprecatedPublicationFlags(argv);
  const dryRun = argv.includes('--dry-run');
  const serviceKey = resolveRequiredValue(argv, env, {
    cliName: 'service-key',
    envName: 'OPENAPI_SERVICE_KEY',
  });
  const referencePath = resolveRequiredValue(argv, env, {
    cliName: 'reference-path',
    envName: 'WASTE_REFERENCE_PATH',
  });
  const manifestPath = resolveRequiredValue(argv, env, {
    cliName: 'reference-manifest-path',
    envName: 'WASTE_REFERENCE_MANIFEST_PATH',
  });
  const checksumsPath = resolveRequiredValue(argv, env, {
    cliName: 'reference-checksums-path',
    envName: 'WASTE_REFERENCE_CHECKSUMS_PATH',
  });
  const reportOut = resolveRequiredValue(argv, env, {
    cliName: 'report-out',
    envName: 'WASTE_REPORT_OUT',
  });

  return {
    serviceKey,
    dryRun,
    referenceInput: { referencePath, manifestPath, checksumsPath },
    reportOut,
  };
}

function rejectDeprecatedPublicationFlags(argv: readonly string[]): void {
  const deprecated = ['approval-report-hash', 'expected-base'];
  for (const name of deprecated) {
    if (argv.some((value) => value === `--${name}` || value.startsWith(`--${name}=`))) {
      throw new Error(`Trash sync only prepares candidates. Publish with npm run waste:publish using --generation-id, --approval-report-hash, and --expected-base.`);
    }
  }
}

function resolveRequiredValue(
  argv: readonly string[],
  names: EnvLike,
  option: { cliName: string; envName: string }
): string {
  const cliValue = readCliValue(argv, option.cliName);
  if (cliValue !== undefined) {
    return requireNonBlank(cliValue, `--${option.cliName}`);
  }
  return requireNonBlank(names[option.envName], option.envName);
}

function readCliValue(argv: readonly string[], name: string): string | undefined {
  const prefix = `--${name}=`;
  const arg = argv.find((value) => value.startsWith(prefix));
  return arg?.slice(prefix.length);
}

function requireNonBlank(value: string | undefined, label: string): string {
  if (value === undefined || value.trim() === '') {
    throw new Error(`${label} is required`);
  }
  return value;
}
