// 어드민 인증 설정 (env 단일 소스, fail-closed)
export const SESSION_COOKIE_NAME = 'admin_session';

export function getAdminPasswordHash(): string | null {
  const h = process.env.ADMIN_PASSWORD_HASH;
  return h && h.trim().length > 0 ? h : null;
}

export function isAdminConfigured(): boolean {
  return getAdminPasswordHash() !== null;
}

export function getSessionTtlMs(): number {
  const hours = Number(process.env.ADMIN_SESSION_TTL_HOURS ?? '12');
  const safe = Number.isFinite(hours) && hours > 0 ? Math.min(168, hours) : 12;
  return safe * 60 * 60 * 1000;
}
