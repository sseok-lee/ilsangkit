// @TASK P11-R1-T1 - API Rate Limiting 미들웨어 구현
// @SPEC docs/planning/02-trd.md#보안

import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

/**
 * 전역 Rate Limiter
 *
 * 운영 환경에서 frontend SSR이 동일 도메인(https://ilsangkit.co.kr/api/...)으로 backend를 호출하는
 * 구조 때문에, 메인 페이지 SWR revalidate 1회 = 여러 API call → 1분에 100건 쉽게 초과 → 429 →
 * SSR이 빈 데이터로 페인트 → 그 HTML이 SWR로 1시간 캐싱되는 회귀 발생.
 *
 * - max를 1000/min으로 완화 (정상 사용자에겐 영향 없음, 어뷰저만 차단)
 * - 읽기 전용 API 경로(/api/sitemap, /api/meta, /api/subscription, /api/facilities, /api/guides,
 *   /api/real-estate, /api/area)는 skip — SSR/크롤러 트래픽 통과
 */
const READ_ONLY_API_PREFIXES = [
  '/api/sitemap',
  '/api/meta',
  '/api/subscription',
  '/api/facilities',
  '/api/guides',
  '/api/real-estate',
  '/api/area',
  '/api/reviews',
  '/api/waste-schedules',
];

export const globalRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1분
  max: 1000, // IP당 최대 1000 요청 — 정상 트래픽 여유, 어뷰저만 차단
  standardHeaders: true,
  legacyHeaders: false,
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
    if (req.path === '/api/health') return true;
    // SSR/내부 요청 (Nitro 프록시)은 rate limit 제외
    const ip = req.ip || req.socket.remoteAddress || '';
    if (ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1') return true;
    // 읽기 전용 경로(SSR/크롤러 빈도 높음)는 skip
    if (READ_ONLY_API_PREFIXES.some((p) => req.path.startsWith(p))) return true;
    return false;
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
  skip: (req: Request) => {
    // SSR/내부 요청 (Nitro 프록시)은 rate limit 제외
    const ip = req.ip || req.socket.remoteAddress || '';
    if (ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1') return true;
    return false;
  },
});
