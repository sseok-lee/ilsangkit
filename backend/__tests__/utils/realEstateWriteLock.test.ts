import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { tmpdir } from 'node:os';
import { hostname } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { afterEach, describe, expect, it } from 'vitest';
import { recoverRealEstateWriteLock, withRealEstateWriteLock } from '../../src/utils/realEstateWriteLock.js';

const execFileAsync = promisify(execFile);

async function runLockChild(lockDir: string, holdMs: number): Promise<{ stdout: string; stderr: string; code: number }> {
  const script = `
    import { withRealEstateWriteLock } from './src/utils/realEstateWriteLock.ts';
    try {
      await withRealEstateWriteLock('child', async () => {
        console.log('entered');
        await new Promise((resolve) => setTimeout(resolve, ${holdMs}));
      });
      process.exit(0);
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(7);
    }
  `;
  try {
    const { stdout, stderr } = await execFileAsync(
      process.execPath,
      ['--import', 'tsx', '--input-type=module', '-e', script],
      { cwd: process.cwd(), env: { ...process.env, REAL_ESTATE_WRITE_LOCK_DIR: lockDir } },
    );
    return { stdout, stderr, code: 0 };
  } catch (error) {
    const err = error as { stdout?: string; stderr?: string; code?: number };
    return { stdout: err.stdout ?? '', stderr: err.stderr ?? '', code: err.code ?? 1 };
  }
}

afterEach(() => {
  delete process.env.REAL_ESTATE_WRITE_LOCK_DIR;
  delete process.env.REAL_ESTATE_WRITE_LOCK_TOKEN;
});

