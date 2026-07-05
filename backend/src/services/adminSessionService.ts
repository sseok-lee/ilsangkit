import crypto from 'crypto';
import prisma from '../lib/prisma.js';
import { getSessionTtlMs } from '../config/adminConfig.js';

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function createSession(): Promise<{ token: string; expiresAt: Date }> {
  const token = crypto.randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + getSessionTtlMs());
  await prisma.adminSession.create({ data: { id: hashToken(token), expiresAt } });
  return { token, expiresAt };
}

export async function verifySession(token: string): Promise<boolean> {
  if (!token) return false;
  const row = await prisma.adminSession.findUnique({ where: { id: hashToken(token) } });
  if (!row) return false;
  if (row.expiresAt.getTime() <= Date.now()) {
    await prisma.adminSession.delete({ where: { id: row.id } }).catch(() => {});
    return false;
  }
  return true;
}

export async function revokeSession(token: string): Promise<void> {
  if (!token) return;
  await prisma.adminSession.delete({ where: { id: hashToken(token) } }).catch(() => {});
}
