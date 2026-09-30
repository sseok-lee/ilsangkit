#!/usr/bin/env tsx

import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { recoverRealEstateWriteLock } from '../utils/realEstateWriteLock.js';

export interface RecoveryCliResult {
  exitCode: number;
  message: string;
}

function tokenFromArgs(argv: string[]): string | null {
  const tokenEquals = argv.find((arg) => arg.startsWith('--token='));
  if (tokenEquals) return tokenEquals.slice('--token='.length).trim() || null;
  const tokenIndex = argv.indexOf('--token');
  if (tokenIndex !== -1) return argv[tokenIndex + 1]?.trim() || null;
  return null;
}

export async function runRecoveryCli(argv = process.argv.slice(2)): Promise<RecoveryCliResult> {
  const token = tokenFromArgs(argv);
  if (!token) {
    return { exitCode: 2, message: 'Usage: recoverRealEstateWriteLock --token <expected-owner-token>' };
  }

  try {
    const recovered = await recoverRealEstateWriteLock(token);
    if (!recovered) return { exitCode: 1, message: 'Real estate write lock was not recovered' };
    return { exitCode: 0, message: 'Real estate write lock recovered' };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { exitCode: 2, message };
  }
}

const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === resolve(__filename)) {
  const result = await runRecoveryCli();
  const write = result.exitCode === 0 ? console.info : console.error;
  write(result.message);
  process.exitCode = result.exitCode;
}
