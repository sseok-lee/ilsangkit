// @TASK T0.1 - 서버 시작점
// @SPEC docs/planning/02-trd.md#백엔드-아키텍처

import dotenv from 'dotenv';
import app from './app.js';
import prisma from './lib/prisma.js';

// Load environment variables
dotenv.config();

const PORT = Number(process.env.PORT) || 8000;
// 기본은 loopback(127.0.0.1) 바인딩. nginx 가 127.0.0.1:PORT 로 프록시하고 SSR 도
// NUXT_INTERNAL_API_BASE=http://127.0.0.1:8000 으로 호출하므로 외부에 직접 노출할 이유가 없다.
// 0.0.0.0 노출 시 nginx 를 우회한 직접 요청이 rate-limit/proxy_cache 를 무력화해
// Prisma/MySQL 풀 고갈(P2024) → SSR 실패 → 색인제외 사고를 재유발할 수 있어 fail-closed.
// 컨테이너 등 외부 바인딩이 필요한 환경은 HOST=0.0.0.0 로 명시 override.
const HOST = process.env.HOST || '127.0.0.1';

const server = app.listen(PORT, HOST, () => {
  console.info(`Server is running on http://${HOST}:${PORT}`);
  console.info(`Health check: http://${HOST}:${PORT}/api/health`);
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
