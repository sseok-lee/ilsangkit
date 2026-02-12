// @TASK T0.1 - Express 앱 설정
// @SPEC docs/planning/02-trd.md#백엔드-아키텍처

import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import facilitiesRouter from './routes/facilities.js';
import metaRouter from './routes/meta.js';
import wasteSchedulesRouter from './routes/wasteSchedules.js';
import sitemapRouter from './routes/sitemap.js';
import { AppError, ValidationError } from './lib/errors.js';

const app: Application = express();

// Middleware
app.use(helmet());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
app.use('/api/meta', metaRouter);
app.use('/api/waste-schedules', wasteSchedulesRouter);
app.use('/api/sitemap', sitemapRouter);

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'The requested resource was not found',
  });
});

// Error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        ...(err instanceof ValidationError && err.details ? { details: err.details } : {}),
      },
    });
    return;
  }

  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
  });
});

export default app;
