import prisma from '../lib/prisma.js';

export const MAX_ATTEMPTS = 5;
const LOCK_MS = 15 * 60 * 1000;
const ID = 'admin';

export async function isLockedOut(): Promise<boolean> {
  const row = await prisma.adminLoginThrottle.findUnique({ where: { id: ID } });
  if (!row || !row.lockedUntil) return false;
  return row.lockedUntil.getTime() > Date.now();
}

// failedAttempts는 로그인 성공(clearLoginFailures) 시에만 리셋된다 — 즉, 최초 잠금 이후에는
// 매 실패 시도마다 failedAttempts>=MAX_ATTEMPTS라 lockedUntil이 매번 전체 윈도우(LOCK_MS)로 재설정된다.
// 의도된(공격적) 동작 — 버그로 보고 "완화"하지 말 것.
export async function recordLoginFailure(): Promise<void> {
  const row = await prisma.adminLoginThrottle.upsert({
    where: { id: ID },
    create: { id: ID, failedAttempts: 1 },
    update: { failedAttempts: { increment: 1 } },
  });
  if (row.failedAttempts >= MAX_ATTEMPTS) {
    await prisma.adminLoginThrottle.update({
      where: { id: ID },
      data: { lockedUntil: new Date(Date.now() + LOCK_MS) },
    });
  }
}

export async function clearLoginFailures(): Promise<void> {
  await prisma.adminLoginThrottle.upsert({
    where: { id: ID },
    create: { id: ID, failedAttempts: 0 },
    update: { failedAttempts: 0, lockedUntil: null },
  });
}