describe('withRealEstateWriteLock', () => {
  it('allows only one child process into the critical section', async () => {
    const lockDir = mkdtempSync(join(tmpdir(), 'real-estate-lock-'));
    try {
      const [a, b] = await Promise.all([runLockChild(lockDir, 250), runLockChild(lockDir, 250)]);
      const entered = [a, b].filter((r) => r.stdout.includes('entered'));
      const busy = [a, b].filter((r) => r.stderr.includes('Real estate write lock busy'));
      expect(entered).toHaveLength(1);
      expect(busy).toHaveLength(1);
    } finally {
      rmSync(lockDir, { recursive: true, force: true });
    }
  });

  it('permits nested calls in the same async owner while rejecting unrelated same-process callers', async () => {
    const lockDir = mkdtempSync(join(tmpdir(), 'real-estate-lock-'));
    process.env.REAL_ESTATE_WRITE_LOCK_DIR = lockDir;
    let release!: () => void;
    const entered = new Promise<void>((resolve) => {
      void withRealEstateWriteLock('outer', async () => {
        await withRealEstateWriteLock('nested', async () => {
          resolve();
        });
        await new Promise<void>((resolveRelease) => { release = resolveRelease; });
      });
    });

    try {
      await entered;
      await expect(withRealEstateWriteLock('parallel', async () => 'nope')).rejects.toThrow(/Real estate write lock busy/);
    } finally {
      release();
      rmSync(lockDir, { recursive: true, force: true });
    }
  });

  it('does not steal a leftover lock merely because the owner pid is dead', async () => {
    const lockDir = mkdtempSync(join(tmpdir(), 'real-estate-lock-'));
    try {
      const lockPath = join(lockDir, 'real-estate-write.lock');
      mkdirSync(lockPath);
      writeFileSync(join(lockPath, 'owner.json'), JSON.stringify({ hostname: 'stale-host', pid: 999999, startedAt: 'old', token: 'stale', label: 'old' }));

      const result = await runLockChild(lockDir, 1);

      expect(result.code).toBe(7);
      expect(result.stderr).toContain('Real estate write lock busy');
    } finally {
      rmSync(lockDir, { recursive: true, force: true });
    }
  });

  it('recovers only a matching same-host dead-owner token', async () => {
    const lockDir = mkdtempSync(join(tmpdir(), 'real-estate-lock-'));
    process.env.REAL_ESTATE_WRITE_LOCK_DIR = lockDir;
    try {
      const lockPath = join(lockDir, 'real-estate-write.lock');
      mkdirSync(lockPath);
      writeFileSync(join(lockPath, 'owner.json'), JSON.stringify({ hostname: hostname(), pid: 999999, startedAt: '2026-01-01T00:00:00.000Z', token: 'dead-token', label: 'old' }));

      await expect(recoverRealEstateWriteLock('wrong-token')).resolves.toBe(false);
      await expect(recoverRealEstateWriteLock('dead-token')).resolves.toBe(true);
      await expect(withRealEstateWriteLock('after-recovery', async () => 'ok')).resolves.toBe('ok');
    } finally {
      rmSync(lockDir, { recursive: true, force: true });
    }
  });




  it('does not remove another process recovery guard when this recovery loses guard acquisition', async () => {
    const lockDir = mkdtempSync(join(tmpdir(), 'real-estate-lock-'));
    process.env.REAL_ESTATE_WRITE_LOCK_DIR = lockDir;
    try {
      const lockPath = join(lockDir, 'real-estate-write.lock');
      mkdirSync(lockPath);
      writeFileSync(join(lockPath, 'owner.json'), JSON.stringify({ hostname: hostname(), pid: 999999, startedAt: '2026-01-01T00:00:00.000Z', token: 'guard-token', label: 'old' }));
      const recoveryPath = join(lockDir, 'real-estate-write.recovering');
      mkdirSync(recoveryPath);
      writeFileSync(join(recoveryPath, 'owner.json'), JSON.stringify({ hostname: hostname(), pid: 12345, token: 'winner-token' }));

      await expect(recoverRealEstateWriteLock('guard-token')).resolves.toBe(false);
      expect(readFileSync(join(recoveryPath, 'owner.json'), 'utf8')).toContain('winner-token');
      expect(readFileSync(join(lockPath, 'owner.json'), 'utf8')).toContain('guard-token');
    } finally {
      rmSync(lockDir, { recursive: true, force: true });
    }
  });

  it('serializes stale-owner recovery and never removes a newly acquired writer lock', async () => {
    const lockDir = mkdtempSync(join(tmpdir(), 'real-estate-lock-'));
    process.env.REAL_ESTATE_WRITE_LOCK_DIR = lockDir;
    try {
      const lockPath = join(lockDir, 'real-estate-write.lock');
      mkdirSync(lockPath);
      writeFileSync(join(lockPath, 'owner.json'), JSON.stringify({ hostname: hostname(), pid: 999999, startedAt: '2026-01-01T00:00:00.000Z', token: 'race-token', label: 'old' }));

      const recoveries = await Promise.all([
        recoverRealEstateWriteLock('race-token'),
        recoverRealEstateWriteLock('race-token'),
      ]);
      expect(recoveries.filter(Boolean)).toHaveLength(1);

      let nestedOwner = '';
      await withRealEstateWriteLock('new-owner', async () => {
        nestedOwner = readFileSync(join(lockPath, 'owner.json'), 'utf8');
        await expect(recoverRealEstateWriteLock('race-token')).resolves.toBe(false);
        expect(readFileSync(join(lockPath, 'owner.json'), 'utf8')).toBe(nestedOwner);
      });
    } finally {
      rmSync(lockDir, { recursive: true, force: true });
    }
  });

  it('refuses to recover a foreign-host owner even with a matching token', async () => {
    const lockDir = mkdtempSync(join(tmpdir(), 'real-estate-lock-'));
    process.env.REAL_ESTATE_WRITE_LOCK_DIR = lockDir;
    try {
      const lockPath = join(lockDir, 'real-estate-write.lock');
      mkdirSync(lockPath);
      writeFileSync(join(lockPath, 'owner.json'), JSON.stringify({ hostname: 'foreign-host', pid: 999999, startedAt: '2026-01-01T00:00:00.000Z', token: 'foreign-token', label: 'old' }));

      await expect(recoverRealEstateWriteLock('foreign-token')).resolves.toBe(false);
      expect(readFileSync(join(lockPath, 'owner.json'), 'utf8')).toContain('foreign-token');
    } finally {
      rmSync(lockDir, { recursive: true, force: true });
    }
  });
});
