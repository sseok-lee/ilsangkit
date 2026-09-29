#!/usr/bin/env tsx

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { prisma } from '../lib/prisma.js';
import { installRuntimeGuard } from './_runtimeGuard.js';
import { publishWasteGeneration } from '../services/wastePublicationService.js';

interface PublishWasteGenerationCliOptions {
  generationId: string;
  approvalReportHash: string;
  expectedBase: string | null;
}

export async function runPublishWasteGenerationCli(argv: readonly string[]): Promise<void> {
  const options = parsePublishWasteGenerationArgs(argv);
  await publishWasteGeneration(
    options.generationId,
    options.expectedBase,
    options.approvalReportHash
  );
}

export function parsePublishWasteGenerationArgs(argv: readonly string[]): PublishWasteGenerationCliOptions {
  const values = parseStrictPublishArgs(argv);
  const generationId = requireCliValue(values, 'generation-id');
  const approvalReportHash = requireCliValue(values, 'approval-report-hash');
  const expectedBaseRaw = requireCliValue(values, 'expected-base');

  return {
    generationId,
    approvalReportHash,
    expectedBase: expectedBaseRaw === 'none' ? null : expectedBaseRaw,
  };
}

function parseStrictPublishArgs(argv: readonly string[]): Map<string, string> {
  const allowed = new Set(['generation-id', 'approval-report-hash', 'expected-base']);
  const values = new Map<string, string>();

  for (const arg of argv) {
    if (!arg.startsWith('--')) {
      throw new Error(`Unknown argument: ${arg}`);
    }
    const separatorIndex = arg.indexOf('=');
    if (separatorIndex === -1) {
      const name = arg.slice(2);
      if (allowed.has(name)) {
        throw new Error(`--${name}= is required`);
      }
      throw new Error(`Unknown argument: ${arg}`);
    }
    const name = arg.slice(2, separatorIndex);
    if (!allowed.has(name)) {
      throw new Error(`Unknown argument: --${name}`);
    }
    if (values.has(name)) {
      throw new Error(`Duplicate argument: --${name}`);
    }
    values.set(name, arg.slice(separatorIndex + 1));
  }

  return values;
}

function requireCliValue(values: ReadonlyMap<string, string>, name: string): string {
  const value = values.get(name);
  if (value === undefined || value.trim() === '') {
    throw new Error(`--${name} is required`);
  }
  return value;
}

const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  installRuntimeGuard({ maxMinutes: 30, name: 'publishWasteGeneration', prisma });
  runPublishWasteGenerationCli(process.argv.slice(2))
    .then(() => {
      console.info('[waste:publish] Publication completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('[waste:publish] Publication failed:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    });
}
