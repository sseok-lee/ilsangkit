// @TASK T0.1 - Express 앱 설정
// @SPEC docs/planning/02-trd.md#백엔드-아키텍처

import express, { Application, Request, Response, NextFunction } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import facilitiesRouter from './routes/facilities.js';
import metaRouter from './routes/meta.js';
import wasteSchedulesRouter from './routes/wasteSchedules.js';
import sitemapRouter from './routes/sitemap.js';
import guidesRouter from './routes/guides.js';
import realEstateRouter from './routes/realEstate.js';
import landRouter from './routes/land.js';
import areaRouter from './routes/area.js';
import subscriptionRouter from './routes/subscription.js';
import publicRentalRouter from './routes/publicRental.js';
import transitRouter from './routes/transit.js';
import subwayRouter from './routes/subway.js';
import auctionRouter from './routes/auction.js';
import searchRouter from './routes/search.js';
import facilityYoutubeRouter from './routes/facilityYoutube.js';
import facilityNaverBlogRouter from './routes/facilityNaverBlog.js';
import realEstateNaverBlogRouter from './routes/realEstateNaverBlog.js';
import { AppError, ValidationError } from './lib/errors.js';
import { requestIdMiddleware } from './middlewares/requestId.js';
import { globalRateLimiter } from './middlewares/rateLimit.js';
import { helmetConfig, corsOptions, sanitizeInput } from './middlewares/security.js';

const app: Application = express();

// Trust first proxy (Nginx/Nitro) — ensures req.ip reflects the real client IP
app.set('trust proxy', 1);

// Middleware
app.use(helmetConfig);
app.use(cors(corsOptions));
app.use(requestIdMiddleware);
app.use(globalRateLimiter); // Apply global rate limiter
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(sanitizeInput);

// Static file serving (uploaded images)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = process.env.UPLOAD_DIR || path.resolve(__dirname, '../../assets/images');
app.use('/api/images', (_req, res, next) => {
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
}, express.static(uploadDir, {
  maxAge: '7d',
  immutable: true,
  dotfiles: 'deny',
  index: false,
}));

// Health check endpoint
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// API routes
app.use('/api/facilities', facilitiesRouter);
app.use('/api/facilities', facilityYoutubeRouter);
app.use('/api/facilities', facilityNaverBlogRouter);
app.use('/api/meta', metaRouter);
app.use('/api/waste-schedules', wasteSchedulesRouter);
app.use('/api/sitemap', sitemapRouter);
app.use('/api/guides', guidesRouter);
app.use('/api/real-estate/land', landRouter);
app.use('/api/real-estate', realEstateRouter);
app.use('/api/real-estate', realEstateNaverBlogRouter);
app.use('/api/area', areaRouter);
app.use('/api/subscription', subscriptionRouter);
app.use('/api/public-rental', publicRentalRouter);
app.use('/api/transit', transitRouter);
app.use('/api/subway', subwayRouter);
app.use('/api/auction', auctionRouter);
app.use('/api/search', searchRouter);

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
