// @TASK P11-R1-T1 - API Rate Limiting 미들웨어 구현
// @SPEC docs/planning/02-trd.md#보안

import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

/**
 * 전역 Rate Limiter
 * 기본 제한: IP당 100 requests/min
 */
export const globalRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1분
  max: 100, // IP당 최대 100 요청
  standardHeaders: true, // RateLimit-* 헤더 추가
  legacyHeaders: false, // X-RateLimit-* 헤더 비활성화
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: '요청 횟수를 초과했습니다. 잠시 후 다시 시도해주세요.',
    },
  },
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: '요청 횟수를 초과했습니다. 잠시 후 다시 시도해주세요.',
        requestId: req.requestId,
      },
    });
  },
  skip: (req: Request) => {
    // Health check 엔드포인트는 rate limit 제외
    return req.path === '/api/health';
  },
});

/**
 * 시설 검색 전용 Rate Limiter
 * /api/facilities/search 엔드포인트에 별도 제한: IP당 30 requests/min
 */
export const searchRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1분
  max: 30, // IP당 최대 30 요청
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: '검색 요청 횟수를 초과했습니다. 잠시 후 다시 시도해주세요.',
    },
  },
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: '검색 요청 횟수를 초과했습니다. 잠시 후 다시 시도해주세요.',
        requestId: req.requestId,
      },
    });
  },
});
