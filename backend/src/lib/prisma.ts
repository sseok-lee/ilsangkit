// @TASK T0.4 - Prisma 클라이언트 싱글톤 + 연결풀 검증
// @SPEC docs/planning/04-database-design.md#prisma-client

import { PrismaClient } from '@prisma/client';

/**
 * DATABASE_URL에서 연결풀 파라미터(connection_limit, pool_timeout) 존재 검증
 * 프로덕션: 누락 시 Error 발생
 * 개발: 누락 시 경고만 출력
 */
export function validateDatabaseUrl(url: string | undefined): void {
  if (!url) {
    const message = 'DATABASE_URL is not set';
    if (process.env.NODE_ENV === 'production') {
      throw new Error(message);
    }
    console.warn(`[Prisma] ${message}`);
    return;
  }

  const hasConnectionLimit = url.includes('connection_limit=');
  const hasPoolTimeout = url.includes('pool_timeout=');

  if (!hasConnectionLimit || !hasPoolTimeout) {
    const message = 'DATABASE_URL missing required pool parameters: connection_limit and pool_timeout';
    if (process.env.NODE_ENV === 'production') {
      throw new Error(message);
    }
    console.warn(`[Prisma] ${message}`);
  }
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// 모듈 로드 시 DATABASE_URL 검증 (부작용)
validateDatabaseUrl(process.env.DATABASE_URL);

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
