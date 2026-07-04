import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { SESSION_COOKIE_NAME } from '../config/adminConfig.js';
import { verifySession } from '../services/adminSessionService.js';
import { ForbiddenError } from '../lib/errors.js';

function isAllowedOrigin(value: string | undefined): boolean {
  if (!value) return false;
  const allowed = (process.env.CORS_ORIGIN?.split(',') ?? ['http://localhost:3000']).map((s) => s.trim());
  try {
    const originOfValue = new URL(value).origin;
    return allowed.includes(originOfValue);
  } catch {
    return false;
  }
}

// CSRF 방어심화: 상태 변경 요청은 Origin(또는 Referer)이 allowlist에 있어야 함.
export function requireSameOrigin(req: Request, _res: Response, next: NextFunction): void {
  const origin = req.headers.origin ?? req.headers.referer;
  if (!isAllowedOrigin(typeof origin === 'string' ? origin : undefined)) {
    next(new ForbiddenError('교차 출처 요청은 허용되지 않습니다'));
    return;
  }
  next();
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = (req.cookies?.[SESSION_COOKIE_NAME] as string | undefined) ?? '';
  const ok = await verifySession(token);
  if (!ok) {
    res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: '인증이 필요합니다', requestId: req.requestId } });
    return;
  }
  next();
}

// 로그인 전용 리미터 — 기존 rateLimit.ts와 달리 loopback 스킵 없음.
export const adminLoginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    res.status(429).json({ success: false, error: { code: 'RATE_LIMIT_EXCEEDED', message: '로그인 시도가 많습니다. 잠시 후 다시 시도하세요.', requestId: req.requestId } });
  },
});
