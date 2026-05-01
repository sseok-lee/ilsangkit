// @TASK T0.1 - 서버 시작점
// @SPEC docs/planning/02-trd.md#백엔드-아키텍처

import dotenv from 'dotenv';
import app from './app.js';
import prisma from './lib/prisma.js';

// Load environment variables
dotenv.config();

const PORT = process.env.PORT || 8000;

const server = app.listen(PORT, () => {
  console.info(`Server is running on http://localhost:${PORT}`);
  console.info(`Health check: http://localhost:${PORT}/api/health`);
});

// PM2 재시작 시 Prisma 커넥션 정리 — MySQL zombie 트랜잭션 방지
async function gracefulShutdown(signal: string) {
  console.info(`${signal} received, shutting down`);
  server.close(() => console.info('HTTP server closed'));
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGTERM', () => { void gracefulShutdown('SIGTERM'); });
process.on('SIGINT',  () => { void gracefulShutdown('SIGINT'); });
