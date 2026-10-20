import { randomUUID } from 'node:crypto';
import { AsyncLocalStorage } from 'node:async_hooks';
import { execFile } from 'node:child_process';
import { hostname } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { readFileSync, rmSync } from 'node:fs';

interface LockOwner {
  hostname: string;
  pid: number;
  startedAt: string;
  token: string;
  label: string;
}

type ProcessState = 'alive' | 'dead' | 'forbidden' | 'unknown';

const LOCK_DIR_NAME = 'real-estate-write.lock';
const RECOVERY_DIR_NAME = 'real-estate-write.recovering';
const TOKEN_ENV = 'REAL_ESTATE_WRITE_LOCK_TOKEN';
const execFileAsync = promisify(execFile);
const lockContext = new AsyncLocalStorage<string>();
const currentHostname = hostname();
const currentProcessStartedAt = new Date(Date.now() - process.uptime() * 1000).toISOString();

function lockRoot(): string {
  const dir = process.env.REAL_ESTATE_WRITE_LOCK_DIR;
  if (!dir) throw new Error('REAL_ESTATE_WRITE_LOCK_DIR is required for real estate writers');
  return dir;
}

function lockPath(): string {
  return join(lockRoot(), LOCK_DIR_NAME);
}

function recoveryPath(): string {
  return join(lockRoot(), RECOVERY_DIR_NAME);
}

async function readOwner(path = lockPath()): Promise<LockOwner | null> {
  try {
    const parsed = JSON.parse(await readFile(join(path, 'owner.json'), 'utf8')) as Partial<LockOwner>;
    if (!parsed.hostname || typeof parsed.pid !== 'number' || !parsed.startedAt || !parsed.token || !parsed.label) {
      return null;
    }
    return parsed as LockOwner;
  } catch {
    return null;
  }
}

function processState(pid: number): ProcessState {
  try {
    process.kill(pid, 0);
    return 'alive';
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === 'ESRCH') return 'dead';
    if (code === 'EPERM') return 'forbidden';
    return 'unknown';
  }
}

async function localPidStartIdentity(pid: number): Promise<string | null> {
  if (pid === process.pid) return currentProcessStartedAt;
  try {
    const { stdout } = await execFileAsync('ps', ['-p', String(pid), '-o', 'lstart=']);
    const text = stdout.trim();
    if (!text) return null;
    const time = Date.parse(text);
    if (Number.isNaN(time)) return null;
    return new Date(time).toISOString();
  } catch {
    return null;
  }
}

async function ownerProcessIsLive(owner: LockOwner): Promise<boolean | null> {
  if (owner.hostname !== currentHostname) return null;
  if (Number.isNaN(Date.parse(owner.startedAt))) return null;
  const state = processState(owner.pid);
  if (state === 'dead') return false;
  if (state !== 'alive') return null;
  const startedAt = await localPidStartIdentity(owner.pid);
  if (!startedAt) return null;
  return Math.abs(Date.parse(startedAt) - Date.parse(owner.startedAt)) < 2000;
}

async function inheritedTokenOwnsLiveLock(path: string, token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const owner = await readOwner(path);
  if (!owner || owner.token !== token || owner.hostname !== currentHostname || owner.pid === process.pid) {
    return false;
  }
  return (await ownerProcessIsLive(owner)) === true;
}

// installRuntimeGuard(watchdog·SIGTERM)는 process.exit() 으로 끝내 finally 가 돌지 않는다.
// 그러면 잠금이 남아 다음 writer(요약 갱신 등)가 'lock busy' 로 실패한다(2026-10-20 geocode 45분 초과).
// exit 이벤트에서 이 프로세스가 잡은 잠금만 동기로 지운다. SIGKILL 은 여전히 recover 스크립트가 필요하다.
const heldLocks = new Map<string, string>();
let exitHookInstalled = false;

