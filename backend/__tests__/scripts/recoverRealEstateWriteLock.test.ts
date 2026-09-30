import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { hostname } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { runRecoveryCli } from '../../src/scripts/recoverRealEstateWriteLock.js';

let lockDir: string | undefined;

afterEach(() => {
  delete process.env.REAL_ESTATE_WRITE_LOCK_DIR;
  delete process.env.REAL_ESTATE_WRITE_LOCK_TOKEN;
  if (lockDir) rmSync(lockDir, { recursive: true, force: true });
  lockDir = undefined;
});

function setupDeadOwner(token: string): string {
  lockDir = mkdtempSync(join(tmpdir(), 'real-estate-recover-cli-'));
  process.env.REAL_ESTATE_WRITE_LOCK_DIR = lockDir;
  const lockPath = join(lockDir, 'real-estate-write.lock');
  mkdirSync(lockPath);
  writeFileSync(join(lockPath, 'owner.json'), JSON.stringify({ hostname: hostname(), pid: 999999, startedAt: '2026-01-01T00:00:00.000Z', token, label: 'old' }));
  return lockPath;
}

describe('recoverRealEstateWriteLock CLI', () => {
  it('returns usage exit code when token is missing', async () => {
    await expect(runRecoveryCli([])).resolves.toEqual({
      exitCode: 2,
      message: 'Usage: recoverRealEstateWriteLock --token <expected-owner-token>',
    });
  });

  it('recovers a matching dead-owner token', async () => {
    const lockPath = setupDeadOwner('cli-token');

    await expect(runRecoveryCli(['--token', 'cli-token'])).resolves.toEqual({
      exitCode: 0,
      message: 'Real estate write lock recovered',
    });
    expect(() => readFileSync(join(lockPath, 'owner.json'), 'utf8')).toThrow();
  });

  it('fails closed for a mismatched token and leaves the lock intact', async () => {
    const lockPath = setupDeadOwner('expected-token');

    await expect(runRecoveryCli(['--token=wrong-token'])).resolves.toEqual({
      exitCode: 1,
      message: 'Real estate write lock was not recovered',
    });
    expect(readFileSync(join(lockPath, 'owner.json'), 'utf8')).toContain('expected-token');
  });
});
