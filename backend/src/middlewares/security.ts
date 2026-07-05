// @TASK P11-R2-T1 - 보안 헤더 미들웨어
// @SPEC docs/planning/02-trd.md#보안

import helmet from 'helmet';
import { Request, Response, NextFunction } from 'express';
import DOMPurify from 'isomorphic-dompurify';

/**
 * Helmet 보안 헤더 설정
 * - CSP (Content Security Policy)
 * - HSTS (HTTP Strict Transport Security)
 * - X-Frame-Options, X-Content-Type-Options 등
 */
export const helmetConfig = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        'https://dapi.kakao.com', // Kakao Maps SDK
        'https://www.googletagmanager.com', // Google Analytics
        'https://www.google-analytics.com',
      ],
      styleSrc: [
        "'self'",
        "'unsafe-inline'", // TailwindCSS와 Kakao Maps 스타일 지원
        'https://fonts.googleapis.com',
      ],
      imgSrc: [
        "'self'",
        'data:',
        'https://*.kakaocdn.net', // Kakao Maps 타일 서버
        'https://map.daumcdn.net',
        'https://t1.daumcdn.net',
        'https://www.google-analytics.com',
      ],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      connectSrc: [
        "'self'",
        'https://dapi.kakao.com',
        'https://www.google-analytics.com',
        'https://analytics.google.com',
      ],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
    },
  },
  hsts: {
    maxAge: 31536000, // 1년
    includeSubDomains: true,
    preload: true,
  },
  frameguard: {
    action: 'deny', // X-Frame-Options: DENY
  },
  noSniff: true, // X-Content-Type-Options: nosniff
  xssFilter: false, // X-XSS-Protection 헤더 비활성화 (deprecated, 일부 브라우저에서 취약점 유발)
  referrerPolicy: {
    policy: 'strict-origin-when-cross-origin',
  },
});

/**
 * CORS 설정 (환경별 origin 제한)
 */
export const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void): void => {
    const allowedOrigins = process.env.CORS_ORIGIN?.split(',');
    if (!allowedOrigins && process.env.NODE_ENV === 'production') {
      callback(new Error('CORS_ORIGIN must be set in production'));
      return;
    }
    const origins = allowedOrigins || ['http://localhost:3000'];

    // origin이 없는 경우 (same-origin 요청)는 허용
    if (!origin) {
      callback(null, true);
      return;
    }

    if (origins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
};

/**
 * 입력값 sanitization 미들웨어 (XSS 방지)
 * - 요청 본문의 문자열 값에서 위험한 HTML/스크립트 태그 제거
 */
export function sanitizeInput(req: Request, _res: Response, next: NextFunction): void {
  // 어드민 라우트는 제외: 비밀번호(bcrypt 비교 대상)·마크다운 본문(< 포함)이 DOMPurify로 훼손되면 안 됨.
  if (req.path.startsWith('/api/admin')) {
    next();
    return;
  }
  if (req.body && typeof req.body === 'object') {
    sanitizeObject(req.body);
  }
  if (req.query && typeof req.query === 'object') {
    sanitizeObject(req.query);
  }
  next();
}

function sanitizeObject(obj: Record<string, unknown>): void {
  for (const key in obj) {
    const value = obj[key];
    if (typeof value === 'string') {
      obj[key] = DOMPurify.sanitize(value, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
    } else if (typeof value === 'object' && value !== null) {
      sanitizeObject(value as Record<string, unknown>);
    }
  }
}