function releaseHeldLocksOnExit(): void {
  for (const [path, token] of heldLocks) {
    try {
      const owner = JSON.parse(readFileSync(join(path, 'owner.json'), 'utf8')) as Partial<LockOwner>;
      if (owner.token === token) rmSync(path, { recursive: true, force: true });
    } catch {
      // owner.json 이 없거나 이미 지워졌으면 할 일이 없다
    }
  }
  heldLocks.clear();
}

function trackHeldLock(path: string, token: string): void {
  heldLocks.set(path, token);
  if (!exitHookInstalled) {
    process.on('exit', releaseHeldLocksOnExit);
    exitHookInstalled = true;
  }
}

async function cleanupOwnedLock(path: string, token: string): Promise<void> {
  const owner = await readOwner(path);
  if (!owner || owner.token === token) {
    await rm(path, { recursive: true, force: true });
  }
}

export async function withRealEstateWriteLock<T>(label: string, run: () => Promise<T>): Promise<T> {
  const path = lockPath();
  const asyncToken = lockContext.getStore();
  if (asyncToken) return run();

  if (await inheritedTokenOwnsLiveLock(path, process.env[TOKEN_ENV])) {
    return run();
  }

  const token = randomUUID();
  let acquired = false;
  try {
    await mkdir(path, { recursive: false });
    acquired = true;
    const owner: LockOwner = {
      hostname: currentHostname,
      pid: process.pid,
      startedAt: currentProcessStartedAt,
      token,
      label,
    };
    const tmp = join(path, `owner.${process.pid}.${token}.tmp`);
    await writeFile(tmp, `${JSON.stringify(owner)}\n`, { flag: 'wx' });
    await rename(tmp, join(path, 'owner.json'));
    trackHeldLock(path, token);

    const previous = process.env[TOKEN_ENV];
    process.env[TOKEN_ENV] = token;
    try {
      return await lockContext.run(token, run);
    } finally {
      if (previous === undefined) delete process.env[TOKEN_ENV];
      else process.env[TOKEN_ENV] = previous;
    }
  } catch (error) {
    if (!acquired) {
      throw new Error(`Real estate write lock busy: ${path}`);
    }
    throw error;
  } finally {
    if (acquired) {
      await cleanupOwnedLock(path, token);
      heldLocks.delete(path);
    }
  }
}

async function acquireRecoveryGuard(): Promise<{ path: string; token: string } | null> {
  const path = recoveryPath();
  const token = randomUUID();
  let created = false;
  try {
    await mkdir(path, { recursive: false });
    created = true;
    await writeFile(join(path, 'owner.json'), `${JSON.stringify({ hostname: currentHostname, pid: process.pid, token })}\n`, { flag: 'wx' });
    return { path, token };
  } catch {
    if (created) await rm(path, { recursive: true, force: true });
    return null;
  }
}

async function releaseRecoveryGuard(guard: { path: string; token: string }): Promise<void> {
  try {
    const owner = JSON.parse(await readFile(join(guard.path, 'owner.json'), 'utf8')) as { token?: string };
    if (owner.token === guard.token) await rm(guard.path, { recursive: true, force: true });
  } catch {
    // If the guard metadata disappeared, remove the empty guard dir created by this process.
    await rm(guard.path, { recursive: true, force: true });
  }
}

export async function recoverRealEstateWriteLock(expectedToken: string): Promise<boolean> {
  const guard = await acquireRecoveryGuard();
  if (!guard) return false;
  try {
    const path = lockPath();
    const owner = await readOwner(path);
    if (!owner || owner.token !== expectedToken) return false;
    if (owner.hostname !== currentHostname) return false;
    const live = await ownerProcessIsLive(owner);
    if (live !== false) return false;
    const ownerBeforeDelete = await readOwner(path);
    if (!ownerBeforeDelete || ownerBeforeDelete.token !== expectedToken) return false;
    await rm(path, { recursive: true, force: true });
    return true;
  } finally {
    await releaseRecoveryGuard(guard);
  }
}
