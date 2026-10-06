// @TASK T0.1 - Express 앱 설정
// @SPEC docs/planning/02-trd.md#백엔드-아키텍처

import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import facilitiesRouter from './routes/facilities.js';
import metaRouter from './routes/meta.js';
import wasteSchedulesRouter from './routes/wasteSchedules.js';
import wasteAreasRouter from './routes/wasteAreas.js';
import sitemapRouter from './routes/sitemap.js';
import guidesRouter from './routes/guides.js';
import articlesRouter from './routes/articles.js';
import realEstateRouter from './routes/realEstate.js';
import landRouter from './routes/land.js';
import areaRouter from './routes/area.js';
import subscriptionRouter from './routes/subscription.js';
import transitRouter from './routes/transit.js';
import subwayRouter from './routes/subway.js';
import auctionRouter from './routes/auction.js';
import searchRouter from './routes/search.js';
import facilityNaverBlogRouter from './routes/facilityNaverBlog.js';
import realEstateNaverBlogRouter from './routes/realEstateNaverBlog.js';
import adminRouter from './routes/admin.js';
import adminAffiliateBannerImagesRouter from './routes/adminAffiliateBannerImages.js';
import { AppError, ValidationError } from './lib/errors.js';
import { requestIdMiddleware } from './middlewares/requestId.js';
import { globalRateLimiter } from './middlewares/rateLimit.js';
import { helmetConfig, corsOptions, sanitizeInput } from './middlewares/security.js';
import { checkActiveSummaryReadiness, type SummaryReadinessResult } from './services/realEstateSummaryReadiness.js';
import { getImageRoot } from './config/imageStorage.js';

const app: Application = express();

// Trust first proxy (Nginx/Nitro) — ensures req.ip reflects the real client IP
app.set('trust proxy', 1);

// Middleware

let releaseReadinessCheck = checkActiveSummaryReadiness;

export function setReleaseReadinessDbCheckForTests(
  check: (() => Promise<SummaryReadinessResult>) | undefined
): void {
  if (process.env.NODE_ENV !== 'test')
    throw new Error('release readiness test hook is only available in test mode');
  releaseReadinessCheck = check ?? checkActiveSummaryReadiness;
}

function currentReleaseId(): string | undefined {
  const releaseId = process.env.ILSK_RELEASE_ID?.trim();
  return releaseId || undefined;
}

function isLoopbackAddress(value: unknown): boolean {
  const normalized = String(value ?? '').trim().replace(/^::ffff:/, '');
  return normalized === '127.0.0.1' || normalized === '::1' || normalized === 'localhost';
}

function isLoopbackRequest(req: Request): boolean {
  const forwarded = String(req.headers['x-forwarded-for'] ?? '')
    .split(',')
    .map((address) => address.trim())
    .filter(Boolean);
  if (forwarded.length > 0 && forwarded.some((address) => !isLoopbackAddress(address))) {
    return false;
  }
  return isLoopbackAddress(req.ip) || isLoopbackAddress(req.socket.remoteAddress);
}

app.use((_, res, next) => {
  const releaseId = currentReleaseId();
  if (releaseId) res.setHeader('X-Ilsangkit-Release-Id', releaseId);
  next();
});

app.use('/api/admin', (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});
app.use(helmetConfig);
app.use(cors(corsOptions));
app.use(requestIdMiddleware);
app.use(globalRateLimiter); // Apply global rate limiter
app.use(cookieParser());
app.use('/api/admin/affiliate-banner-images', adminAffiliateBannerImagesRouter);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(sanitizeInput);

// Static file serving (uploaded images)
app.use(
  '/api/images',
  (_req, res, next) => {
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    next();
  },
  express.static(getImageRoot(), {
    maxAge: '7d',
    immutable: true,
    dotfiles: 'deny',
    index: false,
  })
);

// Health check endpoint
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

app.get('/api/internal/release-readiness', async (req: Request, res: Response) => {
  const releaseId = currentReleaseId();
  if (!releaseId || !isLoopbackRequest(req)) {
    res.status(404).json({ error: 'Not Found', message: 'The requested resource was not found' });
    return;
  }

  let summary: SummaryReadinessResult;
  try {
    summary = await releaseReadinessCheck(process.env);
  } catch {
    summary = {
      mode: 'address',
      table: 'RealEstateBuildingSummaryV2',
      ready: false,
      reason: 'readiness-check-failed',
    };
  }

  const expectedRunId = process.env.REAL_ESTATE_SUMMARY_RUN_ID ?? process.env.ILSK_SUMMARY_RUN_ID;
  const runIdMatches = !expectedRunId || summary.runId === expectedRunId;
  const urlMode = process.env.REAL_ESTATE_URL_MODE || 'keyed';
  // Address releases must not expose ambiguous name-only links without the URL registry.
  const urlModeReady = summary.mode !== 'address' || urlMode === 'preserved';
  const ready = summary.ready && runIdMatches && urlModeReady;
  res.status(ready ? 200 : 503).json({
    ready,
    releaseId,
    summary: {
      mode: summary.mode,
      table: summary.table,
      runId: summary.runId ?? null,
      validatedAt: summary.validatedAt ?? null,
      rowCount: summary.rowCount,
      reason: runIdMatches ? summary.reason : 'summary-run-id-mismatch',
    },
    realEstateUrls: {
      mode: urlMode,
      ready: urlModeReady && summary.ready,
      reason: urlModeReady ? summary.reason : 'preserved-url-mode-required',
    },
    db: { ok: ready },
  });
});

// API routes
app.use('/api/facilities', facilitiesRouter);
app.use('/api/facilities', facilityNaverBlogRouter);
app.use('/api/meta', metaRouter);
app.use('/api/waste-schedules', wasteSchedulesRouter);
app.use('/api/waste-areas', wasteAreasRouter);
app.use('/api/sitemap', sitemapRouter);
app.use('/api/guides', guidesRouter);
app.use('/api/articles', articlesRouter);
app.use('/api/real-estate/land', landRouter);
app.use('/api/real-estate', realEstateRouter);
app.use('/api/real-estate', realEstateNaverBlogRouter);
app.use('/api/area', areaRouter);
app.use('/api/subscription', subscriptionRouter);
app.use('/api/transit', transitRouter);
app.use('/api/subway', subwayRouter);
app.use('/api/auction', auctionRouter);
app.use('/api/search', searchRouter);
app.use('/api/admin', adminRouter);

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'The requested resource was not found',
  });
});

// Error handler
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        requestId: req.requestId,
        ...(err instanceof ValidationError && err.details ? { details: err.details } : {}),
      },
    });
    return;
  }

  // Handle unexpected errors with standard format
  // 민감 정보(DB 연결 문자열 등) 노출 방지: 전체 객체 대신 message/stack만 로깅
  if (process.env.NODE_ENV !== 'production') {
    console.error('Unhandled error:', err.message, err.stack);
  } else {
    console.error('Unhandled error:', err.message);
  }
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: process.env.NODE_ENV === 'development' ? err.message : '서버 오류가 발생했습니다',
      requestId: req.requestId,
    },
  });
});

export default app;
